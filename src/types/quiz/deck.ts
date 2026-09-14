export type MediaType = "image" | "audio" | "video";

/**
 * Типы вопросов «Своей игры»: обычный, «Кот в мешке» (передаётся сопернику),
 * аукцион (разыгрывается на торгах) и вопрос без риска (без штрафа).
 */
export type QuestionType = "simple" | "secret" | "stake" | "norisk";

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

/** Приватную колоду видит только автор, опубликованную — все вошедшие. */
export type DeckVisibility = "private" | "published";

/** Кто залил колоду. Отличается от поля `author` внутри самой колоды. */
export interface DeckAuthor {
  id: number;
  name: string;
}

/** Запись в библиотеке колод. */
export interface StoredDeck {
  deck: Deck;
  updatedAt: number;
  visibility: DeckVisibility;
  author: DeckAuthor;
  shareActive?: boolean;
  shareAllowCopy?: boolean;
  shareViews?: number;
  shareCopies?: number;
  /** Когда колоду открывали по ссылке в последний раз. */
  shareLastViewedAt?: number | null;
}

/** Что получатель видит по секретной ссылке: колода и её автор, без статистики. */
export interface SharedDeckView {
  deck: Deck;
  updatedAt: number;
  author: DeckAuthor;
}
