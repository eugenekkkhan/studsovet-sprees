import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { withHaptic, type HapticKind } from "../../../api/telegram";
import LoadingSpinner from "../LoadingSpinner/LoadingSpinner";

const buttonVariants = cva(
  "box-border inline-flex cursor-pointer items-center justify-center gap-2xs rounded-pill leading-tight whitespace-nowrap outline-none transition-[background-color,opacity,border-color] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-primary font-semibold text-primary-foreground hover:opacity-85 disabled:bg-border disabled:text-muted-foreground",
        success:
          "bg-success font-semibold text-success-foreground hover:opacity-85 disabled:bg-border disabled:text-muted-foreground",
        danger:
          "bg-danger font-semibold text-danger-foreground hover:opacity-85 disabled:bg-border disabled:text-muted-foreground",
        neutral:
          "bg-neutral font-semibold text-neutral-foreground hover:opacity-85 disabled:bg-border disabled:text-muted-foreground",
        ghost:
          "border border-border bg-transparent font-medium text-neutral hover:opacity-85 disabled:opacity-50",
        dashed:
          "border border-dashed border-border-strong bg-transparent font-medium text-neutral hover:opacity-85 disabled:opacity-50",
      },
      // Fixed heights, because a pill's radius is half its height and every
      // card around it is sized from that radius. See --control-height-*.
      size: {
        sm: "h-(--control-height-sm) px-sm text-xs",
        md: "h-(--control-height-md) px-md text-sm",
        lg: "h-(--control-height-lg) px-lg text-base",
      },
      block: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

// Отклик задаёт вариант, а не экран: подтверждение ощущается успехом, отказ —
// ошибкой, всё остальное — обычным нажатием.
const variantHaptic: Record<ButtonVariant, HapticKind> = {
  primary: "tap",
  success: "success",
  danger: "failure",
  neutral: "tap",
  ghost: "tap",
  dashed: "tap",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the full width of the parent. */
  block?: boolean;
  /** Keeps the label visible and adds an in-place busy indicator. */
  loading?: boolean;
  /** Override the feedback inferred from variant; false disables it. */
  hapticFeedback?: HapticKind | false;
}

// Ref наружу нужен обёрткам, которые подменяют собой свой триггер: Radix с
// `asChild` отдаёт кнопке разметку поповера и держится за её узел.
const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = "primary",
  size = "md",
  block = false,
  loading = false,
  hapticFeedback,
  className,
  type = "button",
  disabled,
  onClick,
  children,
  ...rest
}, ref) => (
  <button
    ref={ref}
    type={type}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={cn(buttonVariants({ variant, size, block }), className)}
    onClick={
      hapticFeedback === false
        ? onClick
        : withHaptic(hapticFeedback ?? variantHaptic[variant], onClick)
    }
    {...rest}
  >
    {loading && <LoadingSpinner size={size === "lg" ? "md" : "sm"} />}
    {children}
  </button>
));
Button.displayName = "Button";

export type { ButtonProps, ButtonVariant, ButtonSize };
export default Button;
