import type { Deck, Media, MediaType } from "../../types/quiz";

export type MediaOrigin = "stored" | "external" | "data" | "local";

/** Откуда взята ссылка: файл игры, чужой хостинг, base64 или имя файла рядом. */
export const mediaOrigin = (url: string): MediaOrigin => {
  if (/^data:/i.test(url)) return "data";
  if (/^https?:/i.test(url)) return "external";
  if (url.startsWith("/media/files/")) return "stored";
  return "local";
};

const mapTheme = <T extends { media: Media | null; answerMedia: Media | null }>(
  item: T,
  map: (media: Media) => Media,
): T => ({
  ...item,
  media: item.media ? map(item.media) : null,
  answerMedia: item.answerMedia ? map(item.answerMedia) : null,
});

/** Проходит по всем медиа колоды: и у клеток, и у финальных тем. */
export const mapDeckMedia = (deck: Deck, map: (media: Media) => Media): Deck => ({
  ...deck,
  rounds: deck.rounds.map((round) => ({
    ...round,
    themes: round.themes.map((theme) => ({
      ...theme,
      questions: theme.questions.map((question) => mapTheme(question, map)),
    })),
  })),
  finalThemes: deck.finalThemes.map((theme) => mapTheme(theme, map)),
});

export const collectDeckMedia = (deck: Deck): Media[] => {
  const found: Media[] = [];
  mapDeckMedia(deck, (media) => {
    found.push(media);
    return media;
  });
  return found;
};

const basename = (url: string) => {
  const tail = url.split(/[\\/]/).pop() ?? "";
  try {
    return decodeURIComponent(tail).toLowerCase();
  } catch {
    return tail.toLowerCase();
  }
};

const dataUrlToFile = async (url: string): Promise<File | null> => {
  try {
    const blob = await (await fetch(url)).blob();
    const extension = (blob.type.split("/")[1] ?? "bin").replace("+xml", "");
    return new File([blob], `deck-media.${extension}`, { type: blob.type });
  } catch {
    return null;
  }
};

/** Ссылки, для которых при импорте нужен файл: имя файла рядом или base64. */
export const pendingMediaUrls = (deck: Deck) => {
  const urls = new Set<string>();
  collectDeckMedia(deck).forEach((media) => {
    const origin = mediaOrigin(media.url);
    if (origin === "local" || origin === "data") urls.add(media.url);
  });
  return [...urls];
};

/** Что из ссылок уже обеспечено файлом, а чего не хватает. */
export const matchMediaFiles = (deck: Deck, files: File[]) => {
  const names = new Set(files.map((file) => file.name.toLowerCase()));
  const matched: string[] = [];
  const missing: string[] = [];
  pendingMediaUrls(deck).forEach((url) => {
    const ready = mediaOrigin(url) === "data" || names.has(basename(url));
    (ready ? matched : missing).push(url);
  });
  return { matched, missing };
};

export interface AttachResult {
  deck: Deck;
  uploaded: number;
  /** Ссылки, к которым файл так и не нашёлся: они остаются как есть. */
  missing: string[];
}

/**
 * Догружает картинки и звук вместе с колодой: `"media": { "url": "cat.png" }`
 * ищется среди выбранных файлов по имени, base64 отправляется как есть.
 */
export const attachDeckMedia = async (
  deck: Deck,
  files: File[],
  upload: (file: File) => Promise<{ url: string; type: MediaType }>,
  onProgress?: (done: number, total: number) => void,
): Promise<AttachResult> => {
  const wanted = pendingMediaUrls(deck);
  if (wanted.length === 0) return { deck, uploaded: 0, missing: [] };

  const byName = new Map(files.map((file) => [file.name.toLowerCase(), file]));
  const resolved = new Map<string, Media>();
  const missing: string[] = [];

  for (const url of wanted) {
    const file =
      mediaOrigin(url) === "data"
        ? await dataUrlToFile(url)
        : (byName.get(basename(url)) ?? null);
    if (!file) {
      missing.push(url);
      continue;
    }
    const stored = await upload(file);
    resolved.set(url, { url: stored.url, type: stored.type });
    onProgress?.(resolved.size, wanted.length - missing.length);
  }

  return {
    deck: mapDeckMedia(deck, (media) => resolved.get(media.url) ?? media),
    uploaded: resolved.size,
    missing,
  };
};
