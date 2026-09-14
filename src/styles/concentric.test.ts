import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The rule only holds while nobody writes a corner by hand, so this reads the
 * source rather than the DOM: a radius must come from a control's own fixed
 * height (a pill), from the control scale, or from `cardRadius` — never from a
 * number somebody liked the look of.
 *
 * Adding a name to either list below is allowed, but it is a design decision
 * and belongs in review, which is the point of making it a diff here.
 */

const SRC = path.join(import.meta.dirname, "..");

/** Radii a component may draw on its own: pills and the control scale. */
const SELF_EVIDENT = new Set([
  "pill",
  "full", // a circle: avatars, dots, the buzzer
  "control-sm",
  "control-md",
  "control-lg",
  "none",
]);

/**
 * Shapes that belong to the domain rather than to the corner system. Each is a
 * leaf with a fixed size, so containers are built *from* its radius the same
 * way they are built from a control's.
 */
const FIXED_SHAPES = new Set([
  "components/atoms/LetterTile/LetterTile.tsx", // word slots and alphabet keys
]);

/**
 * `clip` cuts a table's cells to the corner instead of insetting them, so the
 * board has no child to be concentric with and picks its radius outright.
 */
const UNCONSTRAINED = new Set(["components/organisms/Quiz/QuizBoard/QuizBoard.tsx"]);

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return [full];
  });

const files = sourceFiles(SRC).map((full) => ({
  name: path.relative(SRC, full).split(path.sep).join("/"),
  text: readFileSync(full, "utf8"),
}));

/** Strips comments so prose about radii is not mistaken for code. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("nothing picks a corner by hand", () => {
  it("uses no rounded-* utility outside the pill and control scales", () => {
    const offenders = files.flatMap(({ name, text }) => {
      if (FIXED_SHAPES.has(name)) return [];
      const used = [...code(text).matchAll(/\brounded-([a-z0-9-]+)/g)].map(
        (match) => match[1],
      );
      return used
        .filter((value) => !SELF_EVIDENT.has(value))
        .map((value) => `${name}: rounded-${value}`);
    });

    expect(offenders).toEqual([]);
  });

  it("passes Card a radius only when it was derived", () => {
    const offenders = files.flatMap(({ name, text }) => {
      if (UNCONSTRAINED.has(name)) return [];
      // `radius={…}` is the escape hatch; whatever it holds must trace back to
      // cardRadius, so the padding it will be subtracted from is accounted for.
      return [...code(text).matchAll(/\bradius=\{([A-Za-z_$][\w$.]*)/g)]
        .map((match) => match[1])
        .filter((expression) => {
          const declaration = new RegExp(
            `(?:const|let)\\s+${expression}\\s*=\\s*cardRadius\\(`,
          );
          return !declaration.test(text);
        })
        .map((expression) => `${name}: radius={${expression}}`);
    });

    expect(offenders).toEqual([]);
  });

  it("writes no bare pixel value into any corner", () => {
    // Corner-specific properties count too: a hand-typed number there drifts
    // just as quietly as one on the shorthand.
    const corner = /border(?:Top|Bottom)?(?:Left|Right)?Radius:\s*([^,\n}]+)/g;
    const bareLength = /^["'`]?[\d.]+(?:px|rem|em|%)?["'`]?$/;

    const offenders = files.flatMap(({ name, text }) =>
      [...code(text).matchAll(corner)]
        .map((match) => match[1].trim())
        .filter((value) => bareLength.test(value))
        .map((value) => `${name}: ${value}`),
    );

    expect(offenders).toEqual([]);
  });

  it("keeps a control's height and its radius in step", () => {
    // A pill's radius is half its height, so the two token families have to
    // agree or every card built from them is off by the difference.
    const tokens = readFileSync(path.join(SRC, "styles/tokens.css"), "utf8");
    const read = (name: string) =>
      Number(new RegExp(`--${name}:\\s*(\\d+)px`).exec(tokens)?.[1]);

    for (const size of ["sm", "md", "lg"]) {
      expect(read(`radius-control-${size}`)).toBe(
        read(`control-height-${size}`) / 2,
      );
    }
  });
});
