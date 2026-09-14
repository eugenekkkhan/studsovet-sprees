import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { env } from '../env';
import { sanitizeDeckDraft } from '../quiz/deck';
import type { Deck } from '../quiz/types';
import { JsonStore } from '../storage/json-store';
import { MediaStorage } from '../media/media.storage';
import { DatabaseService } from '../database/database.service';

/** Приватная колода видна только автору, опубликованная — всем вошедшим. */
export type DeckVisibility = 'private' | 'published';

export interface DeckAuthor {
  id: number;
  name: string;
}

export interface StoredDeck {
  deck: Deck;
  updatedAt: number;
  visibility: DeckVisibility;
  author: DeckAuthor;
  shareActive?: boolean;
  shareAllowCopy?: boolean;
  shareViews?: number;
  shareCopies?: number;
  /** Когда колоду открывали по ссылке в последний раз. */
  shareLastViewedAt?: number | null;
  /** Хранится только хеш кода и только на сервере — клиенту он не уезжает. */
  shareTokenHash?: string;
}

interface DeckFile {
  decks: StoredDeck[];
}

/** Проекция для получателя ссылки — без служебных полей автора. */
export interface SharedDeckView {
  deck: Deck;
  updatedAt: number;
  author: DeckAuthor;
}

/** Сколько колод и какого объёма разрешаем одному автору. */
const MAX_DECKS = 60;
export const MAX_DECK_BYTES = 2 * 1024 * 1024;

const DECKS_DIRECTORY = 'decks';

/** Файл на автора: правка одной колоды не переписывает чужие. */
const fileFor = (userId: number) =>
  `${DECKS_DIRECTORY}/${userId < 0 ? 'dev' : 'tg'}-${Math.abs(userId)}.json`;

/** Обратный разбор имени файла: по каталогу собираем общую библиотеку. */
const userIdFromFile = (name: string) => {
  const match = /^(dev|tg)-(\d+)\.json$/.exec(name);
  if (!match) return null;
  const value = Number(match[2]);
  if (!Number.isFinite(value)) return null;
  return match[1] === 'dev' ? -value : value;
};

/** Кто видит чужие приватные колоды. Список тот же, что у доступа к боту. */
export const isDeckAdmin = (userId: number) => env.adminIds.includes(userId);

@Injectable()
export class DecksService implements OnModuleInit {
  private readonly stores = new Map<number, JsonStore<DeckFile>>();
  private migration: Promise<void> | null = null;

  constructor(
    @Optional() private readonly media?: MediaStorage,
    @Optional() private readonly database?: DatabaseService,
  ) {}

  async onModuleInit() {
    await this.ensureJsonImported();
  }

