import type { HTMLAttributes } from "react";
import { cn } from "cn";
import type { Space } from "../../../styles/tokens";

const paddingYClasses: Record<Space, string> = {
  none: "py-0",
  "2xs": "py-2xs",
  xs: "py-xs",
  sm: "py-sm",
  md: "py-md",
  lg: "py-lg",
  xl: "py-xl",
  "2xl": "py-2xl",
  "3xl": "py-3xl",
  "4xl": "py-4xl",
};

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Vertical breathing room; horizontal padding is always zero. */
  paddingY?: Space;
}

/** Centred muted placeholder for "nothing here yet" states. */
const EmptyState = ({ paddingY = "2xl", className, ...rest }: EmptyStateProps) => (
  <div
    className={cn(
      "px-0 text-center text-[15px] text-muted-foreground",
      paddingYClasses[paddingY],
      className,
    )}
    {...rest}
  />
);

export type { EmptyStateProps };
export default EmptyState;
