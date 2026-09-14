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

/**
 * A card nested inside another card, where it demonstrably sits *between*
 * other children rather than in a corner: the corners are held by a control,
 * so the outer card is built from the control scale as usual.
 *
 * This is the one judgement the check cannot make on its own — whether a child
 * reaches the corner depends on the layout around it. Adding a name here is
 * therefore a claim about that layout, and the place to argue it is review.
 */
const NESTED_MID_STACK = new Set([
  // A muted course scale between two lines of text; a button ends the stack.
  "pages/Participants/ParticipantProfilePage.tsx",
  // Team cards between a heading row and the host's buttons.
  "components/organisms/Quiz/HostFinalPanel/HostFinalPanel.tsx",
  // Theme cards between the intro and "add a final theme".
  "components/organisms/Quiz/DeckFinalEditor/DeckFinalEditor.tsx",
  // The nested card lives in a dropdown portal, outside this card's box.
  "components/molecules/DataTable/TableFilters.tsx",
]);

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

/** Each `<Card …>` with its own body, matched by depth so nesting is honest. */
const cardSpans = (text: string) => {
  const marks = [...text.matchAll(/<Card\b|<\/Card>/g)];
  return marks.flatMap((mark, index) => {
    if (mark[0] !== "<Card") return [];
    let depth = 0;
    for (const next of marks.slice(index)) {
      depth += next[0] === "<Card" ? 1 : -1;
      if (depth === 0) {
        const tagEnd = text.indexOf(">", mark.index) + 1;
        return [{ tag: text.slice(mark.index, tagEnd), body: text.slice(tagEnd, next.index) }];
      }
    }
    return [];
  });
};

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

  it("takes no radius written out as a literal", () => {
    // The check above only sees `radius={identifier}`. A literal — a token
    // name in quotes, a raw length — skips the derivation entirely, which is
    // the very thing the escape hatch exists to avoid doing by accident.
    const offenders = files.flatMap(({ name, text }) => {
      if (UNCONSTRAINED.has(name)) return [];
      return [...code(text).matchAll(/\bradius=(?:"([^"]*)"|\{\s*["'`]([^"'`]*)["'`]\s*\})/g)]
        .map((match) => match[1] ?? match[2])
        .map((value) => `${name}: radius="${value}"`);
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

  it("gives every painted surface somewhere to get its corner from", () => {
    // A background or a border draws a box, and a box inside a rounded card
    // has to follow that card's curve. It gets it from `.ui-surface` (the CSS
    // side of `useInnerRadius`), from a derived `borderRadius`, or by being a
    // pill or a circle — never by staying square and hoping nobody looks.
    const paints =
      /\b(?:bg-(?:surface-muted|surface-alt|surface-tint|primary-soft|danger-soft|danger-tint|success-soft|warning-soft|neutral|muted)|border\s+border-border|border-\[1\.5px\])/;
    const rounds = /\bui-surface\b|\brounded-|\bsize-\d|borderRadius|\brounded\b/;

    const offenders = files.flatMap(({ name, text }) => {
      if (FIXED_SHAPES.has(name) || UNCONSTRAINED.has(name)) return [];
      // Intrinsic elements only: a component owns its own corner and answers
      // for it where it is defined, so a className on one only recolours it.
      // Whole opening tags, so a className and a style on separate lines still
      // count as belonging to the same element.
      return [...code(text).matchAll(/<[a-z][^<>]*>/g)]
        .map((match) => match[0])
        .filter((tag) => paints.test(tag) && !rounds.test(tag))
        .map((tag) => `${name}: ${tag.replace(/\s+/g, " ").slice(0, 80)}`);
    });

    expect(offenders).toEqual([]);
  });

  it("builds a card that holds a card from that card, not from a control", () => {
    // `content` defaults to a medium control, which is exactly wrong when the
    // corner holds another card: the outer arc then runs a dozen pixels tight
    // and the two curves stop sharing a centre. Nothing about that looks
    // broken in a screenshot, which is why it is checked here.
    const derives = /cardRadius\(|_RADIUS\b/;

    const offenders = files.flatMap(({ name, text }) => {
      if (UNCONSTRAINED.has(name) || NESTED_MID_STACK.has(name)) return [];
      return cardSpans(code(text))
        .filter(({ tag, body }) => {
          if (!/<Card\b/.test(body)) return false;
          if (/\bclip\b(?!=)/.test(tag)) return false; // children are cut, not inset
          if (/padding="none"/.test(tag)) return false; // no inset to be concentric across
          const content = /content=\{([^}]*)\}/.exec(tag);
          return !content || !derives.test(content[1]);
        })
        .map(({ tag }) => `${name}: ${tag.replace(/\s+/g, " ").slice(0, 70)}`);
    });

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