  async list(userId: number): Promise<StoredDeck[]> {
    if (this.database?.enabled) {
      await this.ensureJsonImported();
      const result = await this.database.query(
        'SELECT * FROM decks WHERE owner_id = $1 ORDER BY updated_at DESC',
        [userId],
      );
      return result.rows.map(rowToStoredDeck);
    }
    return [...this.store(userId).read().decks]
      .map((item) => publicDeck(normalize(item, userId)))
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  async get(userId: number, deckId: string): Promise<StoredDeck> {
    if (this.database?.enabled) {
      await this.ensureJsonImported();
      const result = await this.database.query(
        'SELECT * FROM decks WHERE owner_id = $1 AND deck_id = $2',
        [userId, deckId],
      );
      if (!result.rows[0]) throw new NotFoundException('Колода не найдена.');
      return rowToStoredDeck(result.rows[0]);
    }
    const found = this.store(userId)
      .read()
      .decks.find((item) => item.deck.id === deckId);
    if (!found) throw new NotFoundException('Колода не найдена.');
    return publicDeck(normalize(found, userId));
  }

  /**
   * Общая библиотека: опубликованные колоды всех авторов. Администратор
   * дополнительно видит приватные — иначе он не может проверить, что залито.
   */
  async library(viewer: DeckAuthor): Promise<{ decks: StoredDeck[]; isAdmin: boolean }> {
    const admin = isDeckAdmin(viewer.id);
    if (this.database?.enabled) {
      await this.ensureJsonImported();
      const result = await this.database.query(
        `SELECT * FROM decks
         WHERE visibility = 'published' OR owner_id = $1 OR $2::boolean
         ORDER BY updated_at DESC`,
        [viewer.id, admin],
      );
      return { decks: result.rows.map(rowToStoredDeck), isAdmin: admin };
    }
    const decks: StoredDeck[] = [];

    for (const authorId of this.knownAuthors()) {
      for (const item of this.store(authorId).read().decks) {
        const entry = normalize(item, authorId);
        const own = authorId === viewer.id;
        if (entry.visibility === 'published' || admin || own) decks.push(publicDeck(entry));
      }
    }

    return {
      decks: decks.sort((left, right) => right.updatedAt - left.updatedAt),
      isAdmin: admin,
    };
  }

  /** Создаёт или заменяет колоду автора. Клиент присылает её целиком. */
  async save(
    author: DeckAuthor,
    deckId: string,
    value: unknown,
    visibility?: DeckVisibility,
  ): Promise<StoredDeck> {
    const deck = sanitizeDeckDraft(value);
    if (!deck) throw new BadRequestException('Это не похоже на колоду.');
    if (deckId) deck.id = deckId;

    // Видимость сохраняется между правками: опубликованная не станет приватной
    // от обычного сохранения — только от явной смены.
    const previous = this.database?.enabled
      ? await this.findDatabaseDeck(author.id, deck.id)
      : this.store(author.id).read().decks.find((item) => item.deck.id === deck.id);
    const removedMedia = previous
      ? [...mediaUrls(previous.deck)].filter((url) => !mediaUrls(deck).has(url))
      : [];
    const entry: StoredDeck = {
      deck,
      updatedAt: Date.now(),
      visibility: visibility ?? previous?.visibility ?? 'private',
      author,
      shareTokenHash: previous?.shareTokenHash,
      shareActive: previous?.shareActive,
      shareAllowCopy: previous?.shareAllowCopy,
      shareViews: previous?.shareViews,
      shareCopies: previous?.shareCopies,
      shareLastViewedAt: previous?.shareLastViewedAt,
    };
    if (JSON.stringify(entry).length > MAX_DECK_BYTES) {
      throw new BadRequestException(
        'Колода слишком большая. Загружайте картинки и звук файлами — ссылки весят меньше.',
      );
    }

    if (this.database?.enabled) {
      await this.ensureJsonImported();
      const count = await this.database.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM decks WHERE owner_id = $1',
        [author.id],
      );
      if (!previous && Number(count.rows[0]?.count ?? 0) >= MAX_DECKS) {
        throw new BadRequestException(`Больше ${MAX_DECKS} колод не храним — удалите ненужные.`);
      }
      await this.database.query(
        `INSERT INTO decks (owner_id, deck_id, author_name, visibility, content)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (owner_id, deck_id) DO UPDATE SET
           author_name = EXCLUDED.author_name,
           visibility = EXCLUDED.visibility,
           content = EXCLUDED.content,
           updated_at = now()`,
        [author.id, deck.id, author.name, entry.visibility, JSON.stringify(deck)],
      );
    } else this.store(author.id).update((current) => {
      const rest = current.decks.filter((item) => item.deck.id !== deck.id);
      if (rest.length >= MAX_DECKS) {
        throw new BadRequestException(
          `Больше ${MAX_DECKS} колод не храним — удалите ненужные.`,
        );
      }
      return { decks: [...rest, entry] };
    });

    await this.removeUnusedMedia(removedMedia);

    return entry;
  }

  async setVisibility(userId: number, deckId: string, visibility: DeckVisibility) {
    if (this.database?.enabled) {
      await this.ensureJsonImported();
      const result = await this.database.query(
        `UPDATE decks SET visibility = $3, updated_at = now()
         WHERE owner_id = $1 AND deck_id = $2 RETURNING *`,
        [userId, deckId, visibility],
      );
      if (!result.rows[0]) throw new NotFoundException('Колода не найдена.');
      return rowToStoredDeck(result.rows[0]);
    }
    let updated: StoredDeck | null = null;
    this.store(userId).update((current) => ({
      decks: current.decks.map((item) => {
        if (item.deck.id !== deckId) return item;
        updated = { ...normalize(item, userId), visibility };
        return updated;
      }),
    }));
    if (!updated) throw new NotFoundException('Колода не найдена.');
    return publicDeck(updated as StoredDeck);
  }

