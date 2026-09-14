import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteDeck,
  fetchDecks,
  saveDeck,
  setDeckVisibility,
} from "../api/decksApi";
import { ApiError } from "../api/http";
import type { Deck, DeckVisibility, StoredDeck } from "../types/quiz";
import { createDeck, duplicateDeck, type DeckTemplate } from "../utils/quizDeck";
import { showToast } from "../utils/toast";
import { useAuth } from "./useAuth";

/** Колоды до переезда на сервер — забираем их при первом входе и удаляем. */
const LEGACY_KEY = "quizDeckLibraryV1";
const cacheKey = (userId: number) => `quizDeckCache:${userId}`;
const activeKey = (userId: number) => `quizDeckActive:${userId}`;

/** Правка идёт по букве — на сервер уходит пауза спустя. */
const SAVE_DELAY_MS = 800;

export type DeckSyncState =
  | "loading"
  | "ready"
  | "saving"
  | "error"
  /** Пульт ведущего открывают по ключу комнаты, не входя в приложение. */
  | "signedOut";

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Переполненное хранилище: кэш не обязателен, колоды всё равно на сервере.
  }
};

const messageOf = (cause: unknown, fallback: string) =>
  cause instanceof ApiError ? cause.message : fallback;

/**
 * Библиотека колод пользователя. Хранит их сервер — колода, начатая на
 * ноутбуке, открывается с телефона. localStorage остаётся кэшем: он рисует
 * список сразу, пока идёт запрос, и держит правки, если сеть отвалилась.
 */
