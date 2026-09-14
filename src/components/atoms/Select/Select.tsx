import type { SelectHTMLAttributes } from "react";
import { IoChevronDown } from "react-icons/io5";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { space } from "../../../styles/tokens";

const selectVariants = cva(
  [
    "w-full cursor-pointer appearance-none rounded-pill border-[1.5px]",
    "border-border bg-surface pr-2xl shadow-none outline-none transition-[color,box-shadow]",
    "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/40",
    "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60",
  ].join(" "),
  {
    variants: {
      inputSize: {
        md: "h-(--control-height-md) px-md text-sm",
        lg: "h-(--control-height-lg) px-lg text-[15px]",
      },
      invalid: {
        true: "border-danger",
        false: "",
      },
    },
    defaultVariants: { inputSize: "md", invalid: false },
  },
);

interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement>,
    VariantProps<typeof selectVariants> {}

/** Выпадающий список в стиле полей приложения: своя стрелка вместо системной. */
const Select = ({
  inputSize = "md",
  invalid = false,
  className,
  children,
  ...rest
}: SelectProps) => (
  <span className={cn("relative inline-flex min-w-0 items-center", className)}>
    <select
      aria-invalid={invalid || undefined}
      className={selectVariants({ inputSize, invalid })}
      {...rest}
    >
      {children}
    </select>
    <IoChevronDown
      aria-hidden
      className="pointer-events-none absolute text-muted-foreground"
      style={{ right: space.sm }}
    />
  </span>
);

export type { SelectProps };
export default Select;
