import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

const badgeVariants = cva(
  "inline-block rounded-pill px-sm py-2xs text-[13px] leading-[1.4] font-semibold",
  {
    variants: {
      tone: {
        primary: "bg-primary-soft text-primary-ink",
        neutral: "bg-surface-muted text-neutral",
        success: "bg-success-soft text-success-strong",
        danger: "bg-danger-tint text-danger-strong",
      },
    },
    defaultVariants: { tone: "primary" },
  },
);

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/** Small rounded pill used for phases, points and other short labels. */
const Badge = ({ tone = "primary", className, ...rest }: BadgeProps) => (
  <span className={cn(badgeVariants({ tone }), className)} {...rest} />
);

export type { BadgeProps, BadgeTone };
export default Badge;
