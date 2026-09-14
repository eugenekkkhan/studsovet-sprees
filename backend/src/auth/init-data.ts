import { createHmac, timingSafeEqual } from 'node:crypto';
import type { TelegramUser } from './types';

export interface InitData {
  user: TelegramUser;
  authDate: number;
  /** `startapp=...` из ссылки: им открываем нужный экран сразу. */
  startParam: string;
  /** Идентификатор чата, из которого запустили мини-приложение. */
  chatInstance: string;
}

const hexEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
};

/**
 * Проверка подписи `initData` по правилам Telegram: из всех полей, кроме `hash`,
 * собирается строка `ключ=значение`, отсортированная по ключу и склеенная
 * переводами строки. Её подписывают ключом HMAC(«WebAppData», токен бота).
 *
 * Подпись доказывает, что данные пришли от Telegram и не подменены, — на неё
 * и опирается весь доступ к приложению.
 */
export const verifyInitData = (
  raw: string,
  botToken: string,
  maxAgeSeconds = 24 * 60 * 60,
  now = Date.now(),
): InitData | null => {
  if (!raw || !botToken) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return null;
  }

  const hash = params.get('hash') ?? '';
  if (!/^[\da-f]{64}$/i.test(hash)) return null;

  const dataCheckString = [...params.entries()]
    // `signature` появился в новых клиентах Telegram. Для проверки через токен
    // бота он остаётся частью строки; исключается только итоговый `hash`.
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (!hexEqual(expected, hash.toLowerCase())) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  // Просроченная подпись — чаще всего чужая ссылка, сохранённая на будущее.
  if (maxAgeSeconds > 0 && now / 1000 - authDate > maxAgeSeconds) return null;

  let user: TelegramUser;
  try {
    user = JSON.parse(params.get('user') ?? '') as TelegramUser;
  } catch {
    return null;
  }
  if (!user || typeof user.id !== 'number' || !Number.isFinite(user.id)) return null;

  return {
    user,
    authDate,
    startParam: params.get('start_param') ?? '',
    chatInstance: params.get('chat_instance') ?? '',
  };
};
