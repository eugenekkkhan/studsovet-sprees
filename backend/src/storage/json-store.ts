import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { env } from '../env';

/**
 * Файл с JSON вместо базы: данных мало, а разворачивать сервер БД ради списка
 * колод не хочется. Пишем через временный файл и `rename` — недописанный файл
 * не переживёт падение процесса и не испортит колоду.
 */
export class JsonStore<T> {
  private readonly path: string;
  private cache: T | null = null;
  private cachedAt = 0;

  constructor(
    relativePath: string,
    private readonly fallback: () => T,
  ) {
    this.path = resolve(join(env.dataDir, relativePath));
  }

  read(): T {
    // Файл могли поправить руками или из соседнего процесса — сверяем время правки.
    const changedAt = this.modifiedAt();
    if (this.cache !== null && changedAt === this.cachedAt) return this.cache;

    try {
      const raw = changedAt > 0 ? readFileSync(this.path, 'utf8') : '';
      this.cache = raw ? (JSON.parse(raw) as T) : this.fallback();
    } catch {
      // Битый файл не должен ронять сервер: начинаем с пустого состояния.
      this.cache = this.fallback();
    }
    this.cachedAt = changedAt;
    return this.cache;
  }

  write(value: T): T {
    this.cache = value;
    const directory = dirname(this.path);
    if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, JSON.stringify(value, null, 2), 'utf8');
    renameSync(temporary, this.path);
    this.cachedAt = this.modifiedAt();
    return value;
  }

  update(mutate: (current: T) => T): T {
    return this.write(mutate(this.read()));
  }

  private modifiedAt() {
    try {
      return statSync(this.path).mtimeMs;
    } catch {
      return 0;
    }
  }
}
