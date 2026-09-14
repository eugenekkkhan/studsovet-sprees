import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Читает `.env` рядом с бэкендом. Своя пара десятков строк вместо зависимости:
 * формат простой, а переменные окружения самой машины всегда главнее файла.
 */
const loadEnvFile = () => {
  const file = resolve(process.env.ENV_FILE ?? join(process.cwd(), '.env'));
  if (!existsSync(file)) return;

  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([\w.-]+)\s*=\s*(.*)$/.exec(line);
    if (!match || line.trimStart().startsWith('#')) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    const value = rawValue.trim();
    const quoted = /^(['"])(.*)\1$/.exec(value);
    process.env[key] = quoted ? quoted[2] : value;
  }
};

loadEnvFile();

const list = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const flag = (value: string | undefined, fallback: boolean) => {
  const raw = (value ?? '').trim().toLowerCase();
  if (raw === '') return fallback;
  return !['0', 'false', 'off', 'no'].includes(raw);
};

/** Число из окружения с границами: мусор и выход за рамки берут значение по умолчанию. */
const bounded = (
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) => {
  const raw = (value ?? '').trim();
  // `Number('')` — это ноль, поэтому пустое значение отсеиваем до разбора:
  // иначе незаполненная строка в `.env` тихо прижималась бы к минимуму.
  if (raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
};

const numbers = (value: string | undefined) =>
  list(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));

const botToken = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();

/**
 * Настройки берём из окружения один раз при старте. Без токена бота приложение
 * поднимается в режиме разработки: вход по имени, доступ никто не проверяет.
 */
export const env = Object.freeze({
  /** PostgreSQL для постоянных данных; без URL локально остаётся JSON-хранилище. */
  databaseUrl: (process.env.DATABASE_URL ?? '').trim(),
  botToken,
  /** Есть токен — значит, работаем «по-взрослому»: пускаем только через Telegram. */
  telegramEnabled: botToken !== '',
  /** Ссылка на мини-приложение: её бот присылает в чат. */
  miniAppUrl: (process.env.MINI_APP_URL ?? '').trim().replace(/\/$/, ''),
  /** Чаты, которым доступ открыт всегда, даже если бота туда добавили до запуска. */
  allowedChatIds: numbers(process.env.TELEGRAM_ALLOWED_CHAT_IDS),
  /** Личные id, которым доступ открыт без всяких чатов, — обычно это вы сами. */
  adminIds: numbers(process.env.TELEGRAM_ADMIN_IDS),
  /** Опрос обновлений бота. Выключите на втором процессе: Telegram отдаёт их только одному. */
  polling: flag(process.env.TELEGRAM_POLLING, true),
  /** HTTP(S)-прокси только для Telegram Bot API; остальной сервер ходит напрямую. */
  telegramProxyUrl: (process.env.TELEGRAM_PROXY_URL ?? '').trim(),
  /** Вход без Telegram — по умолчанию только пока не настроен бот. */
  devAuth: flag(process.env.ALLOW_DEV_AUTH, botToken === ''),
  /** Временный защищённый вход для внешнего тестирования через публичный туннель. */
  testAuthKey: (process.env.TEST_AUTH_KEY ?? '').trim(),
  /**
   * Ключ подписи сессий. Без него токены живут до перезапуска: для разработки
   * это удобно, а на сервере значение нужно задать, иначе всех разлогинит.
   */
  sessionSecret:
    (process.env.SESSION_SECRET ?? '').trim() || randomBytes(32).toString('hex'),
  sessionSecretProvided: (process.env.SESSION_SECRET ?? '').trim() !== '',
  /** Срок жизни сессии: мини-приложение перевходит молча при каждом открытии. */
  sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS) || 12 * 60 * 60,
  /**
   * Кто может обращаться к серверу. Пустое значение означает «кто угодно»:
   * пустая строка в `.env` не должна закрывать доступ вообще всем.
   */
  frontendOrigins: list(process.env.FRONTEND_ORIGIN),
  /**
   * Собранный фронт. Если папка есть, сервер отдаёт её сам — приложению хватает
   * одного адреса, что и нужно мини-приложению Telegram.
   */
  staticDir: resolve(process.env.STATIC_DIR ?? join(process.cwd(), '..', 'dist')),
  /** Куда складывать колоды и список чатов. */
  dataDir: resolve(process.env.DATA_DIR ?? join(process.cwd(), 'data')),
  /**
   * Сколько крутится барабан «Поля чудес», мс. Это же значение уезжает клиентам
   * в состоянии вращения, поэтому анимация и момент остановки на сервере всегда
   * совпадают — менять достаточно здесь.
   */
  spinDurationMs: bounded(process.env.FIELD_SPIN_DURATION_MS, 4200, 500, 30000),
});

export type AppEnv = typeof env;
