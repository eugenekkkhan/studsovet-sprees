import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "cn";
import {
  contentRadius,
  space,
  type ContentRadius,
  type Space,
} from "../../../styles/tokens";
import { InnerRadiusContext, useInnerRadius } from "../Card/innerRadius";

interface InsetProps extends HTMLAttributes<HTMLDivElement> {
  /** What this section holds, and therefore the corner it hands down. */
  content?: ContentRadius;
  /** Padding the section wants in its own right; topped up when it falls short. */
  padding?: Space;
  /**
   * Lay the children out in a row. Left off, this is a plain block: a flex
   * container would shrink a lone child to its own height, which silently
   * kills scrolling inside it.
   */
  row?: boolean;
}

/**
 * Corner adapter. A container's corners demand a radius; a pill cannot draw a
 * bigger one without growing taller, so it is wrapped instead of inflated:
 * this box pads by the difference, which puts the control back on a concentric
 * corner at its own natural size.
 *
 * It is pure geometry and paints nothing — no radius of its own either. The
 * corner is already drawn by the container; rounding this box too would only
 * bend whatever the caller does paint, which is how a `border-b` on a dialog
 * header ends up curling into an eyebrow. A section that needs a surface of
 * its own is a `Card`, not an `Inset`.
 *
 * Where a section already has padding (a dialog's header, a scroll body),
 * declare it as `padding` and the wrapper tops it up rather than stacking.
 */
const Inset = ({
  content = "md",
  padding,
  row = false,
  className,
  style,
  children,
  ...rest
}: InsetProps) => {
  const outer = useInnerRadius();
  const inner = contentRadius(content);
  const own = padding ? space[padding] : "0px";

  return (
    <div
      className={cn("box-border", row && "flex flex-row", className)}
      style={
        {
          padding: `max(${own}, calc(${outer} - ${inner}))`,
          "--card-inner-radius": inner,
          ...style,
        } as CSSProperties
      }
      {...rest}
    >
      <InnerRadiusContext.Provider value={inner}>
        {children}
      </InnerRadiusContext.Provider>
    </div>
  );
};

export type { InsetProps };
export default Inset;
