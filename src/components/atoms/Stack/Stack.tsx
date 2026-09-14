import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "cn";
import { spacing, type Space, type SpaceValue } from "../../../styles/tokens";

const gapClasses: Record<Space, string> = {
  none: "gap-0",
  "2xs": "gap-2xs",
  xs: "gap-xs",
  sm: "gap-sm",
  md: "gap-md",
  lg: "gap-lg",
  xl: "gap-xl",
  "2xl": "gap-2xl",
  "3xl": "gap-3xl",
  "4xl": "gap-4xl",
};

interface StackProps extends HTMLAttributes<HTMLDivElement> {
  direction?: "row" | "column";
  gap?: Space;
  padding?: SpaceValue;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  wrap?: boolean;
  block?: boolean;
}

/** Flex layout primitive — the only place a gap should ever be set. */
const Stack = ({
  direction = "column",
  gap = "sm",
  padding,
  align,
  justify,
  wrap = false,
  block = false,
  className,
  style,
  ...rest
}: StackProps) => (
  <div
    className={cn(
      "flex",
      direction === "row" ? "flex-row" : "flex-col",
      gapClasses[gap],
      wrap && "flex-wrap",
      block && "w-full",
      className,
    )}
    style={{
      padding: spacing(padding),
      alignItems: align,
      justifyContent: justify,
      ...style,
    }}
    {...rest}
  />
);

export type { StackProps };
export default Stack;
