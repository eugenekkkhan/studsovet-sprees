import { IoAddOutline, IoRemoveOutline } from "react-icons/io5";
import { IconButton, Stack, Text } from "../../atoms";

interface WeightStepperProps {
  value: number;
  onChange: (value: number) => void;
  /** Share of the wheel, 0–1. Rendered beside the count. */
  share?: number;
  disabled?: boolean;
  min?: number;
  max?: number;
}

/**
 * Copies of one entry on the wheel. The same control is the odds control —
 * `×3` and "three chances in twelve" are the same wedge.
 */
const WeightStepper = ({
  value,
  onChange,
  share,
  disabled = false,
  min = 1,
  max = 99,
}: WeightStepperProps) => (
  <Stack direction="row" gap="2xs" align="center">
    <IconButton
      size="sm"
      label="Меньше копий"
      disabled={disabled || value <= min}
      onClick={() => onChange(value - 1)}
    >
      <IoRemoveOutline />
    </IconButton>

    <Text as="span" size="xs" weight={700} style={{ minWidth: "24px" }}>
      ×{value}
    </Text>

    <IconButton
      size="sm"
      label="Больше копий"
      disabled={disabled || value >= max}
      onClick={() => onChange(value + 1)}
    >
      <IoAddOutline />
    </IconButton>

    {share !== undefined && (
      <Text as="span" size="xs" tone="muted" style={{ minWidth: "36px" }}>
        {Math.round(share * 100)}%
      </Text>
    )}
  </Stack>
);

export type { WeightStepperProps };
export default WeightStepper;
