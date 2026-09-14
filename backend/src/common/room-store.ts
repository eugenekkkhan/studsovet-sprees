import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { env } from '../env';
import { JsonStore } from '../storage/json-store';

/** Сохранение отложено: иначе каждое нажатие кнопки пишет колоду целиком. */
const DEBOUNCE_MS = 1500;

/** Общая часть комнаты, одинаковая у «Своей игры» и «Поля чудес». */
export interface RoomIdentity {
  code: string;
  hostToken: string;
  hostJoinKey: string;
  ownerUserId: number | null;
  createdAt: number;
  lastActivityAt: number;
}

export interface RoomSession<TGame> extends RoomIdentity {
  game: TGame;
}

/** На диск едет всё, кроме стека отмен. */
export type RoomSnapshot<TGame> = RoomIdentity & { game: Omit<TGame, 'undoStack'> };

/**
 * Комнаты на диске: файл на комнату, чтобы правка одной не трогала другие.
 * Стек отмен не сохраняется — колода занимает почти весь объём, а история
 * отмен переживать перезапуск не обязана. Важно другое: после рестарта
 * сохраняется код комнаты, а значит розданные ссылки и QR остаются рабочими.
 */
export class RoomStore<TGame extends { undoStack: unknown[] }> {
  private readonly stores = new Map<string, JsonStore<RoomSnapshot<TGame> | null>>();
  private readonly pending = new Map<string, NodeJS.Timeout>();

  /** @param directory подкаталог в `DATA_DIR`, свой у каждой игры. */
  constructor(private readonly directory: string) {}

  /** Откладывает запись: подряд идущие команды складываются в одну. */
  save(session: RoomSession<TGame>) {
    const existing = this.pending.get(session.code);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => this.flush(session), DEBOUNCE_MS);
    timer.unref?.();
    this.pending.set(session.code, timer);
  }

  /** Пишет немедленно: начало раунда, загрузка колоды, остановка сервера. */
  flush(session: RoomSession<TGame>) {
    const timer = this.pending.get(session.code);
    if (timer) clearTimeout(timer);
    this.pending.delete(session.code);
    try {
      const { undoStack: _undoStack, ...game } = session.game;
      this.storeFor(session.code).write({
        code: session.code,
        hostToken: session.hostToken,
        hostJoinKey: session.hostJoinKey,
        ownerUserId: session.ownerUserId,
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
        game: game as Omit<TGame, 'undoStack'>,
      });
    } catch {
      // Диск недоступен — игра важнее снимка, продолжаем в памяти.
    }
  }

  forget(code: string) {
    const timer = this.pending.get(code);
    if (timer) clearTimeout(timer);
    this.pending.delete(code);
    this.stores.delete(code);
    try {
      rmSync(resolve(join(env.dataDir, this.fileFor(code))), { force: true });
    } catch {
      // Файла может не быть — это не ошибка.
    }
  }

  /** Комнаты с прошлого запуска. Просроченные вызывающий отсеивает сам. */
  loadAll(): RoomSession<TGame>[] {
    const directory = this.path();
    if (!existsSync(directory)) return [];
    const sessions: RoomSession<TGame>[] = [];
    for (const entry of readdirSync(directory)) {
      if (!entry.endsWith('.json') || entry.endsWith('.tmp')) continue;
      const code = entry.slice(0, -'.json'.length);
      const snapshot = this.storeFor(code).read();
      if (snapshot?.code !== code || !snapshot.game) continue;
      sessions.push({
        ...snapshot,
        ownerUserId: snapshot.ownerUserId ?? null,
        // Стек отмен не сохраняется: комната поднимается без истории.
        game: { ...snapshot.game, undoStack: [] } as unknown as TGame,
      });
    }
    return sessions;
  }

  private path() {
    return resolve(join(env.dataDir, this.directory));
  }

  private fileFor(code: string) {
    return `${this.directory}/${code}.json`;
  }

  private storeFor(code: string) {
    const existing = this.stores.get(code);
    if (existing) return existing;
    const directory = this.path();
    if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
    const store = new JsonStore<RoomSnapshot<TGame> | null>(
      this.fileFor(code),
      () => null,
    );
    this.stores.set(code, store);
    return store;
  }
}
