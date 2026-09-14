import type { Deck, Media, QuestionType } from "./deck";

export interface Team {
  id: string;
  name: string;
  color: string;
  score: number;
  /** Ключ капитана приходит только в проекции ведущего. */
  joinKey?: string;
}

export type GamePhase =
  | "lobby"
  | "board"
  | "transfer"
  | "bidding"
  | "question"
  | "answer"
  | "reveal"
  | "round-over"
  | "final-themes"
  | "final-bets"
  | "final-answers"
  | "final-reveal"
  | "game-over";

export type GameMessageTone = "info" | "success" | "warning" | "danger";

export interface GameLogEntry {
  id: number;
  message: string;
  tone: GameMessageTone;
}

export interface GameSettings {
  penalty: boolean;
  falseStartLockMs: number;
  bidStep: number;
}

export interface BiddingState {
  questionId: string;
  nominal: number;
  openerTeamId: string;
  turnTeamId: string | null;
  highestBid: number;
  highestTeamId: string | null;
  allIn: boolean;
  passedTeamIds: string[];
}

export interface ActiveQuestion {
  roundId: string;
  themeId: string;
  questionId: string;
  themeName: string;
  boardThemeName: string;
  type: QuestionType;
  price: number;
  text: string;
  answer: string;
  comment: string;
  media: Media | null;
  answerMedia: Media | null;
  openerTeamId: string | null;
  soloTeamId: string | null;
  buzzOpen: boolean;
  buzzedTeamId: string | null;
  lockedTeamIds: string[];
  falseStartUntil: Record<string, number>;
  answerRevealed: boolean;
}

export interface FinalState {
  themes: Array<{ id: string; name: string }>;
  removedThemeIds: string[];
  playingThemeId: string | null;
  turnTeamId: string | null;
  participantIds: string[];
  bets: Record<string, number>;
  answers: Record<string, string>;
  revealedTeamIds: string[];
  judgedTeamIds: string[];
}

/** Состояние ведущего: колода, ответы и вся служебная кухня. */
export interface HostGameState {
  deck: Deck | null;
  teams: Team[];
  phase: GamePhase;
  roundIndex: number;
  playedQuestionIds: string[];
  questionOutcomes: Record<string, string | null>;
  pickerTeamId: string | null;
  activeQuestion: ActiveQuestion | null;
  bidding: BiddingState | null;
  final: FinalState | null;
  settings: GameSettings;
  statusMessage: string;
  statusTone: GameMessageTone;
  history: GameLogEntry[];
  undoAvailable: boolean;
  revision: number;
  /** Часы сервера на момент проекции: по ним считаем блокировки, не по своим. */
  serverNow: number;
}
