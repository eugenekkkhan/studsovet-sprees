export interface Team {
  id: string;
  name: string;
  score: number;
  color: string;
}

export interface Question {
  id: string;
  text: string;
  answer: string;
  points: number;
  isOpened: boolean;
  winnerId: string | null;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio';
  answerMediaUrl?: string;
  answerMediaType?: 'image' | 'audio';
}

export interface Category {
  id: string;
  name: string;
  questions: Question[];
}

export interface Round {
  id: string;
  name: string;
  categories: Category[];
}

export type GamePhase = 'lobby' | 'board' | 'question' | 'answering';

export interface ActiveQuestion {
  questionId: string;
  categoryId: string;
  categoryName: string;
  question: string;
  answer: string;
  points: number;
  currentAnswererId: string | null;
  answeredTeamIds: string[];
  mediaUrl?: string;
  mediaType?: 'image' | 'audio';
  answerMediaUrl?: string;
  answerMediaType?: 'image' | 'audio';
}

export interface GameState {
  rounds: Round[];
  activeRoundId: string | null;
  activeQuestion: ActiveQuestion | null;
  teams: Team[];
  phase: GamePhase;
}
