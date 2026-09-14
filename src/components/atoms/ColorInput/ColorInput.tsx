import type { InputHTMLAttributes } from "react";
import { cn } from "cn";

interface ColorInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Drop the frame — useful when the swatch sits inside another control. */
  bare?: boolean;
}

const ColorInput = ({ bare = false, className, ...rest }: ColorInputProps) => (
  <input
    type="color"
    // A colour swatch carries no text, so without this it is announced as an
    // unlabelled form control. Call sites can still pass something better.
    aria-label={rest["aria-label"] ?? "Выбрать цвет"}
    className={cn(
      "size-(--control-height-md) shrink-0 cursor-pointer rounded-pill border-[1.5px] border-border bg-transparent p-2xs",
      "[&::-webkit-color-swatch]:rounded-pill [&::-webkit-color-swatch]:border-none",
      "[&::-webkit-color-swatch-wrapper]:p-0",
      "[&::-moz-color-swatch]:rounded-pill [&::-moz-color-swatch]:border-none",
      bare && "overflow-hidden border-none p-0",
      className,
    )}
    {...rest}
  />
);

export type { ColorInputProps };
export default ColorInput;
