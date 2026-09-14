/**
 * Скользящее окно на Map вместо зависимости: в проекте уже руками написаны
 * разбор `.env`, токены сессии и клиент Telegram API — сорок строк лимитера
 * укладываются в тот же стиль и не тянут пакет ради одного применения.
 */
export interface RateLimitOptions {
  /** Сколько обращений разрешено за окно. */
  points: number;
  windowMs: number;
}

export interface RateLimiter {
  /** true — пропускаем, false — предел исчерпан. */
  hit: (key: string) => boolean;
  forget: (key: string) => void;
  readonly size: number;
}

export const createLimiter = ({
  points,
  windowMs,
}: RateLimitOptions): RateLimiter => {
  const hits = new Map<string, number[]>();

  return {
    hit(key: string) {
      const now = Date.now();
      const since = now - windowMs;
      // Ленивая чистка: старые отметки выбрасываем при обращении к ключу,
      // отдельный сборщик ради этого держать незачем.
      const recent = (hits.get(key) ?? []).filter((at) => at > since);
      if (recent.length >= points) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
    forget(key: string) {
      hits.delete(key);
    },
    get size() {
      return hits.size;
    },
  };
};
