import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "cn";
import { withHaptic } from "../../../api/telegram";

interface ColorDotProps
  extends Omit<HTMLAttributes<HTMLElement>, "color" | "onClick"> {
  color: string;
  size?: number;
  /** Draws a ring — used by the colour picker. */
  selected?: boolean;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  /** Accessible name. Required once the dot is clickable. */
  label?: string;
}

const ColorDot = ({
  color,
  size = 18,
  selected,
  className,
  style,
  onClick,
  label,
  ...rest
}: ColorDotProps) => {
  const shared = {
    className: cn(
      "box-border shrink-0 rounded-full",
      selected !== undefined && "border-[3px]",
      selected === true && "border-text",
      selected === false && "border-transparent",
      className,
    ),
    style: {
      width: `${size}px`,
      height: `${size}px`,
      background: color,
      ...style,
    },
  };

  // A clickable dot is a real button: a span with role="button" took no focus
  // and answered no key, so the colour picker was mouse-only.
  if (onClick) {
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        onClick={withHaptic("tap", onClick)}
        {...shared}
        className={cn(
          shared.className,
          "cursor-pointer appearance-none p-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          selected === undefined && "border-0",
        )}
        {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
      />
    );
  }

  return <span {...shared} {...rest} />;
};

export type { ColorDotProps };
export default ColorDot;
