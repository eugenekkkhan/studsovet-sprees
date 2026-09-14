import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { TelegramUser } from './types';

/** Проверяет данные официального Telegram Login Widget для обычного браузера. */
export const verifyTelegramLogin = (
  value: unknown,
  botToken: string,
  maxAgeSeconds = 10 * 60,
  now = Date.now(),
): TelegramUser | null => {
  if (!value || typeof value !== 'object' || !botToken) return null;
  const payload = value as Record<string, unknown>;
  const hash = String(payload.hash ?? '').toLowerCase();
  if (!/^[\da-f]{64}$/.test(hash)) return null;

  const authDate = Number(payload.auth_date);
  const id = Number(payload.id);
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isFinite(authDate)) return null;
  if (authDate <= 0 || now / 1000 - authDate > maxAgeSeconds) return null;

  const checkString = Object.entries(payload)
    .filter(([key, item]) => key !== 'hash' && item !== undefined && item !== null)
    .map(([key, item]) => [key, String(item)] as const)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${key}=${item}`)
    .join('\n');
  const secret = createHash('sha256').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(checkString).digest();
  const received = Buffer.from(hash, 'hex');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  return {
    id,
    first_name: String(payload.first_name ?? ''),
    last_name: String(payload.last_name ?? ''),
    username: String(payload.username ?? ''),
    photo_url: String(payload.photo_url ?? ''),
  };
};
