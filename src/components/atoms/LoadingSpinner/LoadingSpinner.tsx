import type { HTMLAttributes } from "react";
import { cn } from "cn";

type LoadingSpinnerSize = "sm" | "md" | "lg";

interface LoadingSpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: LoadingSpinnerSize;
  /** Supply a label only when the spinner is the sole loading announcement. */
  label?: string;
}

const sizeClasses: Record<LoadingSpinnerSize, string> = {
  sm: "size-4 border-2",
  md: "size-6 border-[3px]",
  lg: "size-9 border-4",
};

const LoadingSpinner = ({
  size = "md",
  label,
  className,
  ...rest
}: LoadingSpinnerProps) => (
  <span
    role={label ? "status" : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    className={cn(
      "inline-block shrink-0 animate-spin rounded-full border-current border-r-transparent motion-reduce:animate-none",
      sizeClasses[size],
      className,
    )}
    {...rest}
  />
);

export type { LoadingSpinnerProps, LoadingSpinnerSize };
export default LoadingSpinner;
