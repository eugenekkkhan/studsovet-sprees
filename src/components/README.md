# Component layers

The UI follows atomic design. Each layer may only import from the layers above it.

| Layer | Location | Rule | Examples |
| --- | --- | --- | --- |
| **Atoms** | `atoms/` | One HTML element, no app state, no context. Style comes from `styles/tokens.css`. | `Button`, `Input`, `TextArea`, `ColorInput`, `IconButton`, `Badge`, `Notice`, `Stack`, `Card`, `Text` |
| **Molecules** | `molecules/` | Compose atoms into a reusable control. Local UI state only — never app context. | `Tabs`, `MediaUploader`, `AnswerBox`, `TeamChip`, `InlineAddForm`, `Wheel` |
| **Organisms** | `organisms/` | Feature-aware sections. May read context, call the API and own domain state. | `QuizBoardGrid`, `AdminGameTab`, `CaptainPanel`, `TeamSection` |
| **Templates** | `templates/` | Page-level layout with no domain knowledge. | `PageContainer` |
| **Pages** | `src/pages/` | Route screens: wire data to organisms. | `QuizPage`, `RoulettePage`, `FieldOfMiraclesPage` |

Supporting folders: `src/api`, `src/context`, `src/hooks`, `src/types`, `src/constants`, `src/utils`, `src/styles`.

Import through the barrels — `components/atoms`, `components/molecules`, `components/organisms`, `components/templates` — rather than reaching into a component folder.

## Styling: Tailwind CSS v4 + shadcn/ui

There is no per-component CSS file left in the tree. Every atom is styled with
Tailwind utility classes, composed through `class-variance-authority` (`cva`)
for variant props (`variant`, `tone`, `size`, …) and merged with `cn` (from the
`cn` package — a `clsx` + `tailwind-merge` drop-in) so a caller's `className`
can always win over a default.

- **`components/ui/`** holds raw shadcn/ui primitives, installed with
  `npx shadcn add <name>` and configured by `components.json` at the repo
  root. `Input`, `TextArea` and `Divider` are thin, re-styled wrappers around
  `ui/input`, `ui/textarea` and `ui/separator` (the last for real
  `role="separator"` semantics via Radix). `Button`, `Card`, `Badge` and
  `Notice` are independent `cva` components instead of wrapping their shadcn
  counterparts — this app's variant vocabulary (`success`/`danger`/`neutral`
  tones, dynamic per-team border colours, the bold-label layout-stability
  trick in `Tabs`) doesn't map cleanly onto shadcn's defaults, and shadcn's
  own philosophy is "copy the code, then make it yours" rather than a locked
  dependency. Add back `button`/`badge`/`card`/`alert` from the registry with
  `shadcn add` if a future component genuinely wants the stock look.
- **`styles/tokens.css`** wraps the whole palette/spacing/radius/font scale in
  an `@theme` block, so every token doubles as a Tailwind utility
  (`bg-primary`, `gap-sm`, `rounded-pill`, `font-display`, …) *and* a plain
  `:root` CSS variable. `styles/tokens.ts` still reads those variables for the
  cases Tailwind's static class scanner can't reach — genuinely dynamic
  per-instance values such as a team's arbitrary hex colour, a computed wheel
  rotation, or an `[y, x]` padding pair — so inline `style` is still the right
  tool there, not a Tailwind class.
- Path alias `@/*` → `src/*` is set up in `tsconfig.app.json` and
  `vite.config.ts` for shadcn-style imports (`@/components/ui/input`,
  `@/lib/…`).

## Rounding

The app is deliberately round. `--radius-*` in `styles/tokens.css` is the whole
scale, so changing the look is a one-file edit. Controls that stay on one line —
buttons, text inputs, tabs, badges, the colour swatch, header nav links — use
`--radius-pill`. Anything that wraps or stacks (textareas, cards, notices, panels)
uses a fixed step so the curve does not swallow its content, and true circles
(the wheels, the buzzer, colour dots) keep `50%`.

## Spacing

Every gap, padding and margin comes from one 4px-based scale in
`styles/tokens.css` — `--spacing-2xs` (4) through `--spacing-4xl` (64), which
Tailwind turns into matching `gap-*`/`p*-*`/`m*-*` utilities. Nothing in the
project sets a raw pixel value for spacing.

### The rhythm

Only three steps are used for separating things, and the same value applies
across **and** down at any one level — a row's `gap` matches the `gap` of the
column it sits in:

| Step | Use |
| --- | --- |
| `xl` (24) | Between major page sections |
| `sm` (12) | Between blocks in a section, and between a row's own children |
| `2xs` (4) | Inside a tight group — a label and the control it belongs to |

Two rules keep it even:

1. **Separation is the parent's `gap`.** No child sets a margin to push its
   siblings around; nothing in `src` uses `margin*` for spacing.
2. **Don't stack padding on a gap.** A row inside a gapped `Stack` carries no
   vertical padding, or the visual gap becomes `gap + 2 × padding` and stops
   matching the horizontal one. Padding belongs to cells inside a bordered card,
   where borders — not gaps — do the separating.

In TSX, reach for it through the layout primitives rather than a style object:

```tsx
<Stack gap="sm" padding={["sm", "md"]} />   // 12px gap, 12px/16px padding
<Card padding="md" />                        // one token, all sides
<PageContainer padding="xl" />
```

`Stack`, `Card`, `PageContainer` and `EmptyState` take `Space` tokens directly.
Where a style object is genuinely needed, import `space` and index it
(`space.md`, `space["2xl"]`); `spacing()` resolves a token, a `[y, x]` pair, or a
full `[top, right, bottom, left]` set.

## Layout stability

The app is built to hold its position. Four rules keep it that way:

1. **Reserve, don't conditionally render.** A line that comes and goes (status
   text, a winner, buzz feedback) is always rendered and falls back to `\u00A0`,
   or sits in a slot with `min-height`.
2. **State changes must not re-measure text.** Active tabs and nav links change
   colour, never width. Where a weight change is wanted, `.ui-tab::after` holds
   the bold width invisibly so the row cannot reflow.
3. **Reserve media boxes.** `MediaImage` fills a fixed `maxHeight` box by
   default; pass `reserve={false}` only for icons with explicit dimensions.
4. **Chrome has fixed sizes.** `--header-height` and `--quiz-nav-height` are
   tokens; anything pinned beneath them offsets from those, and `#root` pads by
   them rather than relying on centring.

Transient app-state banners (the socket connection notice) are pinned with
`position: fixed` so they never displace content.

## Adding a control

Put it in the lowest layer that fits. If a button, input or badge is styled inline
inside an organism, it belongs in `atoms/` instead. Colours, radii and fonts come
from `styles/tokens.ts` (TS) or the CSS variables in `styles/tokens.css` — never
hard-code a hex value in a component.
