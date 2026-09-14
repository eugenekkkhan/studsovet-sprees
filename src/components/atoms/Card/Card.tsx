import type { CSSProperties, HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import {
  cardRadius,
  contentRadius,
  inset,
  spacing,
  type ContentRadius,
  type SpaceValue,
} from "../../../styles/tokens";
import { InnerRadiusContext } from "./innerRadius";

type CardTone = NonNullable<VariantProps<typeof cardVariants>["tone"]>;

const cardVariants = cva("box-border border-(length:--card-border-width)", {
  variants: {
    tone: {
      default: "border-border bg-surface",
      primary: "border-primary bg-primary-soft",
      muted: "border-border-subtle bg-surface-muted",
    },
    clip: {
      true: "overflow-hidden",
      false: "",
    },
  },
  defaultVariants: { tone: "default", clip: false },
});

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
  /** Explicit border colour — wins over `tone` (team colours, for instance). */
  borderColor?: string;
  padding?: SpaceValue;
  /**
   * What sits in this card's corners, and therefore what its own radius is
   * built from: a control size (`sm` | `md` | `lg`) or, when another container
   * holds the corners, that container's radius via `cardRadius`.
   */
  content?: ContentRadius;
  /**
   * Escape hatch for a radius that cannot be derived — a fixed dialog shell,
   * say. Everything below it still follows from `radius - padding`.
   */
  radius?: string;
  /** Clip children to the rounded corners (grouped rows, tables). */
  clip?: boolean;
}

/**
 * The app's one rounded surface. Its radius is never picked by hand: it is
 * this card's padding plus the radius of whatever touches its corners, so a
 * control inset by the padding keeps the same corner centre as the card
 * around it. Children read the required radius from `InnerRadiusContext` (and
 * `--card-inner-radius` for the CSS-only ones); a control too small to draw it
 * is wrapped in `Inset` rather than inflated.
 */
const Card = ({
  tone = "default",
  borderColor,
  padding,
  content = "md",
  radius,
  clip = false,
  className,
  style,
  children,
  ...rest
}: CardProps) => {
  const gap = inset(padding);
  const resolvedRadius = radius ?? cardRadius(padding, content);
  // With a derived radius the inner one *is* the content radius; an explicit
  // radius still has to obey the rule, so it gets there by subtraction.
  const innerRadius = radius
    ? `max(0px, calc(${radius} - ${gap}))`
    : contentRadius(content);

  return (
    <div
      className={cn(cardVariants({ tone, clip }), "ui-card", className)}
      style={
        {
          padding: spacing(padding),
          borderColor,
          borderRadius: resolvedRadius,
          "--card-inner-radius": innerRadius,
          ...style,
        } as CSSProperties
      }
      {...rest}
    >
      <InnerRadiusContext.Provider value={innerRadius}>
        {children}
      </InnerRadiusContext.Provider>
    </div>
  );
};

export type { CardProps, CardTone };
export default Card;
