import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { withHaptic } from "../../../api/telegram";

const iconButtonVariants = cva(
  "box-border inline-flex cursor-pointer appearance-none items-center justify-center rounded-pill border border-border-strong bg-transparent p-0 text-text outline-none transition-[background-color,border-color] focus-visible:ring-[3px] focus-visible:ring-ring/50 [font:inherit] hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      // Square, so the pill radius is half the side — the same seed the
      // sibling Button and Input sizes give their card. See --control-height-*.
      size: {
        sm: "size-(--control-height-sm) text-sm",
        md: "size-(--control-height-md)",
      },
      tone: {
        default: "",
        danger: "border-danger text-danger",
      },
    },
    defaultVariants: { size: "md", tone: "default" },
  },
);

interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  children: ReactNode;
  /** Accessible name for the icon-only control. */
  label?: string;
}

const IconButton = ({
  children,
  size = "md",
  tone = "default",
  label,
  className,
  type = "button",
  onClick,
  ...rest
}: IconButtonProps) => (
  <button
    type={type}
    aria-label={label}
    title={label}
    className={cn(iconButtonVariants({ size, tone }), className)}
    onClick={withHaptic(tone === "danger" ? "failure" : "tap", onClick)}
    {...rest}
  >
    {children}
  </button>
);

export type { IconButtonProps };
export default IconButton;