export const useDeckLibrary = () => {
  const { user, status: authStatus } = useAuth();
  const userId = user?.id ?? null;

  const [decks, setDecks] = useState<StoredDeck[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<DeckSyncState>("loading");
  const [syncError, setSyncError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const pending = useRef(new Map<string, Deck>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remember = useCallback(
    (next: StoredDeck[]) => {
      setDecks(next);
      if (userId !== null) writeJson(cacheKey(userId), next);
    },
    [userId],
  );

  /** Отправляет накопленные правки. Неудачные возвращаются в очередь. */
  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const batch = [...pending.current.values()];
    if (batch.length === 0) return;
    pending.current.clear();
    setSyncState("saving");

    try {
      for (const deck of batch) await saveDeck(deck);
      setSyncState("ready");
      setSyncError("");
    } catch (cause) {
      batch.forEach((deck) => {
        if (!pending.current.has(deck.id)) pending.current.set(deck.id, deck);
      });
      const message = messageOf(cause, "Колода не сохранилась на сервере.");
      setSyncState("error");
      setSyncError(message);
      showToast.error(message);
    }
  }, []);

  const queue = useCallback(
    (deck: Deck) => {
      pending.current.set(deck.id, deck);
      setSyncState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  useEffect(() => {
    if (authStatus !== "authorized" || userId === null) {
      setDecks([]);
      setActiveId(null);
      setSyncState(authStatus === "loading" ? "loading" : "signedOut");
      return;
    }

    let active = true;
    const cached = readJson<StoredDeck[]>(cacheKey(userId), []);
    if (cached.length > 0) {
      setDecks(cached);
      setSyncState("ready");
    }

    const load = async () => {
      // Колоды из старой браузерной библиотеки переезжают один раз и молча.
      const legacy = readJson<StoredDeck[]>(LEGACY_KEY, []).filter(
        (item) => item?.deck?.id,
      );
      if (legacy.length > 0) {
        try {
          for (const item of legacy) await saveDeck(item.deck);
          localStorage.removeItem(LEGACY_KEY);
          showToast.success(
            `Колод перенесено на сервер: ${legacy.length}. Теперь они открываются с любого устройства.`,
          );
        } catch {
          // Не вышло — попробуем в следующий раз, ключ на месте.
        }
      }

      try {
        const server = await fetchDecks();
        if (!active) return;
        remember(server);
        const stored = localStorage.getItem(activeKey(userId));
        setActiveId(
          stored && server.some((item) => item.deck.id === stored)
            ? stored
            : (server[0]?.deck.id ?? null),
        );
        setSyncState("ready");
        setSyncError("");
      } catch (cause) {
        if (!active) return;
        setSyncState("error");
        setSyncError(messageOf(cause, "Не удалось получить колоды с сервера."));
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [authStatus, reloadToken, remember, userId]);

  useEffect(() => {
    if (userId === null || !activeId) return;
    writeJson(activeKey(userId), activeId);
  }, [activeId, userId]);

  // Уход со страницы не должен стоить последней правки.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      void flush();
    };
  }, [flush]);

  const save = useCallback(
    (deck: Deck) => {
      setDecks((current) => {
        const index = current.findIndex((item) => item.deck.id === deck.id);
        const previous = index < 0 ? null : current[index];
        const entry: StoredDeck = {
          deck,
          updatedAt: Date.now(),
          // Правка колоды не меняет её видимость — это отдельное действие.
          visibility: previous?.visibility ?? "private",
          author: previous?.author ?? {
            id: userId ?? 0,
            name: user?.name ?? "",
          },
        };
        const next =
          index < 0
            ? [entry, ...current]
            : current.map((item, position) => (position === index ? entry : item));
        if (userId !== null) writeJson(cacheKey(userId), next);
        return next;
      });
      queue(deck);
    },
    [queue, user?.name, userId],
  );

  const add = useCallback(
    (deck: Deck) => {
      save(deck);
      setActiveId(deck.id);
      void flush();
      return deck;
    },
    [flush, save],
  );

  const create = useCallback(
    (name?: string, template?: DeckTemplate) => add(createDeck(name, template)),
    [add],
  );

  const duplicate = useCallback(
    (deckId: string) => {
      const source = decks.find((item) => item.deck.id === deckId)?.deck;
      return source ? add(duplicateDeck(source)) : null;
    },
    [add, decks],
  );

  const remove = useCallback(
    (deckId: string) => {
      const previous = decks;
      const next = previous.filter((item) => item.deck.id !== deckId);
      pending.current.delete(deckId);
      remember(next);
      setActiveId((current) =>
        current === deckId ? (next[0]?.deck.id ?? null) : current,
      );

      void deleteDeck(deckId).catch((cause) => {
        // Сервер не удалил — возвращаем колоду, чтобы список не врал.
        remember(previous);
        showToast.error(messageOf(cause, "Колоду не удалось удалить."));
      });
    },
    [decks, remember],
  );

  /**
   * Публикация — отдельное решение автора, поэтому идёт мимо автосейва:
   * обычная правка колоды видимость не трогает.
   */
  const publish = useCallback(
    async (deckId: string, visibility: DeckVisibility) => {
      const previous = decks;
      // Бейдж переключается сразу: ответа сервера ждать незачем.
      remember(
        decks.map((item) =>
          item.deck.id === deckId ? { ...item, visibility } : item,
        ),
      );
      try {
        await setDeckVisibility(deckId, visibility);
        showToast.success(
          visibility === "published"
            ? "Колода опубликована — её увидят остальные."
            : "Колода снова приватная.",
        );
      } catch (cause) {
        remember(previous);
        showToast.error(messageOf(cause, "Не удалось изменить видимость."));
      }
    },
    [decks, remember],
  );

  const activeDeck = useMemo(
    () => decks.find((item) => item.deck.id === activeId)?.deck ?? null,
    [activeId, decks],
  );

  return {
    decks,
    activeDeck,
    activeId,
    syncState,
    syncError,
    select: setActiveId,
    save,
    add,
    create,
    duplicate,
    remove,
    publish,
    /** Забрать колоды с сервера заново — кнопка «Обновить». */
    reload: () => setReloadToken((current) => current + 1),
    /** Отправить накопленные правки немедленно. */
    flush,
  };
};

export type DeckLibrary = ReturnType<typeof useDeckLibrary>;
