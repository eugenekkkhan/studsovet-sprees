import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { createLimiter } from '../common/rate-limit';
import { SessionCreationPolicyService } from '../database/session-creation-policy.service';
import { env } from '../env';
import { parseHostCommand, parseParticipantCommand } from './parse-command';
import { QuizService } from './quiz.service';
import type { SocketIdentity, Team } from './types';

/**
 * Пределы на сокет. Ключа команды перебором не взять — десять символов по
 * алфавиту из тридцати двух, — но безлимитный цикл входов остаётся бесплатным
 * оракулом и способом положить процесс.
 */
const joinLimiter = createLimiter({ points: 5, windowMs: 60_000 });
const roomJoinLimiter = createLimiter({ points: 20, windowMs: 60_000 });
const buzzLimiter = createLimiter({ points: 10, windowMs: 2_000 });
const createRoomLimiter = createLimiter({ points: 3, windowMs: 60 * 60_000 });

const publicRoom = (code: string) => `quiz:${code}:public`;
const hostRoom = (code: string) => `quiz:${code}:host`;
const normalizeCode = (code: unknown) => String(code ?? '').trim().toUpperCase();
const websocketOrigins =
  env.frontendOrigins.length > 0 ? env.frontendOrigins : true;

interface TeamOccupant {
  participantId: string;
  socketId: string;
}

