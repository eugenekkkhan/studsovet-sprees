import type { StoredGameState } from './game';

export interface GameSession {
  code: string;
  hostToken: string;
  /** Общий секрет для второго устройства ведущего. */
  hostJoinKey: string;
  /** Кто открыл комнату. Null — комната из режима разработки без входа. */
  ownerUserId: number | null;
  game: StoredGameState;
  createdAt: number;
  /** Последнее осмысленное действие: по нему комнату убирает сборщик. */
  lastActivityAt: number;
}

export type SocketIdentity =
  | { role: 'host'; code: string }
  | { role: 'participant'; code: string; teamId: string; participantId: string }
  | { role: 'spectator'; code: string };

export interface CommandResult {
  changed: boolean;
  error?: string;
}
