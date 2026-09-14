import { useCallback, useEffect, useState } from "react";
import { copyDeckToOwn, fetchDeckLibrary } from "../api/decksApi";
import { ApiError } from "../api/http";
import type { StoredDeck } from "../types/quiz";
import { showToast } from "../utils/toast";

export type SharedDecksState = "loading" | "ready" | "error" | "signedOut";

export interface SharedDecks {
  decks: StoredDeck[];
  /** Виден ли просматривающему весь залитый материал, включая приватный. */
  isAdmin: boolean;
  state: SharedDecksState;
  error: string;
  reload: () => void;
  copyToOwn: (authorId: number, deckId: string) => Promise<StoredDeck | null>;
}

const messageOf = (cause: unknown, fallback: string) =>
  cause instanceof ApiError ? cause.message : fallback;

/**
 * Общая библиотека колод: опубликованные чужие плюс свои. Отдельно от
 * `useDeckLibrary` — та про свои колоды и их правку, эта только про чтение
 * общего и перенос понравившегося себе.
 */
export const useSharedDecks = (enabled: boolean) => {
  const [decks, setDecks] = useState<StoredDeck[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [state, setState] = useState<SharedDecksState>("loading");
  const [error, setError] = useState("");
  const [token, setToken] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState("signedOut");
      return;
    }
    let active = true;
    setState("loading");
    setError("");

    void fetchDeckLibrary()
      .then((response) => {
        if (!active) return;
        setDecks(response.decks);
        setIsAdmin(response.isAdmin);
        setState("ready");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(messageOf(cause, "Не удалось загрузить общую библиотеку."));
        setState("error");
      });

    return () => {
      active = false;
    };
  }, [enabled, token]);

  const reload = useCallback(() => setToken((current) => current + 1), []);

  const copyToOwn = useCallback(async (authorId: number, deckId: string) => {
    try {
      const copy = await copyDeckToOwn(authorId, deckId);
      showToast.success(`Колода «${copy.deck.name}» добавлена в ваши.`);
      return copy;
    } catch (cause) {
      showToast.error(messageOf(cause, "Не удалось добавить колоду себе."));
      return null;
    }
  }, []);

  return { decks, isAdmin, state, error, reload, copyToOwn } as SharedDecks;
};
