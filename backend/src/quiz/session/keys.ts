import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { GameSession, Team } from '../types';

/** Без похожих друг на друга символов: код диктуют голосом и вводят с телефона. */
export const ROOM_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 6;
export const TEAM_KEY_LENGTH = 10;
export const HOST_JOIN_KEY_LENGTH = 12;

const MAX_TEAMS = 12;
const DEFAULT_TEAM_COLOR = '#2563eb';

export const makeKey = (length: number) =>
  Array.from(
    randomBytes(length),
    (byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length],
  ).join('');

const matchesAlphabet = (value: string, length: number) =>
  new RegExp(`^[${ROOM_ALPHABET}]{${length}}$`).test(value);

/** Сравнение секретов за постоянное время. */
export const tokensMatch = (expected: string, supplied: string) => {
  const left = Buffer.from(String(expected ?? ''));
  const right = Buffer.from(String(supplied ?? ''));
  return left.length === right.length && timingSafeEqual(left, right);
};

export const uniqueTeamKey = (existingKeys: string[], preferred = '') => {
  const occupied = new Set(existingKeys);
  if (matchesAlphabet(preferred, TEAM_KEY_LENGTH) && !occupied.has(preferred)) {
    return preferred;
  }
  let key = makeKey(TEAM_KEY_LENGTH);
  while (occupied.has(key)) key = makeKey(TEAM_KEY_LENGTH);
  return key;
};

export const createTeamIdentity = (session: GameSession) => ({
  id: randomUUID(),
  joinKey: uniqueTeamKey(session.game.teams.map((team) => team.joinKey)),
});

/** Достраивает ключи командам, созданным более старой версией сервера. */
export const ensureTeamKeys = (session: GameSession) => {
  const occupied: string[] = [];
  let changed = false;
  session.game.teams = session.game.teams.map((team) => {
    const candidate = String(team.joinKey ?? '').trim().toUpperCase();
    const joinKey = uniqueTeamKey(occupied, candidate);
    occupied.push(joinKey);
    if (joinKey === candidate) return team;
    changed = true;
    return { ...team, joinKey };
  });
  if (changed) session.game.revision += 1;
};

export const ensureHostJoinKey = (session: GameSession) => {
  const candidate = String(session.hostJoinKey ?? '').trim().toUpperCase();
  session.hostJoinKey = matchesAlphabet(candidate, HOST_JOIN_KEY_LENGTH)
    ? candidate
    : makeKey(HOST_JOIN_KEY_LENGTH);
};

/** Команды, перенесённые клиентом из прошлой сессии. */
export const sanitizeInitialTeams = (
  initialTeams: Array<Partial<Team>>,
): Team[] => {
  if (!Array.isArray(initialTeams)) return [];
  const names = new Set<string>();
  const joinKeys: string[] = [];

  return initialTeams.slice(0, MAX_TEAMS).flatMap((candidate) => {
    const name = String(candidate?.name ?? '').trim().slice(0, 60);
    const normalizedName = name.toLocaleLowerCase('ru-RU');
    if (!name || names.has(normalizedName)) return [];
    names.add(normalizedName);

    const joinKey = uniqueTeamKey(
      joinKeys,
      String(candidate.joinKey ?? '').trim().toUpperCase(),
    );
    joinKeys.push(joinKey);
    const color = String(candidate.color ?? '');
    // Счёт мог приехать строкой из JSON — приводим до проверки, иначе теряем.
    const score = Number(candidate.score);

    return [
      {
        id: randomUUID(),
        joinKey,
        name,
        color: /^#[\da-f]{6}$/i.test(color) ? color : DEFAULT_TEAM_COLOR,
        score: Number.isFinite(score) ? Math.round(score) : 0,
      },
    ];
  });
};
