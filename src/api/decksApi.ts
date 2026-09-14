import { request } from "./http";
import type { Deck, DeckVisibility, SharedDeckView, StoredDeck } from "../types/quiz";

/** Колоды пользователя на сервере: ключ — тот, кто вошёл, поэтому id не передаём. */
export const fetchDecks = async () =>
  (await request<{ decks: StoredDeck[] }>("/decks")).decks;

export const saveDeck = (deck: Deck) =>
  request<StoredDeck>(`/decks/${encodeURIComponent(deck.id)}`, {
    method: "PUT",
    body: JSON.stringify({ deck }),
  });

export const deleteDeck = (deckId: string) =>
  request<{ ok: boolean }>(`/decks/${encodeURIComponent(deckId)}`, {
    method: "DELETE",
  });

/**
 * Общая библиотека: опубликованные колоды всех авторов плюс свои любые.
 * Начальнику студсовета сервер отдаёт и чужие приватные — об этом говорит
 * `isAdmin` в ответе, отдельного запроса за правами не нужно.
 */
export const fetchDeckLibrary = () =>
  request<{ decks: StoredDeck[]; isAdmin: boolean }>("/decks/library");

export const setDeckVisibility = (deckId: string, visibility: DeckVisibility) =>
  request<StoredDeck>(`/decks/${encodeURIComponent(deckId)}/visibility`, {
    method: "PATCH",
    body: JSON.stringify({ visibility }),
  });

/** Забирает чужую колоду себе копией: правки оригинала не касаются. */
export const copyDeckToOwn = (authorId: number, deckId: string) =>
  request<StoredDeck>("/decks/copy", {
    method: "POST",
    body: JSON.stringify({ authorId, deckId }),
  });

/**
 * Выдаёт код доступа. Тот же вызов меняет код у открытой колоды: сервер держит
 * лишь хеш, поэтому сам код возвращается ровно один раз — при выдаче.
 */
export const issueDeckShare = (deckId: string, allowCopy: boolean) =>
  request<{ code: string; deck: StoredDeck }>(`/decks/${encodeURIComponent(deckId)}/share`, {
    method: "POST",
    body: JSON.stringify({ allowCopy }),
  });

/** Разрешение забрать копию — меняется без перевыпуска кода. */
export const setDeckShareOptions = (deckId: string, allowCopy: boolean) =>
  request<StoredDeck>(`/decks/${encodeURIComponent(deckId)}/share`, {
    method: "PATCH",
    body: JSON.stringify({ allowCopy }),
  });

export const revokeDeckShare = (deckId: string) =>
  request<StoredDeck>(`/decks/${encodeURIComponent(deckId)}/share`, { method: "DELETE" });

/** Открыть колоду по коду: только чтение — правки остаются у автора. */
export const accessDeckShare = (code: string) =>
  request<{ deck: SharedDeckView; allowCopy: boolean }>("/decks/access", {
    method: "POST",
    body: JSON.stringify({ code }),
  });

/** Забрать независимую копию себе, если автор это разрешил. */
export const copyDeckShare = (code: string) =>
  request<StoredDeck>("/decks/access/copy", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
