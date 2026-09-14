import type {
  Deck,
  DeckQuestion,
  DeckRound,
  DeckTheme,
  FinalTheme,
  Media,
  QuestionType,
} from "../../types/quiz";
import { makeId, roundStep } from "./factory";

const QUESTION_TYPES: QuestionType[] = ["simple", "secret", "stake", "norisk"];

const asText = (value: unknown) => (typeof value === "string" ? value : "");

const asNumber = (value: unknown, fallback: number) => {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
};

const asMedia = (value: unknown): Media | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const url = asText(raw.url).trim();
  if (!url) return null;
  const type = raw.type === "audio" || raw.type === "video" ? raw.type : "image";
  return { url, type };
};

const asQuestion = (value: unknown, fallbackPrice: number): DeckQuestion => {
  const raw = (value ?? {}) as Record<string, unknown>;
  const type = QUESTION_TYPES.includes(raw.type as QuestionType)
    ? (raw.type as QuestionType)
    : "simple";
  return {
    id: asText(raw.id) || makeId(),
    type,
    price: asNumber(raw.price, fallbackPrice),
    text: asText(raw.text),
    answer: asText(raw.answer),
    comment: asText(raw.comment),
    media: asMedia(raw.media),
    answerMedia: asMedia(raw.answerMedia),
    secretTheme: type === "secret" ? asText(raw.secretTheme) : "",
    secretPrice:
      type === "secret" && raw.secretPrice !== null && raw.secretPrice !== undefined
        ? asNumber(raw.secretPrice, fallbackPrice)
        : null,
  };
};

const asTheme = (value: unknown, step: number): DeckTheme => {
  const raw = (value ?? {}) as Record<string, unknown>;
  const questions = Array.isArray(raw.questions) ? raw.questions : [];
  return {
    id: asText(raw.id) || makeId(),
    name: asText(raw.name),
    comment: asText(raw.comment),
    questions: questions.map((question, index) =>
      asQuestion(question, step * (index + 1)),
    ),
  };
};

const asRound = (value: unknown, index: number): DeckRound => {
  const raw = (value ?? {}) as Record<string, unknown>;
  const themes = Array.isArray(raw.themes) ? raw.themes : [];
  return {
    id: asText(raw.id) || makeId(),
    name: asText(raw.name) || `${index + 1}-й раунд`,
    themes: themes.map((theme) => asTheme(theme, roundStep(index))),
  };
};

const asFinalTheme = (value: unknown): FinalTheme => {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    id: asText(raw.id) || makeId(),
    name: asText(raw.name),
    text: asText(raw.text),
    answer: asText(raw.answer),
    comment: asText(raw.comment),
    media: asMedia(raw.media),
    answerMedia: asMedia(raw.answerMedia),
  };
};

/** Приводит чужой JSON к форме колоды: недостающие поля просто пустуют. */
export const parseDeck = (value: unknown): Deck | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.rounds)) return null;

  return {
    id: asText(raw.id) || makeId(),
    name: asText(raw.name) || "Импортированная колода",
    author: asText(raw.author),
    rounds: raw.rounds.map((round, index) => asRound(round, index)),
    finalThemes: Array.isArray(raw.finalThemes)
      ? raw.finalThemes.map(asFinalTheme)
      : [],
  };
};

export const parseDeckJson = (raw: string): Deck | null => {
  try {
    return parseDeck(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const deckToJson = (deck: Deck) => JSON.stringify(deck, null, 2);

const fileNameFor = (deck: Deck) =>
  `${(deck.name || "deck").replace(/[^\wа-яё\- ]/gi, "").trim() || "deck"}.json`;

/** Отдаёт браузеру текст файлом. */
export const downloadJson = (fileName: string, text: string) => {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/** Сохраняет колоду файлом — так её можно передать другому ведущему. */
export const downloadDeck = (deck: Deck) =>
  downloadJson(fileNameFor(deck), deckToJson(deck));
