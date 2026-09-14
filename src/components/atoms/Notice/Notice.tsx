import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

type NoticeTone = NonNullable<VariantProps<typeof noticeVariants>["tone"]>;

// A notice has no shape of its own — it spans the card's content box, so it
// takes whatever corner that card asks for (see .ui-surface). It also carries
// the matching control height as a floor: a shorter box cannot physically draw
// that corner, and the browser would quietly shrink it to half the height.
const noticeVariants = cva("ui-surface flex flex-col justify-center font-medium", {
  variants: {
    tone: {
      info: "bg-primary-soft text-primary-ink",
      success: "bg-success-soft text-success-strong",
      warning: "bg-warning-soft text-warning-strong",
      danger: "bg-danger-tint text-danger-strong",
      error: "bg-danger-soft text-danger",
    },
    size: {
      sm: "min-h-(--control-height-sm) px-sm py-2xs text-[13px]",
      md: "min-h-(--control-height-md) px-md py-xs text-sm",
    },
  },
  defaultVariants: { tone: "info", size: "md" },
});

interface NoticeProps extends HTMLAttributes<HTMLDivElement> {
  tone?: NoticeTone;
  size?: "sm" | "md";
}

/** Inline coloured banner: connection warnings, answer prompts, form errors. */
const Notice = ({ tone = "info", size = "md", className, ...rest }: NoticeProps) => (
  <div className={cn(noticeVariants({ tone, size }), className)} {...rest} />
);

export type { NoticeProps, NoticeTone };
export default Notice;
