export type MediaType = 'image' | 'audio' | 'video';

/**
 * Вопросы «Своей игры»: обычный, «Кот в мешке» (передаётся сопернику),
 * аукцион (разыгрывается на торгах) и вопрос без риска (без штрафа).
 */
export type QuestionType = 'simple' | 'secret' | 'stake' | 'norisk';

export interface Media {
  url: string;
  type: MediaType;
}

export interface DeckQuestion {
  id: string;
  type: QuestionType;
  price: number;
  text: string;
  answer: string;
  /** Комментарий редактора — виден только ведущему. */
  comment: string;
  media: Media | null;
  answerMedia: Media | null;
  /** «Кот в мешке» объявляет собственную тему и цену. */
  secretTheme: string;
  secretPrice: number | null;
}

export interface DeckTheme {
  id: string;
  name: string;
  comment: string;
  questions: DeckQuestion[];
}

export interface DeckRound {
  id: string;
  name: string;
  themes: DeckTheme[];
}

export interface FinalTheme {
  id: string;
  name: string;
  text: string;
  answer: string;
  comment: string;
  media: Media | null;
  answerMedia: Media | null;
}

export interface Deck {
  id: string;
  name: string;
  author: string;
  rounds: DeckRound[];
  finalThemes: FinalTheme[];
}
