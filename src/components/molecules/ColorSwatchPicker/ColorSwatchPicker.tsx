import { ColorDot, Stack } from "../../atoms";

interface ColorSwatchPickerProps {
  colors: readonly string[];
  value: string;
  onChange: (color: string) => void;
  size?: number;
}

const ColorSwatchPicker = ({
  colors,
  value,
  onChange,
  size = 28,
}: ColorSwatchPickerProps) => (
  <Stack direction="row" gap="sm" wrap>
    {colors.map((swatch) => (
      <ColorDot
        key={swatch}
        color={swatch}
        size={size}
        selected={value === swatch}
        label={`Цвет ${swatch}`}
        onClick={() => onChange(swatch)}
      />
    ))}
  </Stack>
);

export type { ColorSwatchPickerProps };
export default ColorSwatchPicker;
