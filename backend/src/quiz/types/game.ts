import type { Deck, Media, QuestionType } from './deck';

export interface Team {
  id: string;
  name: string;
  color: string;
  score: number;
  /** Приватный ключ капитана. Есть только в проекции ведущего. */
  joinKey: string;
}

export type PublicTeam = Omit<Team, 'joinKey'>;

export type GamePhase =
  | 'lobby'
  | 'board'
  | 'transfer'
  | 'bidding'
  | 'question'
  | 'answer'
  | 'reveal'
  | 'round-over'
  | 'final-themes'
  | 'final-bets'
  | 'final-answers'
  | 'final-reveal'
  | 'game-over';

export type GameMessageTone = 'info' | 'success' | 'warning' | 'danger';

export interface GameLogEntry {
  id: number;
  message: string;
  tone: GameMessageTone;
}

export interface GameSettings {
  /** Снимать ли номинал за неверный ответ (телеправило — снимать). */
  penalty: boolean;
  /** Блокировка кнопки после фальстарта, мс. */
  falseStartLockMs: number;
  /** Шаг ставки на аукционе. */
  bidStep: number;
}

export interface ActiveQuestion {
  roundId: string;
  themeId: string;
  questionId: string;
  /** Тема, объявляемая игрокам: у «Кота» она своя. */
  themeName: string;
  /** Тема клетки на табло. */
  boardThemeName: string;
  type: QuestionType;
  price: number;
  text: string;
  answer: string;
  comment: string;
  media: Media | null;
  answerMedia: Media | null;
  /** Команда, открывшая клетку. */
  openerTeamId: string | null;
  /** Команда, играющая вопрос в одиночку: кот, аукцион, без риска. */
  soloTeamId: string | null;
  buzzOpen: boolean;
  buzzedTeamId: string | null;
  /** Команды, уже потратившие свою попытку на этом вопросе. */
  lockedTeamIds: string[];
  /** teamId → время окончания блокировки за фальстарт. */
  falseStartUntil: Record<string, number>;
  answerRevealed: boolean;
}

export interface BiddingState {
  questionId: string;
  nominal: number;
  openerTeamId: string;
  turnTeamId: string | null;
  highestBid: number;
  highestTeamId: string | null;
  /** Текущая ставка — ва-банк: перебивается только бо́льшим ва-банком. */
  allIn: boolean;
  passedTeamIds: string[];
}

export interface FinalState {
  themes: Array<{ id: string; name: string }>;
  removedThemeIds: string[];
  playingThemeId: string | null;
  turnTeamId: string | null;
  /** Команды, допущенные к финалу (счёт больше нуля). */
  participantIds: string[];
  bets: Record<string, number>;
  answers: Record<string, string>;
  revealedTeamIds: string[];
  judgedTeamIds: string[];
}

export interface GameCoreState {
  deck: Deck | null;
  teams: Team[];
  phase: GamePhase;
  /** Индекс раунда в колоде; -1 — игра ещё не начата. */
  roundIndex: number;
  playedQuestionIds: string[];
  /** questionId → команда, забравшая вопрос (null — вопрос никто не взял). */
  questionOutcomes: Record<string, string | null>;
  pickerTeamId: string | null;
  activeQuestion: ActiveQuestion | null;
  bidding: BiddingState | null;
  final: FinalState | null;
  settings: GameSettings;
  statusMessage: string;
  statusTone: GameMessageTone;
  history: GameLogEntry[];
}

export interface StoredGameState extends GameCoreState {
  undoStack: GameCoreState[];
  revision: number;
}

export interface HostGameState extends GameCoreState {
  undoAvailable: boolean;
  revision: number;
  /** Часы сервера на момент проекции: клиент считает по ним, а не по своим. */
  serverNow: number;
}
