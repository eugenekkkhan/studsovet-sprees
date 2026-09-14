/**
 * Часы телефона расходятся с серверными на секунды, а иногда и на минуты.
 * Сервер присылает дедлайны — например, конец блокировки за фальстарт —
 * в своих абсолютных миллисекундах, поэтому сравнивать их напрямую с
 * `Date.now()` нельзя: отсчёт у капитана будет врать ровно на расхождение.
 * Держим поправку и переводим серверное время в местное.
 */

/** Больше часа — это не рассинхрон часов, а мусор в данных или чужая эпоха. */
const MAX_SANE_OFFSET_MS = 60 * 60 * 1000;

let offsetMs = 0;

/**
 * Запоминает разницу между часами. Зовётся на каждом состоянии от сервера:
 * задержка сети смещает оценку в одну сторону, поэтому берём минимум по
 * модулю — самый быстрый ответ ближе всего к правде.
 */
export const noteServerTime = (serverNow: number | undefined) => {
  if (!Number.isFinite(serverNow) || !serverNow) return;
  const candidate = (serverNow as number) - Date.now();
  if (Math.abs(candidate) > MAX_SANE_OFFSET_MS) return;
  if (offsetMs === 0 || Math.abs(candidate) < Math.abs(offsetMs)) {
    offsetMs = candidate;
  }
};

export const serverOffset = () => offsetMs;

/** Серверный момент времени в местных миллисекундах. */
export const toLocalTime = (serverEpochMs: number) => serverEpochMs - offsetMs;

/** Сколько осталось до серверного дедлайна, не меньше нуля. */
export const msUntil = (serverEpochMs: number) =>
  Math.max(0, toLocalTime(serverEpochMs) - Date.now());

/** Только для тестов: сбрасывает накопленную поправку. */
export const resetServerClock = () => {
  offsetMs = 0;
};
