import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import type { MediaType } from '../quiz/types';

/** Что принимаем: картинки для вопросов и звук для музыкальных тем. */
const ALLOWED: Record<string, { extension: string; type: MediaType }> = {
  'image/png': { extension: 'png', type: 'image' },
  'image/jpeg': { extension: 'jpg', type: 'image' },
  'image/webp': { extension: 'webp', type: 'image' },
  'image/gif': { extension: 'gif', type: 'image' },
  'image/svg+xml': { extension: 'svg', type: 'image' },
  'audio/mpeg': { extension: 'mp3', type: 'audio' },
  'audio/ogg': { extension: 'ogg', type: 'audio' },
  'audio/wav': { extension: 'wav', type: 'audio' },
  'audio/x-wav': { extension: 'wav', type: 'audio' },
  'audio/mp4': { extension: 'm4a', type: 'audio' },
  'video/mp4': { extension: 'mp4', type: 'video' },
  'video/webm': { extension: 'webm', type: 'video' },
  'video/quicktime': { extension: 'mov', type: 'video' },
  'video/ogg': { extension: 'ogv', type: 'video' },
  'video/x-m4v': { extension: 'm4v', type: 'video' },
};

const CONTENT_TYPES = Object.entries(ALLOWED).reduce<Record<string, string>>(
  (map, [mime, { extension }]) => ({ ...map, [extension]: mime }),
  {},
);

/** Видео тяжелее картинок; ограничение также защищает memory-upload процесса. */
export const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;
export const MEDIA_ROUTE = '/media/files';

export interface StoredMedia {
  url: string;
  type: MediaType;
  name: string;
  bytes: number;
}

export interface IncomingFile {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
}

@Injectable()
export class MediaStorage {
  /** Каталог задаётся MEDIA_DIR; по умолчанию — `uploads` рядом с бэкендом. */
  private readonly directory = resolve(
    process.env.MEDIA_DIR ?? join(process.cwd(), 'uploads'),
  );

  constructor() {
    if (!existsSync(this.directory)) {
      mkdirSync(this.directory, { recursive: true });
    }
  }

  isAllowed(mimetype: string | undefined) {
    return Boolean(mimetype && ALLOWED[mimetype]);
  }

  get allowedTypes() {
    return Object.keys(ALLOWED);
  }

  /**
   * Кладёт файл на диск под именем-хешем: одинаковые картинки не плодятся,
   * а имя невозможно подобрать перебором.
   */
  save(file: IncomingFile): StoredMedia | null {
    const rule = file.mimetype ? ALLOWED[file.mimetype] : undefined;
    if (!rule || !file.buffer?.length || file.buffer.length > MAX_UPLOAD_BYTES) {
      return null;
    }

    const digest = createHash('sha256').update(file.buffer).digest('hex').slice(0, 32);
    const name = `${digest}.${rule.extension}`;
    const path = join(this.directory, name);
    if (!existsSync(path)) writeFileSync(path, file.buffer);

    return {
      // Ссылка относительная: колоду можно унести на другой сервер.
      url: `${MEDIA_ROUTE}/${name}`,
      type: rule.type,
      name,
      bytes: file.buffer.length,
    };
  }

  /** Путь к файлу по имени. Ничего, кроме собственных имён-хешей, не отдаём. */
  locate(name: string) {
    if (!/^[\da-f]{32}\.[a-z0-9]{2,4}$/i.test(name)) return null;
    const path = join(this.directory, name);
    if (!existsSync(path)) return null;
    const extension = extname(name).slice(1).toLowerCase();
    return { path, contentType: CONTENT_TYPES[extension] ?? 'application/octet-stream' };
  }

  /** Удаляет только файл, имя которого ранее выдал этот storage. */
  removeUrl(url: string) {
    const prefix = `${MEDIA_ROUTE}/`;
    if (!url.startsWith(prefix)) return false;
    const name = url.slice(prefix.length);
    const found = this.locate(name);
    if (!found) return false;
    unlinkSync(found.path);
    return true;
  }
}
