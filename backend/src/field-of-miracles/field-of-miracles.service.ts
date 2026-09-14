import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  applyCommand,
  beginAuthoritativeSpin,
  createInitialGameState,
  settleAuthoritativeSpin,
} from './game.engine';
import { FORTUNE_SECTORS } from './sectors';
import type {
  GameSession,
  HostCommand,
  StoredGameState,
  HostGameState,
  PublicGameState,
  SpinResult,
  Team,
} from './types';
import { RoomStore } from '../common/room-store';
import { env } from '../env';

const ROOM_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const TEAM_KEY_LENGTH = 10;
const HOST_JOIN_KEY_LENGTH = 12;
const slotKey = (code: string, teamId: string) => `${code}:${teamId}`;

/** Комната без единого обращения столько времени считается брошенной. */
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
/** Потолок на процесс: комнату открывают вошедшие, но и их стоит ограничить. */
const MAX_ROOMS = 200;

/**
 * Команды, после которых снимок пишется сразу: они задают весь дальнейший ход
 * игры, и терять их на падении обиднее всего.
 */
const FLUSH_AFTER = new Set<HostCommand['type']>(['START_ROUND', 'NEW_GAME']);

/**
 * Команды, которые меняют счёт или ход необратимо. Остальное — правка состава
 * и настроек — переживает расхождение пультов без последствий.
 */
const GUARDED = new Set<HostCommand['type']>([
  'GUESS_LETTER',
  'CHOOSE_POSITION',
  'ATTEMPT_SOLVE',
  'RESOLVE_SPECIAL',
  'PASS_TURN',
  'START_ROUND',
  'NEW_GAME',
  'UNDO',
]);

/**
 * Сколько место капитана держится за отключившимся устройством. Телефон в зале
 * теряет сеть постоянно; без этой паузы место мгновенно занимал кто угодно.
 */
const RECONNECT_GRACE_MS = 90 * 1000;

/** Кто сидит за командой. В снимок не попадает: сокеты рестарт не переживают. */
interface TeamOccupant {
  participantId: string;
  socketId: string;
  since: number;
  /** Не null — устройство отпало, место держится до конца паузы. */
  disconnectedAt: number | null;
}

/** Длительность вращения задаётся переменной FIELD_SPIN_DURATION_MS. */
export const SPIN_DURATION_MS = env.spinDurationMs;

