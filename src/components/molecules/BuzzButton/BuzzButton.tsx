import { cn } from "cn";
import { withHaptic } from "../../../api/telegram";
import { font } from "../../../styles/tokens";

interface BuzzButtonProps {
  label: string;
  enabled: boolean;
  onClick: () => void;
  size?: number;
}

/** The captain's big round buzzer. */
const BuzzButton = ({ label, enabled, onClick, size = 200 }: BuzzButtonProps) => (
  <button
    type="button"
    onClick={withHaptic("press", onClick)}
    disabled={!enabled}
    aria-live="polite"
    className={cn(
      "touch-manipulation select-none rounded-full border-0 bg-border text-muted-foreground outline-none transition-[background-color,color,box-shadow,transform] focus-visible:ring-[4px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:scale-[0.96]",
      enabled &&
        "cursor-pointer bg-primary text-primary-foreground shadow-[0_8px_24px_color-mix(in_srgb,var(--color-primary)_35%,transparent)] active:scale-[0.92]",
    )}
    style={{
      width: `min(${size}px, 54vw)`,
      aspectRatio: "1",
      fontFamily: font.display,
      fontSize: "clamp(18px, 5vw, 22px)",
      fontWeight: 700,
    }}
  >
    {label}
  </button>
);

export type { BuzzButtonProps };
export default BuzzButton;
