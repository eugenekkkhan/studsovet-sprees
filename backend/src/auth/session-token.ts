import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SessionPayload } from './types';

const encode = (value: Buffer | string) =>
  Buffer.from(value as string).toString('base64url');

const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url');

/**
 * Своя маленькая подпись вместо библиотеки JWT: в токене только то, что нужно
 * серверу — кто пользователь и до какого момента ему верить.
 */
export const signSession = (payload: SessionPayload, secret: string) => {
  const body = encode(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
};

export const verifySession = (
  token: string,
  secret: string,
  now = Date.now(),
): SessionPayload | null => {
  const [body, signature] = String(token ?? '').split('.');
  if (!body || !signature) return null;

  const expected = sign(body, secret);
  if (expected.length !== signature.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as SessionPayload;
    if (typeof payload?.id !== 'number' || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 < now) return null;
    return payload;
  } catch {
    return null;
  }
};
