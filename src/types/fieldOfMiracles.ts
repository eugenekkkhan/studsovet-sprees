import type { IconType } from "react-icons";

export interface Team {
  id: string;
  name: string;
  points: number;
  /** The part of `points` that a Bankrupt sector may still remove. */
  roundPoints: number;
  color: string;
  /** Sent only to the host. Public participant state omits it. */
  joinKey?: string;
}

export type GamePhase =
  | "setup"
  | "ready"
  | "spinning"
  | "awaiting-letter"
  | "awaiting-position"
  | "awaiting-special"
  | "round-complete";

export type GameMessageTone = "info" | "success" | "warning" | "danger";

export interface Puzzle {
  category: string;
  clue: string;
  answer: string;
  guessedLetters: string[];
}

export interface GameLogEntry {
  id: number;
  message: string;
  tone: GameMessageTone;
}

export interface AuthoritativeSpin {
  id: string;
  seed: string;
  algorithm: "sha256-v1";
  sectorId: string;
  sectorIndex: number;
  landingAngle: number;
  startedAt: number;
  durationMs: number;
  status: "spinning" | "settled";
}

export interface FieldGameCoreState {
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
  spin: AuthoritativeSpin | null;
}

export interface FieldGameState extends FieldGameCoreState {
  undoStack: FieldGameCoreState[];
}

/** State sent only to the authenticated host socket. */
export interface FieldGameViewState extends FieldGameCoreState {
  undoAvailable: boolean;
  revision: number;
  /** Часы сервера на момент проекции: по ним считаем вращение, не по своим. */
  serverNow: number;
  /** Команды, за которыми прямо сейчас сидит капитан. */
  connectedTeamIds: string[];
}

export interface PublicPuzzle {
  category: string;
  clue: string;
  maskedAnswer: Array<string | null>;
  guessedLetters: string[];
}

/** Public projection: notably, it never contains the secret answer. */
export interface PublicFieldGameState
  extends Omit<FieldGameCoreState, "puzzle"> {
  puzzle: PublicPuzzle | null;
  revision: number;
  /** Часы сервера на момент проекции: по ним считаем вращение, не по своим. */
  serverNow: number;
  /** Команды, за которыми прямо сейчас сидит капитан. */
  connectedTeamIds: string[];
}

export type SectorType =
  | "points"
  | "lose-turn"
  | "bankrupt"
  | "double"
  | "plus"
  | "friend"
  | "prize"
  | "task";

/**
 * One wedge of the drum. Structurally a `WheelSector`, declared here rather
 * than imported so the constants do not depend on a component barrel.
 */
export interface Sector {
  id: string;
  label: string;
  color: string;
  type: SectorType;
  value?: number;
  /** Icon drawn at the rim, beside the label. A react-icons component. */
  icon?: IconType;
  /** Shown in the result toast only — far too small to read on the wheel. */
  image?: string;
}
