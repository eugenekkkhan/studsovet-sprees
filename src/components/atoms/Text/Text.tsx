import type { CSSProperties, HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

type TextTone = NonNullable<VariantProps<typeof textVariants>["tone"]>;
type TextSize = NonNullable<VariantProps<typeof textVariants>["size"]>;

const textVariants = cva("m-0", {
  variants: {
    tone: {
      default: "text-text",
      muted: "text-muted-foreground",
      primary: "text-primary-ink",
      primaryStrong: "text-primary-strong",
      primaryMuted: "text-primary-muted",
      neutral: "text-neutral",
      danger: "text-danger",
      success: "text-success-strong",
      inherit: "text-inherit",
    },
    size: {
      xxs: "text-[11px]",
      xs: "text-xs",
      sm: "text-[13px]",
      md: "text-sm",
      lg: "text-base",
      xl: "text-lg",
    },
    display: {
      true: "font-display",
      false: "",
    },
    uppercase: {
      true: "uppercase tracking-[0.05em]",
      false: "",
    },
    italic: {
      true: "italic",
      false: "",
    },
  },
  defaultVariants: {
    tone: "default",
    size: "md",
    display: false,
    uppercase: false,
    italic: false,
  },
});

const weightClasses: Record<400 | 500 | 600 | 700, string> = {
  400: "font-normal",
  500: "font-medium",
  600: "font-semibold",
  700: "font-bold",
};

interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: "span" | "p" | "div";
  tone?: TextTone;
  size?: TextSize;
  weight?: 400 | 500 | 600 | 700;
  /** Use the display face (Unbounded) instead of the body face. */
  display?: boolean;
  uppercase?: boolean;
  italic?: boolean;
  align?: CSSProperties["textAlign"];
}

const Text = ({
  as: Tag = "span",
  tone = "default",
  size = "md",
  weight,
  display = false,
  uppercase = false,
  italic = false,
  align,
  className,
  style,
  ...rest
}: TextProps) => (
  <Tag
    className={cn(
      textVariants({ tone, size, display, uppercase, italic }),
      weight && weightClasses[weight],
      className,
    )}
    style={{ textAlign: align, ...style }}
    {...rest}
  />
);

export type { TextProps, TextTone, TextSize };
export default Text;
