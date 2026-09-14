import type {
  Deck,
  DeckQuestion,
  DeckRound,
  DeckTheme,
  FinalTheme,
  QuestionType,
} from '../types';
import {
  DECK_LIMITS,
  mediaValue,
  plainText,
  priceValue,
  richText,
  uniqueId,
} from './sanitize';

const QUESTION_TYPES: QuestionType[] = ['simple', 'secret', 'stake', 'norisk'];

const normalizeQuestion = (
  value: unknown,
  ids: Set<string>,
  fallbackPrice: number,
): DeckQuestion => {
  const raw = (value ?? {}) as Record<string, unknown>;
  const type = QUESTION_TYPES.includes(raw.type as QuestionType)
    ? (raw.type as QuestionType)
    : 'simple';
  const secretPrice =
    raw.secretPrice === null ||
    raw.secretPrice === undefined ||
    raw.secretPrice === ''
      ? null
      : priceValue(raw.secretPrice, fallbackPrice);

  return {
    id: uniqueId(ids, raw.id),
    type,
    price: priceValue(raw.price, fallbackPrice),
    text: richText(raw.text, DECK_LIMITS.text),
    answer: richText(raw.answer, DECK_LIMITS.answer),
    comment: richText(raw.comment, DECK_LIMITS.comment),
    media: mediaValue(raw.media),
    answerMedia: mediaValue(raw.answerMedia),
    secretTheme:
      type === 'secret' ? plainText(raw.secretTheme, DECK_LIMITS.themeName) : '',
    secretPrice: type === 'secret' ? secretPrice : null,
  };
};

const normalizeTheme = (value: unknown, ids: Set<string>, step: number): DeckTheme => {
  const raw = (value ?? {}) as Record<string, unknown>;
  const questions = Array.isArray(raw.questions) ? raw.questions : [];
  return {
    id: uniqueId(ids, raw.id),
    name: plainText(raw.name, DECK_LIMITS.themeName),
    comment: richText(raw.comment, DECK_LIMITS.comment),
    questions: questions
      .slice(0, DECK_LIMITS.questionsPerTheme)
      .map((question, index) => normalizeQuestion(question, ids, step * (index + 1))),
  };
};

const normalizeRound = (value: unknown, ids: Set<string>, index: number): DeckRound => {
  const raw = (value ?? {}) as Record<string, unknown>;
  const themes = Array.isArray(raw.themes) ? raw.themes : [];
  const step = 100 * (index + 1);
  return {
    id: uniqueId(ids, raw.id),
    name: plainText(raw.name, DECK_LIMITS.name) || `Раунд ${index + 1}`,
    themes: themes
      .slice(0, DECK_LIMITS.themesPerRound)
      .map((theme) => normalizeTheme(theme, ids, step)),
  };
};

const normalizeFinalTheme = (value: unknown, ids: Set<string>): FinalTheme => {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    id: uniqueId(ids, raw.id),
    name: plainText(raw.name, DECK_LIMITS.themeName),
    text: richText(raw.text, DECK_LIMITS.text),
    answer: richText(raw.answer, DECK_LIMITS.answer),
    comment: richText(raw.comment, DECK_LIMITS.comment),
    media: mediaValue(raw.media),
    answerMedia: mediaValue(raw.answerMedia),
  };
};

/**
 * Приводит присланную клиентом колоду к безопасной форме. Возвращает null,
 * если играть по ней нельзя: без единого раунда с вопросом игра не начнётся.
 */
export const normalizeDeck = (value: unknown): Deck | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const ids = new Set<string>();

  const rounds = (Array.isArray(raw.rounds) ? raw.rounds : [])
    .slice(0, DECK_LIMITS.rounds)
    .map((round, index) => normalizeRound(round, ids, index))
    .map((round) => ({
      ...round,
      themes: round.themes.filter((theme) => theme.questions.length > 0),
    }))
    .filter((round) => round.themes.length > 0);
  if (rounds.length === 0) return null;

  const finalThemes = (Array.isArray(raw.finalThemes) ? raw.finalThemes : [])
    .slice(0, DECK_LIMITS.finalThemes)
    .map((theme) => normalizeFinalTheme(theme, ids))
    .filter((theme) => theme.name !== '' && theme.text !== '');

  return {
    id: uniqueId(ids, raw.id),
    name: plainText(raw.name, DECK_LIMITS.name) || 'Без названия',
    author: plainText(raw.author, DECK_LIMITS.name),
    rounds,
    finalThemes,
  };
};
