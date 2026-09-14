import type { InputHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Input as BaseInput } from "@/components/ui/input";

const inputVariants = cva(
  "rounded-pill border-[1.5px] border-border bg-surface py-0 shadow-none disabled:bg-surface-muted",
  {
    variants: {
      // Heights match Button's, so a field and a button in the same row draw
      // the same pill radius — the one their card's corners are built from.
      inputSize: {
        sm: "h-(--control-height-sm) px-sm text-sm",
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

interface InputProps
  extends InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {}

/** Built on shadcn/ui's Input primitive, restyled to this app's pill inputs. */
const Input = ({
  inputSize = "md",
  invalid = false,
  className,
  ...rest
}: InputProps) => (
  <BaseInput
    aria-invalid={invalid || undefined}
    // Placeholders are not an accessible name — they vanish on the first
    // keystroke. Where a field has no label of its own, fall back to it so
    // the control is at least announced as something.
    aria-label={
      rest["aria-label"] ??
      (rest["aria-labelledby"] ? undefined : rest.placeholder)
    }
    className={cn(inputVariants({ inputSize, invalid }), className)}
    {...rest}
  />
);

export type { InputProps };
export default Input;
