import { type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
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
import { FieldOfMiraclesService } from './field-of-miracles.service';
import type { HostCommand, SocketIdentity, Team } from './types';

/**
 * Пределы на сокет. Ключа команды перебором не взять — десять символов по
 * алфавиту из тридцати двух, — но безлимитный цикл входов остаётся бесплатным
 * оракулом и способом положить процесс.
 */
const joinLimiter = createLimiter({ points: 5, windowMs: 60_000 });
const roomJoinLimiter = createLimiter({ points: 20, windowMs: 60_000 });
const spinLimiter = createLimiter({ points: 6, windowMs: 5_000 });
const guessLimiter = createLimiter({ points: 12, windowMs: 5_000 });
const createLimiterPerOwner = createLimiter({ points: 3, windowMs: 60 * 60_000 });

/** Как часто проверяем, не вышла ли пауза на переподключение капитана. */
const OCCUPANT_SWEEP_MS = 15 * 1000;

const publicRoom = (code: string) => `field:${code}:public`;
const hostRoom = (code: string) => `field:${code}:host`;
const normalizeCode = (code: unknown) => String(code ?? '').trim().toUpperCase();
const websocketOrigins =
  env.frontendOrigins.length > 0 ? env.frontendOrigins : true;

/**
 * Ведущий может сидеть за двумя пультами сразу. Если оба нажмут на одном
 * состоянии, второе нажатие применится к уже изменившейся игре — счёт уедет
 * дважды. Клиент прикладывает к команде ревизию, которую видел.
 */
const parseHostEnvelope = (
  value: unknown,
): { command: HostCommand; expectedRevision?: number } | null => {
  const envelope = value as Record<string, unknown> | null;
  // Голая команда тоже принимается: пульт мог остаться старой версии.
  if (envelope && typeof envelope === 'object' && 'command' in envelope) {
    const command = parseHostCommand(envelope.command);
    if (!command) return null;
    const revision = Number(envelope.expectedRevision);
    return {
      command,
      expectedRevision: Number.isFinite(revision) ? revision : undefined,
    };
  }
  const command = parseHostCommand(value);
  return command ? { command } : null;
};

const parseHostCommand = (value: unknown): HostCommand | null => {
  if (!value || typeof value !== 'object') return null;
  const command = value as Record<string, unknown>;
  switch (command.type) {
    case 'ADD_TEAM':
      return {
        type: command.type,
        name: String(command.name ?? ''),
        color: String(command.color ?? ''),
      };
    case 'REMOVE_TEAM':
      return { type: command.type, teamId: String(command.teamId ?? '') };
    case 'UPDATE_TEAM':
      return {
        type: command.type,
        teamId: String(command.teamId ?? ''),
        name: String(command.name ?? ''),
        color: String(command.color ?? ''),
      };
    case 'SET_TEAM_POINTS':
      return {
        type: command.type,
        teamId: String(command.teamId ?? ''),
        points: Number(command.points),
      };
    case 'START_ROUND':
      return {
        type: command.type,
        category: String(command.category ?? ''),
        clue: String(command.clue ?? ''),
        answer: String(command.answer ?? ''),
      };
    case 'GUESS_LETTER':
      return { type: command.type, letter: String(command.letter ?? '') };
    case 'CHOOSE_POSITION':
      return { type: command.type, index: Number(command.index) };
    case 'ATTEMPT_SOLVE':
      return { type: command.type, answer: String(command.answer ?? '') };
    case 'RESOLVE_SPECIAL':
      return { type: command.type, success: command.success === true };
    case 'PASS_TURN':
    case 'NEW_GAME':
    case 'UNDO':
      return { type: command.type };
    default:
      return null;
  }
};

@WebSocketGateway({
  namespace: '/field-of-miracles',
  cors: { origin: websocketOrigins, credentials: true },
})
export class FieldOfMiraclesGateway
  implements OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  private server: Namespace;

  private readonly identities = new Map<string, SocketIdentity>();
  private readonly spinTimers = new Map<string, NodeJS.Timeout>();
  private occupantSweeper: NodeJS.Timeout | null = null;

  constructor(
    private readonly games: FieldOfMiraclesService,
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

  onModuleInit() {
    // Брони капитанов подметает шлюз, а не служба: истёкшую бронь надо не просто
    // снять, но и разослать — иначе точка присутствия так и висит зелёной.
    this.occupantSweeper = setInterval(() => {
      for (const code of this.games.sweepOccupants()) this.broadcast(code);
    }, OCCUPANT_SWEEP_MS);
    this.occupantSweeper.unref?.();
  }

  onModuleDestroy() {
    if (this.occupantSweeper) clearInterval(this.occupantSweeper);
    // Таймеры вращения переживали остановку и держали шлюз в памяти.
    for (const timer of this.spinTimers.values()) clearTimeout(timer);
    this.spinTimers.clear();
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

    if (!createLimiterPerOwner.hit(String(ownerUserId ?? client.id))) {
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
    const state = this.games.getHostStateByJoinKey(
      code,
      body?.hostJoinKey ?? '',
    );
    if (!state) {
      return { ok: false, error: 'Комната или ключ ведущего неверны.' };
    }
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
    @MessageBody() body: {
      code?: string;
      teamKey?: string;
      participantId?: string;
    },
  ) {
    const code = normalizeCode(body?.code);
    if (!joinLimiter.hit(client.id) || !roomJoinLimiter.hit(code)) {
      return { ok: false, error: 'Слишком много попыток входа. Подождите минуту.' };
    }
    const teamId = this.games.getTeamIdByKey(code, body?.teamKey ?? '');
    const participantId = String(body?.participantId ?? '').trim().slice(0, 128);
    if (!teamId) {
      return { ok: false, error: 'Комната или ключ команды неверны.' };
    }
    if (!/^[\w:-]{3,128}$/u.test(participantId)) {
      return { ok: false, error: 'Идентификатор участника неверен.' };
    }

    // Место занимаем синхронно, до первого await: два одновременных входа
    // не смогут пройти проверку в одном процессе Node.js.
    const claim = this.games.claimSlot(code, teamId, participantId, client.id);
    if (!claim.ok) return { ok: false, error: claim.error };

    await this.become(
      client,
      { role: 'participant', code, teamId, participantId },
      false,
    );
    // Зал и ведущий должны увидеть, что за командой кто-то сел.
    this.broadcast(code);
    return { ok: true, code, teamId, state: this.games.getPublicState(code) };
  }

  @SubscribeMessage('host:command')
  command(
    @ConnectedSocket() client: Socket,
    @MessageBody() value: unknown,
  ) {
    const identity = this.identities.get(client.id);
    if (!identity || identity.role !== 'host') {
      return { ok: false, error: 'Требуются права ведущего.' };
    }
    const envelope = parseHostEnvelope(value);
    if (!envelope) return { ok: false, error: 'Неизвестная команда.' };
    const result = this.games.runHostCommand(
      identity.code,
      envelope.command,
      envelope.expectedRevision,
    );
    if (result.changed) this.broadcast(identity.code);
    return { ok: result.changed, error: result.error };
  }

  @SubscribeMessage('spin:request')
  requestSpin(@ConnectedSocket() client: Socket) {
    const identity = this.identities.get(client.id);
    if (!identity || identity.role === 'spectator') {
      return { ok: false, error: 'Сначала войдите по ключу команды.' };
    }
    if (!spinLimiter.hit(client.id)) {
      return { ok: false, error: 'Не так часто — барабан ещё крутится.' };
    }
    const result = this.games.requestSpin(
      identity.code,
      identity.role === 'participant' ? identity.teamId : undefined,
    );
    if (!result.changed) return { ok: false, error: result.error };

    this.broadcast(identity.code);
    const oldTimer = this.spinTimers.get(identity.code);
    if (oldTimer) clearTimeout(oldTimer);
    const timer = setTimeout(() => {
      this.spinTimers.delete(identity.code);
      if (this.games.settleSpin(identity.code, result.spin.id)) {
        this.broadcast(identity.code);
      }
    }, result.spin.durationMs);
    this.spinTimers.set(identity.code, timer);
    return { ok: true, spin: result.spin };
  }

  @SubscribeMessage('letter:guess')
  guessLetter(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { letter?: string },
  ) {
    const identity = this.identities.get(client.id);
    if (!identity || identity.role !== 'participant') {
      return { ok: false, error: 'Сначала войдите по ключу команды.' };
    }
    if (!guessLimiter.hit(client.id)) {
      return { ok: false, error: 'Слишком быстро. Подождите пару секунд.' };
    }
    const result = this.games.runParticipantCommand(identity.code, identity.teamId, {
      type: 'GUESS_LETTER',
      letter: body?.letter ?? '',
    });
    if (result.changed) this.broadcast(identity.code);
    return { ok: result.changed, error: result.error };
  }

  @SubscribeMessage('position:choose')
  choosePosition(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { index?: number },
  ) {
    const identity = this.identities.get(client.id);
    if (!identity || identity.role !== 'participant') {
      return { ok: false, error: 'Сначала войдите по ключу команды.' };
    }
    const result = this.games.runParticipantCommand(identity.code, identity.teamId, {
      type: 'CHOOSE_POSITION',
      index: Number(body?.index),
    });
    if (result.changed) this.broadcast(identity.code);
    return { ok: result.changed, error: result.error };
  }

  private broadcast(code: string) {
    const publicState = this.games.getPublicState(code);
    if (publicState) {
      this.server.to(publicRoom(code)).emit('state:update', publicState);
    }
    // A host state includes the secret answer; it never enters the public room.
    // Only timing-safe-token-verified sockets ever enter the host room.
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

  /**
   * Устройство отпало — место не освобождаем сразу: телефон в зале теряет сеть
   * постоянно, и без паузы капитан терял своё место от одного моргания связи.
   */
  private releaseParticipantSlot(client: Socket) {
    const identity = this.identities.get(client.id);
    if (!identity || identity.role !== 'participant') return;
    this.games.releaseSlot(client.id);
    this.broadcast(identity.code);
  }
}
