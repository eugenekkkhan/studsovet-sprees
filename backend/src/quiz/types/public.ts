import type { Media, QuestionType } from './deck';
import type {
  BiddingState,
  GameLogEntry,
  GameMessageTone,
  GamePhase,
  GameSettings,
  PublicTeam,
} from './game';

/** Публичная проекция: без ответов и без нераскрытых клеток. */

export interface PublicCell {
  questionId: string;
  price: number;
  played: boolean;
  winnerTeamId: string | null;
}

export interface PublicBoardTheme {
  id: string;
  name: string;
  cells: PublicCell[];
}

export interface PublicBoard {
  roundId: string;
  roundName: string;
  roundIndex: number;
  roundCount: number;
  prices: number[];
  themes: PublicBoardTheme[];
  remaining: number;
}

export interface PublicActiveQuestion {
  questionId: string;
  themeName: string;
  type: QuestionType;
  price: number;
  text: string;
  media: Media | null;
  /** Появляется только после раскрытия ответа. */
  answer: string | null;
  answerMedia: Media | null;
  openerTeamId: string | null;
  soloTeamId: string | null;
  buzzOpen: boolean;
  buzzedTeamId: string | null;
  lockedTeamIds: string[];
  falseStartUntil: Record<string, number>;
  answerRevealed: boolean;
}

export interface PublicFinalState {
  themes: Array<{ id: string; name: string }>;
  removedThemeIds: string[];
  playingThemeId: string | null;
  playingThemeName: string | null;
  turnTeamId: string | null;
  participantIds: string[];
  question: string | null;
  answer: string | null;
  media: Media | null;
  answerMedia: Media | null;
  betPlacedTeamIds: string[];
  answerPlacedTeamIds: string[];
  revealedTeamIds: string[];
  judgedTeamIds: string[];
  /** Ставки и ответы раскрываются по мере вскрытия конвертов. */
  bets: Record<string, number>;
  answers: Record<string, string>;
}

export interface PublicGameState {
  deckName: string | null;
  teams: PublicTeam[];
  phase: GamePhase;
  board: PublicBoard | null;
  pickerTeamId: string | null;
  activeQuestion: PublicActiveQuestion | null;
  bidding: BiddingState | null;
  final: PublicFinalState | null;
  settings: GameSettings;
  statusMessage: string;
  statusTone: GameMessageTone;
  history: GameLogEntry[];
  revision: number;
  /** Часы сервера на момент проекции: клиент считает по ним, а не по своим. */
  serverNow: number;
}
