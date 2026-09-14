import type { DeckRound } from '../types';

/** Номиналы клеток раунда — объединение цен всех его тем. */
export const roundPrices = (round: DeckRound) =>
  Array.from(
    new Set(round.themes.flatMap((theme) => theme.questions.map((q) => q.price))),
  ).sort((left, right) => left - right);

export const findQuestion = (round: DeckRound, questionId: string) => {
  for (const theme of round.themes) {
    const question = theme.questions.find((item) => item.id === questionId);
    if (question) return { theme, question };
  }
  return null;
};

export const countQuestions = (round: DeckRound) =>
  round.themes.reduce((total, theme) => total + theme.questions.length, 0);
