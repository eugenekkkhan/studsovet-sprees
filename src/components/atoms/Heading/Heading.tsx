import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "cn";

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3;
  size?: number;
  tone?: "default" | "primary" | "inherit";
  align?: CSSProperties["textAlign"];
}

const defaultSizes: Record<1 | 2 | 3, number> = { 1: 32, 2: 20, 3: 16 };

const toneClasses: Record<NonNullable<HeadingProps["tone"]>, string> = {
  default: "text-text",
  primary: "text-primary-ink",
  inherit: "text-inherit",
};

const Heading = ({
  level = 2,
  size,
  tone = "default",
  align,
  className,
  style,
  ...rest
}: HeadingProps) => {
  const Tag = `h${level}` as "h1" | "h2" | "h3";
  return (
    <Tag
      className={cn("m-0 font-display font-bold", toneClasses[tone], className)}
      style={{
        fontSize: `${size ?? defaultSizes[level]}px`,
        textAlign: align,
        ...style,
      }}
      {...rest}
    />
  );
};

export type { HeadingProps };
export default Heading;
