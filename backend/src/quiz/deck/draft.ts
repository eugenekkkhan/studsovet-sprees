import type { Deck, DeckQuestion, DeckRound, DeckTheme, FinalTheme, QuestionType } from '../types';
import {
  DECK_LIMITS,
  mediaValue,
  plainText,
  priceValue,
  richText,
  uniqueId,
} from './sanitize';

const QUESTION_TYPES: QuestionType[] = ['simple', 'secret', 'stake', 'norisk'];

const draftQuestion = (value: unknown, ids: Set<string>): DeckQuestion => {
  const raw = (value ?? {}) as Record<string, unknown>;
  const type = QUESTION_TYPES.includes(raw.type as QuestionType)
    ? (raw.type as QuestionType)
    : 'simple';
  const secretPrice =
    raw.secretPrice === null || raw.secretPrice === undefined || raw.secretPrice === ''
      ? null
      : priceValue(raw.secretPrice, 0);

  return {
    id: uniqueId(ids, raw.id),
    type,
    price: priceValue(raw.price, 0),
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

const draftTheme = (value: unknown, ids: Set<string>): DeckTheme => {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    id: uniqueId(ids, raw.id),
    name: plainText(raw.name, DECK_LIMITS.themeName),
    comment: richText(raw.comment, DECK_LIMITS.comment),
    questions: (Array.isArray(raw.questions) ? raw.questions : [])
      .slice(0, DECK_LIMITS.questionsPerTheme)
      .map((question) => draftQuestion(question, ids)),
  };
};

const draftRound = (value: unknown, ids: Set<string>, index: number): DeckRound => {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    id: uniqueId(ids, raw.id),
    name: plainText(raw.name, DECK_LIMITS.name) || `${index + 1}-й раунд`,
    themes: (Array.isArray(raw.themes) ? raw.themes : [])
      .slice(0, DECK_LIMITS.themesPerRound)
      .map((theme) => draftTheme(theme, ids)),
  };
};

const draftFinalTheme = (value: unknown, ids: Set<string>): FinalTheme => {
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
 * Черновик из библиотеки автора. В отличие от `normalizeDeck`, который готовит
 * колоду к игре, здесь ничего не выбрасывается: пустая тема или недописанный
 * финал — нормальное состояние колоды, которую ещё пишут. Обрезаем только
 * длины, количества и мусор в полях.
 */
export const sanitizeDeckDraft = (value: unknown): Deck | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const ids = new Set<string>();

  return {
    id: uniqueId(ids, raw.id),
    name: plainText(raw.name, DECK_LIMITS.name) || 'Без названия',
    author: plainText(raw.author, DECK_LIMITS.name),
    rounds: (Array.isArray(raw.rounds) ? raw.rounds : [])
      .slice(0, DECK_LIMITS.rounds)
      .map((round, index) => draftRound(round, ids, index)),
    finalThemes: (Array.isArray(raw.finalThemes) ? raw.finalThemes : [])
      .slice(0, DECK_LIMITS.finalThemes)
      .map((theme) => draftFinalTheme(theme, ids)),
  };
};
