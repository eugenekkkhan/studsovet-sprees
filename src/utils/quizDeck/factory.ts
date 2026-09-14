import type {
  Deck,
  DeckQuestion,
  DeckRound,
  DeckTheme,
  FinalTheme,
  QuestionType,
} from "../../types/quiz";

export const makeId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Классические номиналы: шаг раунда умножается на номер клетки. */
export const roundStep = (roundIndex: number) => 100 * (roundIndex + 1);

export const pricesForRound = (roundIndex: number, count: number) =>
  Array.from({ length: count }, (_, index) => roundStep(roundIndex) * (index + 1));

export const createQuestion = (
  price: number,
  type: QuestionType = "simple",
): DeckQuestion => ({
  id: makeId(),
  type,
  price,
  text: "",
  answer: "",
  comment: "",
  media: null,
  answerMedia: null,
  secretTheme: "",
  secretPrice: null,
});

export const createTheme = (prices: number[], name = ""): DeckTheme => ({
  id: makeId(),
  name,
  comment: "",
  questions: prices.map((price) => createQuestion(price)),
});

export const createRound = (
  roundIndex: number,
  { themes = 6, questions = 5 } = {},
): DeckRound => ({
  id: makeId(),
  name: `${roundIndex + 1}-й раунд`,
  themes: Array.from({ length: themes }, () =>
    createTheme(pricesForRound(roundIndex, questions)),
  ),
});

export const createFinalTheme = (name = ""): FinalTheme => ({
  id: makeId(),
  name,
  text: "",
  answer: "",
  comment: "",
  media: null,
  answerMedia: null,
});

export interface DeckTemplate {
  rounds?: number;
  themes?: number;
  questions?: number;
  finalThemes?: number;
}

/** Пустая колода классической формы: 3 раунда по 6 тем и 7 финальных тем. */
export const createDeck = (
  name = "Новая колода",
  { rounds = 3, themes = 6, questions = 5, finalThemes = 7 }: DeckTemplate = {},
): Deck => ({
  id: makeId(),
  name,
  author: "",
  rounds: Array.from({ length: rounds }, (_, index) =>
    createRound(index, { themes, questions }),
  ),
  finalThemes: Array.from({ length: finalThemes }, () => createFinalTheme()),
});

/** Копия колоды с новыми идентификаторами — чтобы не путать её с оригиналом. */
export const duplicateDeck = (deck: Deck, name = `${deck.name} (копия)`): Deck => ({
  ...deck,
  id: makeId(),
  name,
  rounds: deck.rounds.map((round) => ({
    ...round,
    id: makeId(),
    themes: round.themes.map((theme) => ({
      ...theme,
      id: makeId(),
      questions: theme.questions.map((question) => ({ ...question, id: makeId() })),
    })),
  })),
  finalThemes: deck.finalThemes.map((theme) => ({ ...theme, id: makeId() })),
});
