import { randomUUID } from 'node:crypto';
import type { Media } from '../types';

export const DECK_LIMITS = {
  rounds: 12,
  themesPerRound: 12,
  questionsPerTheme: 12,
  finalThemes: 12,
  name: 120,
  themeName: 120,
  text: 2000,
  answer: 500,
  comment: 1000,
  url: 2000,
  price: 100000,
} as const;

/** Однострочные поля: имена тем, названия колод. */
export const plainText = (value: unknown, limit: number) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);

/** Многострочный текст: переносы автора сохраняются. */
export const richText = (value: unknown, limit: number) =>
  String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, limit);

export const priceValue = (value: unknown, fallback: number) => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(DECK_LIMITS.price, Math.max(0, parsed));
};

export const mediaValue = (value: unknown): Media | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const url = plainText(candidate.url, DECK_LIMITS.url);
  if (!/^(https?:|data:|\/)/i.test(url)) return null;
  const type = candidate.type === 'audio' || candidate.type === 'video'
    ? candidate.type
    : 'image';
  return { url, type };
};

/** Держит идентификаторы уникальными в пределах одной колоды. */
export const uniqueId = (taken: Set<string>, candidate: unknown) => {
  const value = plainText(candidate, 64);
  if (/^[\w:-]{1,64}$/.test(value) && !taken.has(value)) {
    taken.add(value);
    return value;
  }
  const generated = randomUUID();
  taken.add(generated);
  return generated;
};
