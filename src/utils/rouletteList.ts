import { normalizeHex } from "./color";

export interface ListItem {
  title: string;
  weight: number;
  color?: string;
}

/**
 * `Аня`, `Аня ×3`, `Аня x3`, `Аня х3`. Three glyphs, because on a Russian
 * keyboard the one that gets typed is Cyrillic х (U+0445), not the multiply
 * sign or the Latin x.
 */
const LINE = /^\s*(.*?)\s*(?:[×xх*]\s*(\d+))?\s*$/iu;

export const parseBulkList = (input: string): ListItem[] =>
  input
    .split("\n")
    .map((line) => LINE.exec(line))
    .flatMap((match) => {
      const title = match?.[1]?.trim();
      if (!title) {
        return [];
      }
      return [{ title, weight: Math.max(1, Number(match?.[2] ?? 1)) }];
    });

/** Shape shared by the JSON export and the share link. */
interface TransferSet {
  version: 2;
  entities: ListItem[];
}

export const toTransferSet = (items: ListItem[]): TransferSet => ({
  version: 2,
  entities: items.map((item) => ({
    title: item.title,
    color: item.color,
    weight: item.weight,
  })),
});

export const parseTransferSet = (raw: string): ListItem[] | null => {
  try {
    const parsed = JSON.parse(raw) as TransferSet | null;
    if (!Array.isArray(parsed?.entities)) {
      return null;
    }

    return parsed.entities
      .filter((entry): entry is ListItem => typeof entry?.title === "string")
      .map((entry) => ({
        title: entry.title,
        weight: Math.max(1, Math.round(Number(entry.weight) || 1)),
        color:
          typeof entry.color === "string"
            ? (normalizeHex(entry.color) ?? undefined)
            : undefined,
      }));
  } catch {
    return null;
  }
};

/**
 * `btoa` throws on Cyrillic, and spreading the byte array into
 * `String.fromCharCode` blows the argument limit, so the bytes are folded.
 */
export const toBase64Url = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const fromBase64Url = (value: string): string | null => {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
};

/**
 * Messengers truncate long links and old browsers capped around 2083 chars,
 * so past this the honest answer is the JSON export rather than a broken link.
 */
export const MAX_SHARE_URL_LENGTH = 1800;

export const buildShareUrl = (items: ListItem[], origin: string, path: string) => {
  const encoded = toBase64Url(
    JSON.stringify(items.map((item) => [item.title, item.color, item.weight])),
  );
  return `${origin}${path}?set=${encoded}`;
};

export const parseShareParam = (param: string): ListItem[] | null => {
  const json = fromBase64Url(param);
  if (!json) {
    return null;
  }

  try {
    const rows = JSON.parse(json) as [string, string | undefined, number][];
    if (!Array.isArray(rows)) {
      return null;
    }

    return rows
      .filter((row) => Array.isArray(row) && typeof row[0] === "string")
      .map((row) => ({
        title: row[0],
        color: typeof row[1] === "string" ? (normalizeHex(row[1]) ?? undefined) : undefined,
        weight: Math.max(1, Math.round(Number(row[2]) || 1)),
      }));
  } catch {
    return null;
  }
};
