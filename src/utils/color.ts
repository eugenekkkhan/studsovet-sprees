import { rawInk } from "../styles/tokens";

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?/i;
const HSL = /^hsla?\(\s*(-?[\d.]+)(?:deg)?\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%/i;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Any accepted hex spelling → `#rrggbb`, or null when the input is not hex. */
export const normalizeHex = (input: string): string | null => {
  const match = HEX.exec(input.trim());
  if (!match) {
    return null;
  }

  const digits = match[1];
  // #rgb and #rgba expand each digit; #rrggbbaa drops the alpha.
  const rgb =
    digits.length <= 4
      ? digits
          .slice(0, 3)
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : digits.slice(0, 6);

  return `#${rgb.toLowerCase()}`;
};

const toHex = (channel: number) =>
  Math.round(clamp01(channel) * 255)
    .toString(16)
    .padStart(2, "0");

const hslToHex = (h: number, s: number, l: number) => {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const sector = (((h % 360) + 360) % 360) / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const offset = l - chroma / 2;

  const [r, g, b] = (
    [
      [chroma, second, 0],
      [second, chroma, 0],
      [0, chroma, second],
      [0, second, chroma],
      [second, 0, chroma],
      [chroma, 0, second],
    ] as const
  )[Math.min(5, Math.floor(sector))];

  return `#${toHex(r + offset)}${toHex(g + offset)}${toHex(b + offset)}`;
};

const hexToHsl = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(
    (index) => parseInt(hex.slice(index, index + 2), 16) / 255,
  );
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) {
    return { h: 0, s: 0, l };
  }

  const s = delta / (1 - Math.abs(2 * l - 1));
  const h =
    max === r
      ? 60 * (((g - b) / delta) % 6)
      : max === g
        ? 60 * ((b - r) / delta + 2)
        : 60 * ((r - g) / delta + 4);

  return { h: ((h % 360) + 360) % 360, s, l };
};

/** `hsl(210, 70%, 55%)` → `#rrggbb`. Used by the v1 → v2 roulette migration. */
export const hslStringToHex = (input: string): string | null => {
  const match = HSL.exec(input.trim());
  if (!match) {
    return null;
  }

  return hslToHex(Number(match[1]), Number(match[2]) / 100, Number(match[3]) / 100);
};

/** `rgb(33 33 33)` → `#212121`. Браузер отдаёт цвета фона именно так. */
export const rgbStringToHex = (input: string): string | null => {
  const match = RGB.exec(input.trim());
  if (!match) {
    return null;
  }
  // Полностью прозрачный фон — это «цвета нет», а не чёрный.
  if (match[4] !== undefined && Number(match[4]) === 0) {
    return null;
  }
  return `#${[1, 2, 3]
    .map((index) => Math.round(Number(match[index])).toString(16).padStart(2, "0"))
    .join("")}`;
};

/** Accepts any spelling; falls back to black so callers never see NaN. */
const toHexOrBlack = (color: string) =>
  normalizeHex(color) ?? hslStringToHex(color) ?? rgbStringToHex(color) ?? "#000000";

/**
 * Цвет, на котором в этот момент лежат карточки. Telegram красит приложение
 * своей темой: в тёмной цвет команды нужно осветлять, а не затемнять, поэтому
 * «против белого» здесь врало бы. Значение кешируем — на каждой карточке
 * дёргать getComputedStyle незачем.
 */
let backdrop: string | null = null;

export const surfaceBackdrop = (): string => {
  if (backdrop) return backdrop;
  if (typeof window === "undefined" || !document.body) return rawInk.light;

  const layers = [document.body, document.documentElement];
  for (const layer of layers) {
    const hex = rgbStringToHex(getComputedStyle(layer).backgroundColor);
    if (hex) {
      backdrop = hex;
      return hex;
    }
  }
  return rawInk.light;
};

/** Событие смены темы: по нему экраны перечитывают цвет подложки. */
export const THEME_EVENT = "sprees:theme";

/** Сбрасывается, когда клиент присылает новую тему. */
export const resetSurfaceBackdrop = () => {
  backdrop = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(THEME_EVENT));
  }
};

/** WCAG 2.1 relative luminance, 0 (black) to 1 (white). */
export const relativeLuminance = (color: string): number => {
  const hex = toHexOrBlack(color);
  const [r, g, b] = [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) =>
      channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two luminances, 1 to 21. */
export const contrastRatio = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Which of the two app inks reads better on `background`. */
export const readableInk = (background: string): "dark" | "light" => {
  const luminance = relativeLuminance(background);

  return contrastRatio(luminance, relativeLuminance(rawInk.dark)) >=
    contrastRatio(luminance, relativeLuminance(rawInk.light))
    ? "dark"
    : "light";
};

/**
 * Walks `color`'s lightness away from `against` until the pair clears `ratio`,
 * so a team's own colour can be used as text on a known background.
 */
export const ensureContrast = (
  color: string,
  against: string,
  ratio = 4.5,
): string => {
  const hex = normalizeHex(color) ?? hslStringToHex(color) ?? rgbStringToHex(color);
  if (!hex) {
    return color;
  }

  const backdrop = relativeLuminance(against);
  const { h, s } = hexToHsl(hex);
  // Move away from the backdrop: darken on light grounds, lighten on dark ones.
  const step = backdrop > 0.5 ? -0.04 : 0.04;
  let { l } = hexToHsl(hex);

  for (let attempt = 0; attempt <= 25; attempt += 1) {
    const candidate = hslToHex(h, s, l);
    if (contrastRatio(relativeLuminance(candidate), backdrop) >= ratio) {
      return candidate;
    }
    l = clamp01(l + step);
  }

  return backdrop > 0.5 ? "#000000" : "#ffffff";
};
