import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { MAX_DECK_BYTES } from '../decks/decks.service';
import { applyCommand, createInitialGameState } from './engine';
import {
  createTeamIdentity,
  ensureHostJoinKey,
  ensureTeamKeys,
  HOST_JOIN_KEY_LENGTH,
  makeKey,
  ROOM_CODE_LENGTH,
  sanitizeInitialTeams,
  TEAM_KEY_LENGTH,
  tokensMatch,
} from './session/keys';
import {
  denyParticipantCommand,
  toEngineCommand,
} from './session/participant-rules';
import { RoomStore } from '../common/room-store';
import { toHostState, toPublicState } from './session/projection';
import type {
  CommandResult,
  GameSession,
  StoredGameState,
  HostCommand,
  HostGameState,
  ParticipantCommand,
  PublicGameState,
  Team,
} from './types';

/** Комната без единого обращения столько времени считается брошенной. */
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
/** Потолок на процесс: комнату открывают вошедшие, но и их стоит ограничить. */
const MAX_ROOMS = 200;

/**
 * Команды, после которых снимок пишется сразу, не дожидаясь паузы: они
 * задают весь дальнейший ход игры, и терять их на падении обиднее всего.
 */
const FLUSH_AFTER = new Set<HostCommand['type']>([
  'LOAD_DECK',
  'START_ROUND',
  'START_FINAL',
  'END_ROUND',
  'NEW_GAME',
]);

/** Тот же потолок, что и у библиотеки колод: правило одно на оба пути. */
const deckTooHeavy = (deck: unknown) => {
  try {
    return Buffer.byteLength(JSON.stringify(deck) ?? '') > MAX_DECK_BYTES;
  } catch {
    // Циклическая ссылка в присланном объекте — колода в любом случае негодная.
    return true;
  }
};

/** Комнаты живут в памяти процесса — как и в «Поле чудес». */
@Injectable()
export class QuizService implements OnModuleInit, OnModuleDestroy {
  private readonly sessions = new Map<string, GameSession>();
  /** Владелец — проверенный пользователь сессии, а не строка с клиента. */
  private readonly sessionsByOwner = new Map<number, string>();
  private readonly sweeper: NodeJS.Timeout;

  // Поле, а не параметр конструктора: Nest тогда нечего внедрять, и служба
  // одинаково создаётся и приложением, и тестом.
  private readonly store = new RoomStore<StoredGameState>('quiz-rooms');

  constructor() {
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    // Сборщик не должен держать процесс живым сам по себе.
    this.sweeper.unref?.();
  }

  /**
   * Поднимает комнаты с прошлого запуска. Иначе рестарт сервера посреди игры
   * менял код комнаты, и розданные капитанам QR разом становились мусором.
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
   * Открывает комнату. Один владелец держит одну комнату: повторный вызов
   * возвращает ту же, чтобы перезагрузка страницы не плодила пустышки.
   */
  createSession(ownerUserId: number | null, initialTeams: Array<Partial<Team>> = []) {
    const existing =
      ownerUserId === null
        ? undefined
        : this.sessions.get(this.sessionsByOwner.get(ownerUserId) ?? '');
    if (existing) return this.describeSession(this.touch(existing));

    if (this.sessions.size >= MAX_ROOMS) {
      // Сначала пробуем освободить место просроченными, и только потом отказываем.
      this.sweep();
      if (this.sessions.size >= MAX_ROOMS) return null;
    }

    let code = makeKey(ROOM_CODE_LENGTH);
    while (this.sessions.has(code)) code = makeKey(ROOM_CODE_LENGTH);
    const now = Date.now();
    const session: GameSession = {
      code,
      hostToken: randomBytes(32).toString('hex'),
      hostJoinKey: makeKey(HOST_JOIN_KEY_LENGTH),
      ownerUserId,
      game: createInitialGameState(sanitizeInitialTeams(initialTeams)),
      createdAt: now,
      lastActivityAt: now,
    };
    this.sessions.set(code, session);
    if (ownerUserId !== null) this.sessionsByOwner.set(ownerUserId, code);
    this.store.flush(session);
    return this.describeSession(session);
  }