const makeRoomCode = () => {
  const bytes = randomBytes(6);
  return Array.from(bytes, (byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join('');
};

const makeTeamKey = () => {
  const bytes = randomBytes(TEAM_KEY_LENGTH);
  return Array.from(
    bytes,
    (byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length],
  ).join('');
};

const makeHostJoinKey = () => {
  const bytes = randomBytes(HOST_JOIN_KEY_LENGTH);
  return Array.from(
    bytes,
    (byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length],
  ).join('');
};

/**
 * Public and deterministic mapping. A client can hash the revealed seed and
 * independently verify both the sector and the exact landing angle.
 */
export const spinFromSeed = (seed: string, startedAt = Date.now()): SpinResult => {
  const digest = createHash('sha256').update(seed, 'hex').digest();
  const sectorIndex = Math.floor(
    (digest.readUInt32BE(0) / 0x1_0000_0000) * FORTUNE_SECTORS.length,
  );
  const jitter = digest.readUInt32BE(4) / 0x1_0000_0000;
  const sectorWidth = 360 / FORTUNE_SECTORS.length;
  // Stay away from wedge edges so rendering round-off cannot change a result.
  const landingAngle = Number(
    ((sectorIndex + 0.15 + jitter * 0.7) * sectorWidth).toFixed(6),
  );

  return {
    id: randomUUID(),
    seed,
    algorithm: 'sha256-v1',
    sectorId: FORTUNE_SECTORS[sectorIndex].id,
    sectorIndex,
    landingAngle,
    startedAt,
    durationMs: SPIN_DURATION_MS,
    status: 'spinning',
  };
};

@Injectable()
export class FieldOfMiraclesService implements OnModuleInit, OnModuleDestroy {
  private readonly sessions = new Map<string, GameSession>();
  /** Владелец — проверенный пользователь сессии, а не строка с клиента. */
  private readonly sessionsByOwner = new Map<number, string>();
  private readonly store = new RoomStore<StoredGameState>('field-rooms');
  private readonly occupants = new Map<string, TeamOccupant>();
  private readonly sweeper: NodeJS.Timeout;

  constructor() {
    // Брони капитанов подметает шлюз: только он умеет разослать состояние.
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    // Сборщик не должен держать процесс живым сам по себе.
    this.sweeper.unref?.();
  }

  /**
   * Поднимает комнаты с прошлого запуска. Иначе рестарт сервера посреди игры
   * менял код комнаты, и розданные капитанам ссылки разом становились мусором.
   */
  onModuleInit() {
    const now = Date.now();
    for (const session of this.store.loadAll()) {
      if (now - session.lastActivityAt > ROOM_TTL_MS) {
        this.store.forget(session.code);
        continue;
      }
      this.sessions.set(session.code, session);
      if (session.ownerUserId !== null) {
        this.sessionsByOwner.set(session.ownerUserId, session.code);
      }
    }
  }

  onModuleDestroy() {
    clearInterval(this.sweeper);
    // Останов сервера — последний шанс дописать отложенные снимки.
    for (const session of this.sessions.values()) this.store.flush(session);
  }

  /**
   * Открывает комнату. Один владелец держит одну комнату: перезагрузка
   * страницы возвращает ту же, а не плодит пустышки.
   */
  createSession(ownerUserId: number | null, initialTeams: Array<Partial<Team>> = []) {
    const existingCode =
      ownerUserId === null ? undefined : this.sessionsByOwner.get(ownerUserId);
    const existing = existingCode ? this.sessions.get(existingCode) : undefined;
    if (existing) {
      this.ensureHostJoinKey(existing);
      this.ensureTeamKeys(existing);
      this.touch(existing);
      return {
        code: existing.code,
        hostToken: existing.hostToken,
        hostJoinKey: existing.hostJoinKey,
        state: this.toHostState(existing),
      };
    }

    if (this.sessions.size >= MAX_ROOMS) {
      // Сначала пробуем освободить место просроченными, и только потом отказываем.
      this.sweep();
      if (this.sessions.size >= MAX_ROOMS) return null;
    }

    let code = makeRoomCode();
    while (this.sessions.has(code)) code = makeRoomCode();
    const now = Date.now();
    const session: GameSession = {
      code,
      hostToken: randomBytes(32).toString('hex'),
      hostJoinKey: makeHostJoinKey(),
      ownerUserId,
      game: createInitialGameState(this.sanitizeInitialTeams(initialTeams)),
      createdAt: now,
      lastActivityAt: now,
    };
    this.sessions.set(code, session);
    if (ownerUserId !== null) this.sessionsByOwner.set(ownerUserId, code);
    this.store.flush(session);
    return {
      code,
      hostToken: session.hostToken,
      hostJoinKey: session.hostJoinKey,
      state: this.toHostState(session),
    };
  }

  /** Убирает комнаты, к которым давно никто не обращался. */
  sweep(now = Date.now()) {
    for (const [code, session] of this.sessions) {
      if (now - session.lastActivityAt <= ROOM_TTL_MS) continue;
      this.sessions.delete(code);
      if (
        session.ownerUserId !== null &&
        this.sessionsByOwner.get(session.ownerUserId) === code
      ) {
        this.sessionsByOwner.delete(session.ownerUserId);
      }
      this.store.forget(code);
    }
  }

  /** Только для тестов и диагностики. */
  get roomCount() {
    return this.sessions.size;
  }

  /** Без ключей команд и ведущего: безопасная проекция для админки. */
  listSessions() {
    return [...this.sessions.values()].map((session) => ({
      code: session.code,
      ownerUserId: session.ownerUserId,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      teamCount: session.game.teams.length,
    }));
  }

  removeSession(code: string) {
    const normalized = String(code ?? '').trim().toUpperCase();
    const session = this.sessions.get(normalized);
    if (!session) return false;
    this.sessions.delete(normalized);
    if (
      session.ownerUserId !== null &&
      this.sessionsByOwner.get(session.ownerUserId) === normalized
    ) {
      this.sessionsByOwner.delete(session.ownerUserId);
    }
    for (const key of this.occupants.keys()) {
      if (key.startsWith(`${normalized}:`)) this.occupants.delete(key);
    }
    this.store.forget(normalized);
    return true;
  }

  /**
   * Занимает место капитана. Своё устройство возвращается на место всегда,
   * чужое — только когда прежнее отпало и пауза на переподключение вышла.
   */
  claimSlot(
    code: string,
    teamId: string,
    participantId: string,
    socketId: string,
    now = Date.now(),
  ): { ok: true } | { ok: false; error: string } {
    const key = slotKey(code, teamId);
    const occupant = this.occupants.get(key);
    const mine = occupant?.participantId === participantId;

    if (occupant && !mine && occupant.disconnectedAt === null) {
      return { ok: false, error: 'За эту команду уже подключён другой капитан.' };
    }
    if (occupant && !mine && occupant.disconnectedAt !== null) {
      const left = RECONNECT_GRACE_MS - (now - occupant.disconnectedAt);
      if (left > 0) {
        return {
          ok: false,
          error: `Место капитана держится за прежним устройством ещё ${Math.ceil(left / 1000)} с.`,
        };
      }
    }

    this.releaseSlot(socketId, now);
    this.occupants.set(key, {
      participantId,
      socketId,
      since: occupant && mine ? occupant.since : now,
      disconnectedAt: null,
    });
    return { ok: true };
  }

  /** Устройство отпало: место не освобождаем сразу, а держим паузу. */
  releaseSlot(socketId: string, now = Date.now()) {
    for (const occupant of this.occupants.values()) {
      if (occupant.socketId !== socketId) continue;
      occupant.disconnectedAt = now;
    }
  }

  /** Команды, за которыми прямо сейчас кто-то сидит. */
  connectedTeamIds(code: string) {
    const prefix = `${code}:`;
    const connected: string[] = [];
    for (const [key, occupant] of this.occupants) {
      if (!key.startsWith(prefix) || occupant.disconnectedAt !== null) continue;
      connected.push(key.slice(prefix.length));
    }
    return connected;
  }

  /** Снимает брони, у которых пауза на переподключение уже вышла. */
  sweepOccupants(now = Date.now()) {
    const expired: string[] = [];
    for (const [key, occupant] of this.occupants) {
      if (occupant.disconnectedAt === null) continue;
      if (now - occupant.disconnectedAt <= RECONNECT_GRACE_MS) continue;
      expired.push(key);
    }
    for (const key of expired) this.occupants.delete(key);
    // Коды комнат, где присутствие изменилось: шлюзу нужно разослать состояние.
    return [...new Set(expired.map((key) => key.split(':')[0]))];
  }

  private touch(session: GameSession) {
    session.lastActivityAt = Date.now();
    return session;
  }

  getHostState(code: string, hostToken: string): HostGameState | null {
    const session = this.getSession(code);
    if (!session || !this.tokensMatch(session.hostToken, hostToken)) return null;
    this.ensureHostJoinKey(session);
    this.ensureTeamKeys(session);
    this.touch(session);
    return this.toHostState(session);
  }

  getHostStateByJoinKey(code: string, hostJoinKey: string): HostGameState | null {
    const session = this.getSession(code);
    const normalizedKey = String(hostJoinKey ?? '').trim().toUpperCase();
    if (!session || normalizedKey.length !== HOST_JOIN_KEY_LENGTH) return null;
    this.ensureHostJoinKey(session);
    if (!this.tokensMatch(session.hostJoinKey, normalizedKey)) return null;
    this.ensureTeamKeys(session);
    this.touch(session);
    return this.toHostState(session);
  }

  /** Gateway-only view for a socket whose host token was already verified. */
  getHostStateForConnectedHost(code: string): HostGameState | null {
    const session = this.getSession(code);
    if (session) {
      this.ensureHostJoinKey(session);
      this.ensureTeamKeys(session);
    }
    return session ? this.toHostState(session) : null;
  }

  getHostJoinKeyForConnectedHost(code: string) {
    const session = this.getSession(code);
    if (!session) return null;
    this.ensureHostJoinKey(session);
    return session.hostJoinKey;
  }

  getPublicState(code: string): PublicGameState | null {
    const session = this.getSession(code);
    if (session) this.ensureTeamKeys(session);
    return session ? this.toPublicState(session) : null;
  }

  getTeamIdByKey(code: string, joinKey: string) {
    const session = this.getSession(code);
    const normalizedKey = String(joinKey ?? '').trim().toUpperCase();
    if (!session || normalizedKey.length !== TEAM_KEY_LENGTH) return null;
    this.ensureTeamKeys(session);
    return (
      session.game.teams.find((team) =>
        this.tokensMatch(team.joinKey, normalizedKey),
      )?.id ?? null
    );
  }

  runHostCommand(code: string, command: HostCommand, expectedRevision?: number) {
    const session = this.getSession(code);
    if (!session) return { changed: false, error: 'Комната не найдена.' };
    // Сверяем только разрушающие команды и только если клиент прислал ревизию:
    // иначе пульт, отставший на одну рассылку, отбивал бы законные нажатия.
    if (
      expectedRevision !== undefined &&
      GUARDED.has(command.type) &&
      expectedRevision !== session.game.revision
    ) {
      return {
        changed: false,
        error: 'Состояние изменилось на другом пульте — проверьте экран.',
      };
    }
    const next = applyCommand(session.game, command, () =>
      this.createTeamIdentity(session),
    );
    if (!next) {
      return {
        changed: false,
        error: 'Действие сейчас недоступно или содержит неверные данные.',
      };
    }
    this.persist(session, next, FLUSH_AFTER.has(command.type));
    return { changed: true };
  }

  runParticipantCommand(
    code: string,
    teamId: string,
    command: Extract<HostCommand, { type: 'GUESS_LETTER' | 'CHOOSE_POSITION' }>,
  ) {
    const session = this.getSession(code);
    if (!session) return { changed: false, error: 'Комната не найдена.' };
    if (session.game.activeTeamId !== teamId) {
      return { changed: false, error: 'Сейчас ход другой команды.' };
    }
    const next = applyCommand(session.game, command, () =>
      this.createTeamIdentity(session),
    );
    if (!next) {
      return {
        changed: false,
        error: 'Выбор уже принят или сейчас недоступен.',
      };
    }
    this.persist(session, next);
    return { changed: true };
  }

  requestSpin(code: string, participantTeamId?: string) {
    const session = this.getSession(code);
    if (!session) return { changed: false, error: 'Комната не найдена.' } as const;
    if (
      participantTeamId !== undefined &&
      session.game.activeTeamId !== participantTeamId
    ) {
      return { changed: false, error: 'Сейчас ход другой команды.' } as const;
    }

    const spin = spinFromSeed(randomBytes(32).toString('hex'));
    const next = beginAuthoritativeSpin(session.game, spin);
    if (!next) {
      return {
        changed: false,
        error: 'Барабан сейчас нельзя крутить.',
      } as const;
    }
    this.persist(session, next);
    return { changed: true, spin } as const;
  }

  settleSpin(code: string, spinId: string) {
    const session = this.getSession(code);
    if (!session) return false;
    const next = settleAuthoritativeSpin(session.game, spinId);
    if (!next) return false;
    this.persist(session, next);
    return true;
  }

  private getSession(code: string) {
    const session = this.sessions.get(String(code ?? '').trim().toUpperCase());
    if (session) this.touch(session);
    return session;
  }

  /** Принимает новое состояние и откладывает снимок; ключевые шаги пишет сразу. */
  private persist(
    session: GameSession,
    next: StoredGameState,
    immediately = false,
  ) {
    session.game = next;
    this.touch(session);
    if (immediately) this.store.flush(session);
    else this.store.save(session);
  }

  private sanitizeInitialTeams(initialTeams: Array<Partial<Team>>) {
    if (!Array.isArray(initialTeams)) return [];
    const names = new Set<string>();
    const joinKeys = new Set<string>();
    return initialTeams.slice(0, 20).flatMap((candidate) => {
      const name = String(candidate?.name ?? '').trim().slice(0, 60);
      const normalizedName = name.toLocaleLowerCase('ru-RU');
      if (!name || names.has(normalizedName)) return [];
      names.add(normalizedName);
      const joinKey = this.uniqueTeamKey(
        Array.from(joinKeys),
        String(candidate.joinKey ?? '').trim().toUpperCase(),
      );
      joinKeys.add(joinKey);
      return [
        {
          id: randomUUID(),
          joinKey,
          name,
          color: /^#[\da-f]{6}$/i.test(String(candidate.color ?? ''))
            ? String(candidate.color)
            : '#cccccc',
          points: Number.isFinite(candidate.points)
            ? Math.max(0, Math.round(Number(candidate.points)))
            : 0,
          roundPoints: 0,
        },
      ];
    });
  }

  private createTeamIdentity(session: GameSession) {
    return {
      id: randomUUID(),
      joinKey: this.uniqueTeamKey(
        session.game.teams.map((team) => team.joinKey),
      ),
    };
  }

  /** Upgrades sessions created by an older server without losing their teams. */
  private ensureTeamKeys(session: GameSession) {
    const occupied: string[] = [];
    let changed = false;
    session.game.teams = session.game.teams.map((team) => {
      const candidate = String(team.joinKey ?? '').trim().toUpperCase();
      const joinKey = this.uniqueTeamKey(occupied, candidate);
      occupied.push(joinKey);
      if (joinKey === candidate) return team;
      changed = true;
      return { ...team, joinKey };
    });
    if (changed) session.game.revision += 1;
  }

  private ensureHostJoinKey(session: GameSession) {
    const candidate = String(session.hostJoinKey ?? '').trim().toUpperCase();
    if (
      new RegExp(`^[${ROOM_ALPHABET}]{${HOST_JOIN_KEY_LENGTH}}$`).test(candidate)
    ) {
      session.hostJoinKey = candidate;
      return;
    }
    session.hostJoinKey = makeHostJoinKey();
  }

  private uniqueTeamKey(existingKeys: string[], preferred = '') {
    const occupied = new Set(existingKeys);
    if (
      new RegExp(`^[${ROOM_ALPHABET}]{${TEAM_KEY_LENGTH}}$`).test(preferred) &&
      !occupied.has(preferred)
    ) {
      return preferred;
    }
    let key = makeTeamKey();
    while (occupied.has(key)) key = makeTeamKey();
    return key;
  }

  private tokensMatch(expected: string, supplied: string) {
    const left = Buffer.from(expected);
    const right = Buffer.from(String(supplied ?? ''));
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private toHostState(session: GameSession): HostGameState {
    const { undoStack, revision, ...game } = session.game;
    return {
      ...game,
      undoAvailable: undoStack.length > 0,
      revision,
      serverNow: Date.now(),
      connectedTeamIds: this.connectedTeamIds(session.code),
    };
  }

  private toPublicState(session: GameSession): PublicGameState {
    const { puzzle, revision } = session.game;
    const publicPuzzle = puzzle
      ? {
          category: puzzle.category,
          clue: puzzle.clue,
          guessedLetters: puzzle.guessedLetters,
          maskedAnswer: Array.from(puzzle.answer).map((character) => {
            if (!PLAYABLE_LETTER.test(character)) return character;
            return puzzle.guessedLetters.includes(character) ? character : null;
          }),
        }
      : null;
    return {
      teams: session.game.teams.map((team) => ({
        id: team.id,
        name: team.name,
        points: team.points,
        roundPoints: team.roundPoints,
        color: team.color,
      })),
      activeTeamId: session.game.activeTeamId,
      phase: session.game.phase,
      round: session.game.round,
      currentSectorId: session.game.currentSectorId,
      winnerTeamId: session.game.winnerTeamId,
      correctGuessStreak: session.game.correctGuessStreak,
      statusMessage: session.game.statusMessage,
      statusTone: session.game.statusTone,
      history: session.game.history,
      spin: session.game.spin,
      puzzle: publicPuzzle,
      revision,
      serverNow: Date.now(),
      connectedTeamIds: this.connectedTeamIds(session.code),
    };
  }
}

const PLAYABLE_LETTER = /^[А-ЯЁ]$/u;