  /**
   * Забирает чужую колоду себе. Копия своя во всём: новый id, свой автор и
   * приватность по умолчанию — правки копии оригинала не касаются.
   */
  async copyToOwn(viewer: DeckAuthor, authorId: number, deckId: string): Promise<StoredDeck> {
    const source = this.database?.enabled
      ? await this.findDatabaseDeck(authorId, deckId)
      : this.store(authorId).read().decks.find((item) => item.deck.id === deckId);
    if (!source) throw new NotFoundException('Колода не найдена.');

    const entry = normalize(source, authorId);
    if (entry.visibility !== 'published' && !isDeckAdmin(viewer.id)) {
      throw new NotFoundException('Колода не найдена.');
    }

    const copy: Deck = {
      ...entry.deck,
      id: randomUUID(),
      name: `${entry.deck.name} (копия)`.slice(0, 120),
      // В поле автора колоды остаётся тот, кто её составил.
      author: entry.deck.author || entry.author.name,
    };
    return this.save(viewer, copy.id, copy, 'private');
  }

  async remove(userId: number, deckId: string) {
    if (this.database?.enabled) {
      await this.ensureJsonImported();
      const result = await this.database.query(
        'DELETE FROM decks WHERE owner_id = $1 AND deck_id = $2 RETURNING content',
        [userId, deckId],
      );
      if (!result.rows[0]) throw new NotFoundException('Колода не найдена.');
      await this.removeUnusedMedia([...mediaUrls(result.rows[0].content as Deck)]);
      return { ok: true };
    }
    let removed = false;
    let removedMedia: string[] = [];
    this.store(userId).update((current) => {
      const target = current.decks.find((item) => item.deck.id === deckId);
      if (target) removedMedia = [...mediaUrls(target.deck)];
      const decks = current.decks.filter((item) => item.deck.id !== deckId);
      removed = decks.length !== current.decks.length;
      return { decks };
    });
    if (!removed) throw new NotFoundException('Колода не найдена.');
    await this.removeUnusedMedia(removedMedia);
    return { ok: true };
  }

  /**
   * Выдаёт новый код доступа. Первая выдача обнуляет счётчики, смена кода их
   * сохраняет: доступ тот же, просто старые ссылки перестают работать.
   */
  async issueShare(userId: string | number, deckId: string, allowCopy: boolean) {
    const owner = Number(userId);
    // 18 байт — 24 символа base64url: подобрать перебором нереально, а строка
    // всё ещё умещается в ссылку и читается вслух по телефону.
    const code = randomBytes(18).toString('base64url');
    const hash = shareHash(code);

    if (this.database?.enabled) {
      await this.ensureJsonImported();
      const result = await this.database.query(
        `UPDATE decks SET
           share_token_hash = $3,
           share_allow_copy = $4,
           share_views = CASE WHEN share_token_hash IS NULL THEN 0 ELSE share_views END,
           share_copies = CASE WHEN share_token_hash IS NULL THEN 0 ELSE share_copies END,
           share_last_viewed_at =
             CASE WHEN share_token_hash IS NULL THEN NULL ELSE share_last_viewed_at END
         WHERE owner_id = $1 AND deck_id = $2 RETURNING *`,
        [owner, deckId, hash, allowCopy],
      );
      if (!result.rows[0]) throw new NotFoundException('Колода не найдена.');
      return { code, deck: rowToStoredDeck(result.rows[0]) };
    }

    const deck = this.mutateOwn(owner, deckId, (entry) => {
      const rotation = Boolean(entry.shareTokenHash);
      return {
        ...entry,
        shareTokenHash: hash,
        shareActive: true,
        shareAllowCopy: allowCopy,
        shareViews: rotation ? (entry.shareViews ?? 0) : 0,
        shareCopies: rotation ? (entry.shareCopies ?? 0) : 0,
        shareLastViewedAt: rotation ? (entry.shareLastViewedAt ?? null) : null,
      };
    });
    return { code, deck: publicDeck(deck) };
  }

  /** Разрешение на копию меняется само по себе — код при этом остаётся прежним. */
  async setShareOptions(userId: number, deckId: string, allowCopy: boolean) {
    if (this.database?.enabled) {
      await this.ensureJsonImported();
      const result = await this.database.query(
        `UPDATE decks SET share_allow_copy = $3 WHERE owner_id = $1 AND deck_id = $2
         RETURNING *`,
        [userId, deckId, allowCopy],
      );
      if (!result.rows[0]) throw new NotFoundException('Колода не найдена.');
      return rowToStoredDeck(result.rows[0]);
    }
    return publicDeck(
      this.mutateOwn(userId, deckId, (entry) => ({ ...entry, shareAllowCopy: allowCopy })),
    );
  }