@WebSocketGateway({
  namespace: '/quiz',
  cors: { origin: websocketOrigins, credentials: true },
  // Колода едет целиком в `LOAD_DECK`. Со стандартной границей в 1 МБ сокет
  // ведущего молча рвался бы на колоде с картинками, ничего не сообщив.
  maxHttpBufferSize: 12 * 1024 * 1024,
})
export class QuizGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  private server: Namespace;

  private readonly identities = new Map<string, SocketIdentity>();
  private readonly teamOccupants = new Map<string, TeamOccupant>();

  constructor(
    private readonly games: QuizService,
    private readonly auth: AuthService,
    private readonly creationPolicy: SessionCreationPolicyService,
  ) {}

  /**
   * Кто открывает комнату. Раньше владельцем считалась строка из localStorage,
   * которую клиент присылал сам: повторив чужую, можно было получить чужой
   * `hostToken`. Теперь владелец — подписанный токен сессии из рукопожатия.
   */
  private ownerOf(client: Socket): number | null {
    const raw = (client.handshake?.auth as { token?: unknown } | undefined)?.token;
    return this.auth.verify(String(raw ?? ''))?.id ?? null;
  }

  handleDisconnect(client: Socket) {
    this.releaseParticipantSlot(client);
    this.identities.delete(client.id);
  }

  @SubscribeMessage('session:create')
  async createSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { initialTeams?: Array<Partial<Team>> },
  ) {
    const ownerUserId = this.ownerOf(client);
    // Там, где настроен бот, комнату открывает только вошедший через Telegram.
    if (ownerUserId === null && env.telegramEnabled && !env.devAuth) {
      return { ok: false, error: 'Войдите через Telegram, чтобы открыть комнату.' };
    }
    if (ownerUserId !== null && await this.creationPolicy.isBlocked(ownerUserId)) {
      return { ok: false, error: 'Администратор запретил вам создавать игровые комнаты.' };
    }

    if (!createRoomLimiter.hit(String(ownerUserId ?? client.id))) {
      return { ok: false, error: 'Слишком часто открываете комнаты. Подождите.' };
    }

    const created = this.games.createSession(
      ownerUserId,
      Array.isArray(body?.initialTeams) ? body.initialTeams : [],
    );
    if (!created) {
      return { ok: false, error: 'Сервер занят: слишком много открытых комнат.' };
    }
    await this.become(client, { role: 'host', code: created.code });
    return { ok: true, ...created };
  }

  @SubscribeMessage('host:join')
  async joinHost(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { code?: string; hostToken?: string },
  ) {
    const code = normalizeCode(body?.code);
    const state = this.games.getHostState(code, body?.hostToken ?? '');
    if (!state) return { ok: false, error: 'Комната или токен ведущего неверны.' };
    await this.become(client, { role: 'host', code });
    return {
      ok: true,
      code,
      hostJoinKey: this.games.getHostJoinKeyForConnectedHost(code),
      state,
    };
  }

  @SubscribeMessage('host:join-remote')
  async joinRemoteHost(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { code?: string; hostJoinKey?: string },
  ) {
    const code = normalizeCode(body?.code);
    const state = this.games.getHostStateByJoinKey(code, body?.hostJoinKey ?? '');
    if (!state) return { ok: false, error: 'Комната или ключ ведущего неверны.' };
    await this.become(client, { role: 'host', code });
    return {
      ok: true,
      code,
      hostJoinKey: this.games.getHostJoinKeyForConnectedHost(code),
      state,
    };
  }

  @SubscribeMessage('session:watch')
  async watchSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { code?: string },
  ) {
    const code = normalizeCode(body?.code);
    const state = this.games.getPublicState(code);
    if (!state) return { ok: false, error: 'Комната не найдена.' };
    await this.become(client, { role: 'spectator', code });
    return { ok: true, code, state };
  }

  @SubscribeMessage('participant:join')
  async joinParticipant(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { code?: string; teamKey?: string; participantId?: string },
  ) {
    const code = normalizeCode(body?.code);
    if (!joinLimiter.hit(client.id) || !roomJoinLimiter.hit(code)) {
      return { ok: false, error: 'Слишком много попыток входа. Подождите минуту.' };
    }
    const teamId = this.games.getTeamIdByKey(code, body?.teamKey ?? '');
    const participantId = String(body?.participantId ?? '').trim().slice(0, 128);
    if (!teamId) return { ok: false, error: 'Комната или ключ команды неверны.' };
    if (!/^[\w:-]{3,128}$/u.test(participantId)) {
      return { ok: false, error: 'Идентификатор участника неверен.' };
    }

    const slot = `${code}:${teamId}`;
    const occupant = this.teamOccupants.get(slot);
    const occupantSocket = occupant
      ? this.server.sockets.get(occupant.socketId)
      : undefined;
    if (occupant && occupant.socketId !== client.id && occupantSocket?.connected) {
      return { ok: false, error: 'За эту команду уже подключён другой капитан.' };
    }

    // Занимаем место синхронно, до первого await: два одновременных входа
    // не смогут пройти проверку в одном процессе Node.js.
    this.releaseParticipantSlot(client);
    this.teamOccupants.set(slot, { participantId, socketId: client.id });
    await this.become(
      client,
      { role: 'participant', code, teamId, participantId },
      false,
    );
    return { ok: true, code, teamId, state: this.games.getPublicState(code) };
  }

  @SubscribeMessage('host:command')
  hostCommand(@ConnectedSocket() client: Socket, @MessageBody() value: unknown) {
    const identity = this.identities.get(client.id);
    if (!identity || identity.role !== 'host') {
      return { ok: false, error: 'Требуются права ведущего.' };
    }
    const command = parseHostCommand(value);
    if (!command) return { ok: false, error: 'Неизвестная команда.' };
    const result = this.games.runHostCommand(identity.code, command);
    if (result.changed) this.broadcast(identity.code);
    return { ok: result.changed, error: result.error };
  }

  @SubscribeMessage('participant:command')
  participantCommand(
    @ConnectedSocket() client: Socket,
    @MessageBody() value: unknown,
  ) {
    const identity = this.identities.get(client.id);
    if (!identity || identity.role !== 'participant') {
      return { ok: false, error: 'Сначала войдите по ключу команды.' };
    }
    const command = parseParticipantCommand(value);
    if (!command) return { ok: false, error: 'Такое действие капитану недоступно.' };
    // Кнопка — самое горячее место игры: без предела ею можно забить сервер.
    if (command.type === 'BUZZ' && !buzzLimiter.hit(client.id)) {
      return { ok: false, error: 'Слишком часто. Отпустите кнопку на секунду.' };
    }
    const result = this.games.runParticipantCommand(
      identity.code,
      identity.teamId,
      command,
    );
    if (result.changed) this.broadcast(identity.code);
    return { ok: result.changed, error: result.error };
  }

  private broadcast(code: string) {
    const publicState = this.games.getPublicState(code);
    if (publicState) {
      this.server.to(publicRoom(code)).emit('state:update', publicState);
    }
    // Состояние ведущего содержит ответы и не попадает в публичную комнату.
    const hostState = this.games.getHostStateForConnectedHost(code);
    if (hostState) this.server.to(hostRoom(code)).emit('state:update', hostState);
  }

  private async become(
    client: Socket,
    identity: SocketIdentity,
    releaseSlot = true,
  ) {
    if (releaseSlot) this.releaseParticipantSlot(client);
    const previous = this.identities.get(client.id);
    if (previous) {
      await client.leave(publicRoom(previous.code));
      await client.leave(hostRoom(previous.code));
    }
    this.identities.set(client.id, identity);
    await client.join(
      identity.role === 'host' ? hostRoom(identity.code) : publicRoom(identity.code),
    );
  }

  private releaseParticipantSlot(client: Socket) {
    const identity = this.identities.get(client.id);
    if (!identity || identity.role !== 'participant') return;
    const slot = `${identity.code}:${identity.teamId}`;
    if (this.teamOccupants.get(slot)?.socketId === client.id) {
      this.teamOccupants.delete(slot);
    }
  }
}
