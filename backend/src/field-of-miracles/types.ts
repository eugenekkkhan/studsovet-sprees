export interface Team {
  id: string;
  name: string;
  points: number;
  roundPoints: number;
  color: string;
  /** Private credential. It is present only in the host projection. */
  joinKey: string;
}

export type PublicTeam = Omit<Team, 'joinKey'>;

export type GamePhase =
  | 'setup'
  | 'ready'
  | 'spinning'
  | 'awaiting-letter'
  | 'awaiting-position'
  | 'awaiting-special'
  | 'round-complete';

export type GameMessageTone = 'info' | 'success' | 'warning' | 'danger';

export interface Puzzle {
  category: string;
  clue: string;
  answer: string;
  guessedLetters: string[];
}

export interface PublicPuzzle {
  category: string;
  clue: string;
  /** One item per Unicode character. Null means a still-hidden letter. */
  maskedAnswer: Array<string | null>;
  guessedLetters: string[];
}

export interface GameLogEntry {
  id: number;
  message: string;
  tone: GameMessageTone;
}

export type SectorType =
  | 'points'
  | 'lose-turn'
  | 'bankrupt'
  | 'double'
  | 'plus'
  | 'friend'
  | 'prize'
  | 'task';

export interface Sector {
  id: string;
  label: string;
  type: SectorType;
  value?: number;
}

export interface SpinResult {
  id: string;
  /** Random 256-bit value issued by the backend and revealed to all clients. */
  seed: string;
  algorithm: 'sha256-v1';
  sectorId: string;
  sectorIndex: number;
  landingAngle: number;
  startedAt: number;
  durationMs: number;
  status: 'spinning' | 'settled';
}

export interface GameCoreState {
  teams: Team[];
  activeTeamId: string | null;
  phase: GamePhase;
  round: number;
  puzzle: Puzzle | null;
  currentSectorId: string | null;
  winnerTeamId: string | null;
  correctGuessStreak: number;
  statusMessage: string;
  statusTone: GameMessageTone;
  history: GameLogEntry[];
  spin: SpinResult | null;
}

export interface StoredGameState extends GameCoreState {
  undoStack: GameCoreState[];
  revision: number;
}

export interface HostGameState extends GameCoreState {
  undoAvailable: boolean;
  revision: number;
  /** Часы сервера на момент проекции: по ним клиент считает вращение. */
  serverNow: number;
  /** Команды, за которыми прямо сейчас сидит капитан. */
  connectedTeamIds: string[];
}

export interface PublicGameState extends Omit<GameCoreState, 'puzzle' | 'teams'> {
  teams: PublicTeam[];
  puzzle: PublicPuzzle | null;
  revision: number;
  /** Часы сервера на момент проекции: по ним клиент считает вращение. */
  serverNow: number;
  /** Команды, за которыми прямо сейчас сидит капитан. */
  connectedTeamIds: string[];
}

export type HostCommand =
  | { type: 'ADD_TEAM'; name: string; color: string }
  | { type: 'REMOVE_TEAM'; teamId: string }
  | { type: 'UPDATE_TEAM'; teamId: string; name: string; color: string }
  | { type: 'SET_TEAM_POINTS'; teamId: string; points: number }
  | { type: 'START_ROUND'; category: string; clue: string; answer: string }
  | { type: 'GUESS_LETTER'; letter: string }
  | { type: 'CHOOSE_POSITION'; index: number }
  | { type: 'ATTEMPT_SOLVE'; answer: string }
  | { type: 'RESOLVE_SPECIAL'; success: boolean }
  | { type: 'PASS_TURN' }
  | { type: 'NEW_GAME' }
  | { type: 'UNDO' };

export interface GameSession {
  code: string;
  hostToken: string;
  /** Shareable secret used only to attach an additional host device. */
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
