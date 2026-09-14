import type { ButtonHTMLAttributes } from "react";
import { cn } from "cn";
import { withHaptic } from "../../../api/telegram";

interface LetterTileProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  letter: string;
  /** Revealed tiles show the glyph, hidden ones show a filled card. */
  revealed: boolean;
  size?: number;
  /** Word slots stay softer; compact alphabet choices use tighter corners. */
  shape?: "slot" | "choice" | "preview";
}

const LetterTile = ({
  letter,
  revealed,
  size = 50,
  shape = "slot",
  className,
  style,
  type = "button",
  onClick,
  ...rest
}: LetterTileProps) => (
  <button
    type={type}
    // Названная буква — ход в игре, и удар тут заметнее выбора позиции.
    onClick={withHaptic(shape === "choice" ? "press" : "tap", onClick)}
    className={cn(
      "relative box-border flex shrink-0 appearance-none items-center justify-center cursor-pointer border-2 border-primary p-0 text-center font-bold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default",
      shape === "choice"
        ? "rounded-sm"
        : shape === "preview"
          ? "rounded-md"
          : "rounded-lg",
      revealed ? "bg-transparent" : "bg-primary",
      className,
    )}
    style={{
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${Math.round(size * 0.64)}px`,
      ...style,
    }}
    {...rest}
  >
    {revealed && (
      <span
        className={cn(
          "absolute inset-0 inline-flex items-center justify-center leading-none",
          shape !== "slot"
            ? "translate-x-px -translate-y-[2px]"
            : "translate-x-px -translate-y-px",
        )}
      >
        {letter.toUpperCase()}
      </span>
    )}
  </button>
);

export type { LetterTileProps };
export default LetterTile;
