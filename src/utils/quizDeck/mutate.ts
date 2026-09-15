import type {
  Deck,
  DeckQuestion,
  DeckRound,
  DeckTheme,
  FinalTheme,
} from "../../types/quiz";
import { reorderBy } from "../reorder";
import {
  createFinalTheme,
  createQuestion,
  createRound,
  createTheme,
  pricesForRound,
  roundStep,
} from "./factory";

interface Identified {
  id: string;
}

const patchById = <T extends Identified>(items: T[], id: string, patch: Partial<T>) =>
  items.map((item) => (item.id === id ? { ...item, ...patch } : item));

const withoutId = <T extends Identified>(items: T[], id: string) =>
  items.filter((item) => item.id !== id);

/** Перенос элемента на место другого — результат перетаскивания. */
export const reorderById = <T extends Identified>(
  items: T[],
  fromId: string,
  toId: string,
): T[] => reorderBy(items, (item) => item.id, fromId, toId);

/** Сдвиг элемента на одну позицию — порядок тем и клеток важен на табло. */
export const moveById = <T extends Identified>(
  items: T[],
  id: string,
  direction: -1 | 1,
): T[] => {
  const index = items.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

const mapRound = (
  deck: Deck,
  roundId: string,
  map: (round: DeckRound) => DeckRound,
): Deck => ({
  ...deck,
  rounds: deck.rounds.map((round) => (round.id === roundId ? map(round) : round)),
});

const mapTheme = (
  deck: Deck,
  roundId: string,
  themeId: string,
  map: (theme: DeckTheme) => DeckTheme,
): Deck =>
  mapRound(deck, roundId, (round) => ({
    ...round,
    themes: round.themes.map((theme) => (theme.id === themeId ? map(theme) : theme)),
  }));

/* ── Раунды ───────────────────────────────────────────────────────────── */

export const addRound = (deck: Deck): Deck => ({
  ...deck,
  rounds: [...deck.rounds, createRound(deck.rounds.length)],
});

export const updateRound = (deck: Deck, roundId: string, patch: Partial<DeckRound>) => ({
  ...deck,
  rounds: patchById(deck.rounds, roundId, patch),
});

export const removeRound = (deck: Deck, roundId: string): Deck => ({
  ...deck,
  rounds: withoutId(deck.rounds, roundId),
});

export const moveRound = (deck: Deck, roundId: string, direction: -1 | 1): Deck => ({
  ...deck,
  rounds: moveById(deck.rounds, roundId, direction),
});

export const reorderRounds = (deck: Deck, fromId: string, toId: string): Deck => ({
  ...deck,
  rounds: reorderById(deck.rounds, fromId, toId),
});

/* ── Темы ─────────────────────────────────────────────────────────────── */

export const addTheme = (deck: Deck, roundId: string): Deck => {
  const index = deck.rounds.findIndex((round) => round.id === roundId);
  const sample = deck.rounds[index]?.themes[0];
  const prices = sample?.questions.map((question) => question.price) ?? pricesForRound(index, 5);
  return mapRound(deck, roundId, (round) => ({
    ...round,
    themes: [...round.themes, createTheme(prices)],
  }));
};

export const updateTheme = (
  deck: Deck,
  roundId: string,
  themeId: string,
  patch: Partial<DeckTheme>,
): Deck =>
  mapRound(deck, roundId, (round) => ({
    ...round,
    themes: patchById(round.themes, themeId, patch),
  }));

export const removeTheme = (deck: Deck, roundId: string, themeId: string): Deck =>
  mapRound(deck, roundId, (round) => ({
    ...round,
    themes: withoutId(round.themes, themeId),
  }));

export const moveTheme = (
  deck: Deck,
  roundId: string,
  themeId: string,
  direction: -1 | 1,
): Deck =>
  mapRound(deck, roundId, (round) => ({
    ...round,
    themes: moveById(round.themes, themeId, direction),
  }));

export const reorderThemes = (
  deck: Deck,
  roundId: string,
  fromId: string,
  toId: string,
): Deck =>
  mapRound(deck, roundId, (round) => ({
    ...round,
    themes: reorderById(round.themes, fromId, toId),
  }));

/* ── Вопросы ──────────────────────────────────────────────────────────── */

export const addQuestion = (deck: Deck, roundId: string, themeId: string): Deck => {
  const roundIndex = deck.rounds.findIndex((round) => round.id === roundId);
  return mapTheme(deck, roundId, themeId, (theme) => {
    const last = theme.questions[theme.questions.length - 1];
    const step = roundStep(Math.max(0, roundIndex));
    return {
      ...theme,
      questions: [...theme.questions, createQuestion((last?.price ?? 0) + step)],
    };
  });
};

export const updateQuestion = (
  deck: Deck,
  roundId: string,
  themeId: string,
  questionId: string,
  patch: Partial<DeckQuestion>,
): Deck =>
  mapTheme(deck, roundId, themeId, (theme) => ({
    ...theme,
    questions: patchById(theme.questions, questionId, patch),
  }));

export const removeQuestion = (
  deck: Deck,
  roundId: string,
  themeId: string,
  questionId: string,
): Deck =>
  mapTheme(deck, roundId, themeId, (theme) => ({
    ...theme,
    questions: withoutId(theme.questions, questionId),
  }));

export const moveQuestion = (
  deck: Deck,
  roundId: string,
  themeId: string,
  questionId: string,
  direction: -1 | 1,
): Deck =>
  mapTheme(deck, roundId, themeId, (theme) => ({
    ...theme,
    questions: moveById(theme.questions, questionId, direction),
  }));

export const reorderQuestions = (
  deck: Deck,
  roundId: string,
  themeId: string,
  fromId: string,
  toId: string,
): Deck =>
  mapTheme(deck, roundId, themeId, (theme) => ({
    ...theme,
    questions: reorderById(theme.questions, fromId, toId),
  }));

/* ── Финал ────────────────────────────────────────────────────────────── */

export const addFinalTheme = (deck: Deck): Deck => ({
  ...deck,
  finalThemes: [...deck.finalThemes, createFinalTheme()],
});

export const updateFinalTheme = (
  deck: Deck,
  themeId: string,
  patch: Partial<FinalTheme>,
): Deck => ({
  ...deck,
  finalThemes: patchById(deck.finalThemes, themeId, patch),
});

export const removeFinalTheme = (deck: Deck, themeId: string): Deck => ({
  ...deck,
  finalThemes: withoutId(deck.finalThemes, themeId),
});