  /**
   * Отзывает доступ. Счётчики остаются: автору важно видеть, что по ссылке
   * ходили, даже когда она уже закрыта.
   */
  async revokeShare(userId: number, deckId: string) {
    if (this.database?.enabled) {
      await this.ensureJsonImported();
      const result = await this.database.query(
        `UPDATE decks SET share_token_hash = NULL WHERE owner_id = $1 AND deck_id = $2
         RETURNING *`,
        [userId, deckId],
      );
      if (!result.rows[0]) throw new NotFoundException('Колода не найдена.');
      return rowToStoredDeck(result.rows[0]);
    }
    return publicDeck(
      this.mutateOwn(userId, deckId, (entry) => ({
        ...entry,
        shareTokenHash: undefined,
        shareActive: false,
      })),
    );
  }

  /** Открытие по коду: считаем просмотр и отдаём колоду без служебных полей. */
  async accessShare(code: string) {
    const found = await this.findShare(code, true);
    return { deck: sharedView(found), allowCopy: found.shareAllowCopy !== false };
  }

  async copyShare(viewer: DeckAuthor, code: string) {
    const source = await this.findShare(code, false);
    if (source.shareAllowCopy === false) {
      throw new ForbiddenException('Автор запретил копирование этой колоды.');
    }

    const copy: Deck = {
      ...source.deck,
      id: randomUUID(),
      name: `${source.deck.name} (копия)`.slice(0, 120),
      // Автором внутри колоды остаётся тот, кто её составил.
      author: source.deck.author || source.author.name,
    };
    const saved = await this.save(viewer, copy.id, copy, 'private');
    await this.countShareCopy(code);
    return saved;
  }

  /** Находит колоду по коду. Сравнивается только хеш — сам код нигде не лежит. */
  private async findShare(code: string, countView: boolean): Promise<StoredDeck> {
    const hash = shareHash(code);

    if (this.database?.enabled) {
      await this.ensureJsonImported();
      const result = countView
        ? await this.database.query(
            `UPDATE decks SET share_views = share_views + 1, share_last_viewed_at = now()
             WHERE share_token_hash = $1 RETURNING *`,
            [hash],
          )
        : await this.database.query('SELECT * FROM decks WHERE share_token_hash = $1', [hash]);
      if (!result.rows[0]) throw new NotFoundException('Ссылка недействительна или отозвана.');
      return rowToStoredDeck(result.rows[0]);
    }

    for (const authorId of this.knownAuthors()) {
      const target = this.store(authorId)
        .read()
        .decks.find((item) => item.shareTokenHash === hash);
      if (!target) continue;
      if (!countView) return normalize(target, authorId);
      return this.mutateOwn(authorId, target.deck.id, (entry) => ({
        ...entry,
        shareViews: (entry.shareViews ?? 0) + 1,
        shareLastViewedAt: Date.now(),
      }));
    }
    throw new NotFoundException('Ссылка недействительна или отозвана.');
  }

  private async countShareCopy(code: string) {
    const hash = shareHash(code);
    if (this.database?.enabled) {
      await this.database.query(
        'UPDATE decks SET share_copies = share_copies + 1 WHERE share_token_hash = $1',
        [hash],
      );
      return;
    }
    for (const authorId of this.knownAuthors()) {
      const target = this.store(authorId)
        .read()
        .decks.find((item) => item.shareTokenHash === hash);
      if (!target) continue;
      this.mutateOwn(authorId, target.deck.id, (entry) => ({
        ...entry,
        shareCopies: (entry.shareCopies ?? 0) + 1,
      }));
      return;
    }
  }

  /** Правка одной своей колоды в файловом режиме — через запись всего файла. */
  private mutateOwn(
    userId: number,
    deckId: string,
    mutate: (entry: StoredDeck) => StoredDeck,
  ): StoredDeck {
    let updated: StoredDeck | undefined;
    this.store(userId).update((current) => ({
      decks: current.decks.map((item) => {
        if (item.deck.id !== deckId) return item;
        updated = mutate(normalize(item, userId));
        return updated;
      }),
    }));
    if (!updated) throw new NotFoundException('Колода не найдена.');
    return updated;
  }

  /** Хеш-файл удаляем лишь когда ни одна сохранённая колода на него не ссылается. */
  private async removeUnusedMedia(candidates: string[]) {
    if (!this.media || candidates.length === 0) return;
    const used = new Set<string>();
    if (this.database?.enabled) {
      const result = await this.database.query('SELECT content FROM decks');
      for (const row of result.rows) {
        for (const url of mediaUrls(row.content as Deck)) used.add(url);
      }
    } else {
      for (const authorId of this.knownAuthors()) {
        for (const item of this.store(authorId).read().decks) {
          for (const url of mediaUrls(item.deck)) used.add(url);
        }
      }
    }
    for (const url of candidates) {
      if (!used.has(url)) this.media.removeUrl(url);
    }
  }

