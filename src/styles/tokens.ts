/**
 * TS view of the design tokens declared in tokens.css.
 * Values are CSS variable references, so there is exactly one place to edit.
 */

export const color = {
  primary: "var(--color-primary)",
  primaryStrong: "var(--color-primary-strong)",
  primarySoft: "var(--color-primary-soft)",
  primaryBorder: "var(--color-primary-border)",
  primaryMuted: "var(--color-primary-muted)",

  success: "var(--color-success)",
  successSoft: "var(--color-success-soft)",
  successStrong: "var(--color-success-strong)",
  danger: "var(--color-danger)",
  dangerSoft: "var(--color-danger-soft)",
  dangerTint: "var(--color-danger-tint)",
  dangerStrong: "var(--color-danger-strong)",
  warningSoft: "var(--color-warning-soft)",
  warningStrong: "var(--color-warning-strong)",

  neutral: "var(--color-neutral)",
  text: "var(--color-text)",
  textMuted: "var(--color-text-muted)",
  border: "var(--color-border)",
  borderSubtle: "var(--color-border-subtle)",
  borderStrong: "var(--color-border-strong)",

  surface: "var(--color-surface)",
  surfaceMuted: "var(--color-surface-muted)",
  surfaceAlt: "var(--color-surface-alt)",
  surfaceTint: "var(--color-surface-tint)",
} as const;

/**
 * The two inks above, duplicated as literals: contrast maths needs real
 * channel values, and `var(--color-text)` cannot be read from JS.
 * Keep in step with `--color-text` / `--color-surface` in tokens.css.
 */
export const rawInk = { dark: "#081520", light: "#ffffff" } as const;

export const shadow = {
  wheel: "var(--shadow-wheel)",
} as const;

export const space = {
  // Carries a unit: this value ends up inside calc() in the corner arithmetic,
  // and `calc(40px - 0)` is invalid CSS while `calc(40px - 0px)` is not.
  none: "0px",
  "2xs": "var(--spacing-2xs)",
  xs: "var(--spacing-xs)",
  sm: "var(--spacing-sm)",
  md: "var(--spacing-md)",
  lg: "var(--spacing-lg)",
  xl: "var(--spacing-xl)",
  "2xl": "var(--spacing-2xl)",
  "3xl": "var(--spacing-3xl)",
  "4xl": "var(--spacing-4xl)",
} as const;

export type Space = keyof typeof space;

/** One token, a `[y, x]` pair, or a full `[top, right, bottom, left]` set. */
export type SpaceValue =
  | Space
  | readonly [Space, Space]
  | readonly [Space, Space, Space, Space];

/** Resolves a spacing prop to a CSS value. */
export const spacing = (value?: SpaceValue): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === "string"
    ? space[value]
    : value.map((step) => space[step]).join(" ");
};

export const radius = {
  xs: "var(--radius-xs)",
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  xxl: "var(--radius-2xl)",
  pill: "var(--radius-pill)",
} as const;

/**
 * A card's border width. `overflow` clips at the padding box, so the curve a
 * card cuts its children by is its radius minus this — anything that has to
 * sit flush in that corner derives its own radius from the difference.
 */
export const cardBorderWidth = "var(--card-border-width)";

/** Fixed control heights — a pill's radius is exactly half of these. */
export const controlHeight = {
  sm: "var(--control-height-sm)",
  md: "var(--control-height-md)",
  lg: "var(--control-height-lg)",
} as const;

/**
 * The radius a pill control of each size actually draws. These are the seeds
 * of the concentric-corner rule: nothing else in the app picks a radius by
 * hand — every container derives one from whatever sits in its corners.
 */
export const controlRadius = {
  sm: "var(--radius-control-sm)",
  md: "var(--radius-control-md)",
  lg: "var(--radius-control-lg)",
} as const;

export type ControlSize = keyof typeof controlRadius;

/**
 * What a container's corner children are rounded to: a control size, or an
 * explicit length for a corner held by another container (build that one with
 * `cardRadius`, so the two stay in step).
 */
export type ContentRadius = ControlSize | (string & {});

/** Resolves a `ContentRadius` to a CSS length. */
export const contentRadius = (content: ContentRadius): string =>
  content in controlRadius
    ? controlRadius[content as ControlSize]
    : (content as string);

/**
 * The gap between a container's edge and its children. Concentricity needs a
 * single number, so uneven padding takes the smallest side: the child's corner
 * then never bulges past the parent's arc on the tight axis.
 */
export const inset = (padding?: SpaceValue): string => {
  if (padding === undefined) {
    return "0px";
  }
  if (typeof padding === "string") {
    return space[padding];
  }
  const sides = [...new Set(padding.map((step) => space[step]))];
  return sides.length === 1 ? sides[0] : `min(${sides.join(", ")})`;
};

/**
 * The concentric-corner rule, in one place: a container's radius is its own
 * padding plus the radius of whatever touches its corners.
 *
 * `cardRadius("lg")`                      → 20px padding around md pills  → 40px
 * `cardRadius("lg", cardRadius("sm"))`    → a card padded sm nested in one padded lg
 */
export const cardRadius = (
  padding?: SpaceValue,
  content: ContentRadius = "md",
): string => `calc(${inset(padding)} + ${contentRadius(content)})`;

export const font = {
  display: "var(--font-display)",
  body: "var(--font-body)",
} as const;