  /** Убирает комнаты, к которым давно никто не обращался. */
  sweep(now = Date.now()) {
    for (const [code, session] of this.sessions) {
      if (now - session.lastActivityAt <= ROOM_TTL_MS) continue;
      this.sessions.delete(code);
      if (session.ownerUserId !== null && this.sessionsByOwner.get(session.ownerUserId) === code) {
        this.sessionsByOwner.delete(session.ownerUserId);
      }
      this.store.forget(code);
    }
  }

  /** Только для тестов и диагностики. */
  get roomCount() {
    return this.sessions.size;
  }

  /** Без секретов ведущего: безопасная проекция для панели администрирования. */
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
    this.store.forget(normalized);
    return true;
  }

  getHostState(code: string, hostToken: string): HostGameState | null {
    const session = this.getSession(code);
    if (!session || !tokensMatch(session.hostToken, hostToken)) return null;
    return toHostState(this.touch(this.adopted(session)));
  }

  getHostStateByJoinKey(code: string, hostJoinKey: string): HostGameState | null {
    const session = this.getSession(code);
    const supplied = String(hostJoinKey ?? '').trim().toUpperCase();
    if (!session || supplied.length !== HOST_JOIN_KEY_LENGTH) return null;
    this.adopted(session);
    if (!tokensMatch(session.hostJoinKey, supplied)) return null;
    return toHostState(this.touch(session));
  }

  /** Проекция для сокета, чьи права ведущего уже проверены. */
  getHostStateForConnectedHost(code: string): HostGameState | null {
    const session = this.getSession(code);
    return session ? toHostState(session) : null;
  }

  getHostJoinKeyForConnectedHost(code: string) {
    return this.getSession(code)?.hostJoinKey ?? null;
  }

  getPublicState(code: string): PublicGameState | null {
    const session = this.getSession(code);
    return session ? toPublicState(session) : null;
  }

  getTeamIdByKey(code: string, joinKey: string) {
    const session = this.getSession(code);
    const supplied = String(joinKey ?? '').trim().toUpperCase();
    if (!session || supplied.length !== TEAM_KEY_LENGTH) return null;
    const teamId =
      session.game.teams.find((team) => tokensMatch(team.joinKey, supplied))?.id ??
      null;
    if (teamId) this.touch(session);
    return teamId;
  }

  runHostCommand(code: string, command: HostCommand): CommandResult {
    const session = this.getSession(code);
    if (!session) return { changed: false, error: 'Комната не найдена.' };
    const tooHeavy = command.type === 'LOAD_DECK' && deckTooHeavy(command.deck);
    if (tooHeavy) {
      return {
        changed: false,
        error:
          'Колода слишком тяжёлая. Загрузите картинки и звук файлами — ' +
          'в колоде останутся ссылки, и она станет в разы легче.',
      };
    }
    return this.run(session, command);
  }

  runParticipantCommand(
    code: string,
    teamId: string,
    command: ParticipantCommand,
  ): CommandResult {
    const session = this.getSession(code);
    if (!session) return { changed: false, error: 'Комната не найдена.' };
    const denial = denyParticipantCommand(session.game, teamId, command);
    if (denial) return { changed: false, error: denial };
    return this.run(session, toEngineCommand(command, teamId));
  }

  private run(session: GameSession, command: HostCommand): CommandResult {
    const next = applyCommand(session.game, command, {
      createTeamIdentity: () => createTeamIdentity(session),
      now: Date.now(),
    });
    if (!next) {
      return {
        changed: false,
        error: 'Действие сейчас недоступно или содержит неверные данные.',
      };
    }
    session.game = next;
    this.touch(session);
    if (FLUSH_AFTER.has(command.type)) this.store.flush(session);
    else this.store.save(session);
    return { changed: true };
  }

  private getSession(code: string) {
    return this.sessions.get(String(code ?? '').trim().toUpperCase());
  }

  private touch(session: GameSession) {
    session.lastActivityAt = Date.now();
    return session;
  }

  /**
   * Достраивает ключи комнате, пришедшей из прошлой версии сервера. Зовётся
   * только там, где комната появляется или подхватывается ведущим: чтение
   * состояния менять его не должно, иначе каждая рассылка двигает ревизию.
   */
  private adopted(session: GameSession) {
    ensureHostJoinKey(session);
    ensureTeamKeys(session);
    return session;
  }

  private describeSession(session: GameSession) {
    return {
      code: session.code,
      hostToken: session.hostToken,
      hostJoinKey: session.hostJoinKey,
      state: toHostState(this.adopted(session)),
    };
  }
}