  private async findDatabaseDeck(userId: number, deckId: string) {
    await this.ensureJsonImported();
    const result = await this.database!.query(
      'SELECT * FROM decks WHERE owner_id = $1 AND deck_id = $2',
      [userId, deckId],
    );
    return result.rows[0] ? rowToStoredDeck(result.rows[0]) : undefined;
  }

  /** Однократный безопасный импорт старых файлов; ON CONFLICT не перетирает БД. */
  private ensureJsonImported() {
    if (!this.database?.enabled) return Promise.resolve();
    if (this.migration) return this.migration;
    this.migration = (async () => {
      for (const authorId of this.knownAuthors()) {
        for (const raw of this.store(authorId).read().decks) {
          const item = normalize(raw, authorId);
          await this.database!.query(
            `INSERT INTO decks (owner_id, deck_id, author_name, visibility, content, updated_at)
             VALUES ($1, $2, $3, $4, $5::jsonb, to_timestamp($6 / 1000.0))
             ON CONFLICT (owner_id, deck_id) DO NOTHING`,
            [authorId, item.deck.id, item.author.name, item.visibility, JSON.stringify(item.deck), item.updatedAt],
          );
        }
      }
    })();
    return this.migration;
  }

  private knownAuthors(): number[] {
    const directory = resolve(join(env.dataDir, DECKS_DIRECTORY));
    if (!existsSync(directory)) return [];
    return readdirSync(directory)
      .map(userIdFromFile)
      .filter((id): id is number => id !== null);
  }

  private store(userId: number) {
    const existing = this.stores.get(userId);
    if (existing) return existing;
    const store = new JsonStore<DeckFile>(fileFor(userId), () => ({ decks: [] }));
    this.stores.set(userId, store);
    return store;
  }
}

/** Записи, сделанные до появления видимости и автора, дочитываем на лету. */
const normalize = (item: StoredDeck, authorId: number): StoredDeck => ({
  ...item,
  visibility: item.visibility === 'published' ? 'published' : 'private',
  // Доступ жив ровно до тех пор, пока лежит хеш кода.
  shareActive: Boolean(item.shareTokenHash),
  author: item.author?.name
    ? item.author
    : { id: authorId, name: item.deck.author || 'Без имени' },
});

const rowToStoredDeck = (row: Record<string, unknown>): StoredDeck => ({
  deck: row.content as Deck,
  updatedAt: new Date(String(row.updated_at)).getTime(),
  visibility: row.visibility === 'published' ? 'published' : 'private',
  author: {
    id: Number(row.owner_id),
    name: String(row.author_name ?? ''),
  },
  shareActive: Boolean(row.share_token_hash),
  shareAllowCopy: row.share_allow_copy !== false,
  shareViews: Number(row.share_views ?? 0),
  shareCopies: Number(row.share_copies ?? 0),
  shareLastViewedAt: row.share_last_viewed_at
    ? new Date(String(row.share_last_viewed_at)).getTime()
    : null,
});

const publicDeck = (entry: StoredDeck): StoredDeck => {
  const { shareTokenHash: _secret, ...safe } = entry;
  return safe;
};

/**
 * Что видит получатель ссылки: сама колода и кто её автор. Счётчики открытий,
 * видимость и хеш кода — дело автора, наружу они не уезжают.
 */
const sharedView = (entry: StoredDeck): SharedDeckView => ({
  deck: entry.deck,
  updatedAt: entry.updatedAt,
  author: { id: entry.author.id, name: entry.author.name },
});

const shareHash = (code: string) =>
  createHash('sha256').update(code.trim()).digest('hex');

/** Собирает ссылки из всех вопросов и финала без привязки к форме колоды. */
const mediaUrls = (deck: Deck) => {
  const urls = new Set<string>();
  const add = (media: { url?: string } | null | undefined) => {
    if (media?.url) urls.add(media.url);
  };
  for (const round of deck.rounds) {
    for (const theme of round.themes) {
      for (const question of theme.questions) {
        add(question.media);
        add(question.answerMedia);
      }
    }
  }
  for (const theme of deck.finalThemes) {
    add(theme.media);
    add(theme.answerMedia);
  }
  return urls;
};
