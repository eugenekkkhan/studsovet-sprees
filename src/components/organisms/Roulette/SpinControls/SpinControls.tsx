import { Button, Input, Stack, Text } from "../../../atoms";
import { Tabs } from "../../../molecules";
import type { DrawMode } from "../../../../types/roulette";

const modeTabs: { value: DrawMode; label: string }[] = [
  { value: "replace", label: "С возвратом" },
  { value: "remove", label: "На вылет" },
];

interface SpinControlsProps {
  drawMode: DrawMode;
  onDrawMode: (mode: DrawMode) => void;
  picks: number;
  onPicks: (picks: number) => void;
  /** How many entries still have a wedge; caps the pick count. */
  remaining: number;
  spinning: boolean;
  onSpin: () => void;
  onReset: () => void;
}

/** Spin button, draw mode, and how many winners to pull in a row. */
const SpinControls = ({
  drawMode,
  onDrawMode,
  picks,
  onPicks,
  remaining,
  spinning,
  onSpin,
  onReset,
}: SpinControlsProps) => {
  const exhausted = remaining === 0;

  return (
    <Stack gap="sm" block>
      <Tabs
        items={modeTabs}
        value={drawMode}
        onChange={onDrawMode}
        variant="segmented"
        block
      />

      <Stack direction="row" gap="sm" align="center" block>
        <Button
          size="lg"
          variant="success"
          disabled={spinning || exhausted}
          onClick={onSpin}
          style={{ flex: 1 }}
        >
          {spinning ? "Крутится..." : exhausted ? "Все разыграны" : "Крутить колесо"}
        </Button>
        <Button size="lg" variant="neutral" disabled={spinning} onClick={onReset}>
          Сброс
        </Button>
      </Stack>

      {/* Only offered on the "remove" mode: with replacement, "pick 3" can
          return the same name three times — sound odds, unusable result. */}
      {drawMode === "remove" && (
        <Stack direction="row" gap="sm" align="center">
          <Text as="span" size="sm" tone="muted">
            Победителей подряд
          </Text>
          <Input
            type="number"
            aria-label="Сколько победителей выбрать подряд"
            min={1}
            max={Math.max(1, remaining)}
            value={picks}
            disabled={spinning}
            onChange={(event) => onPicks(Number(event.target.value))}
            style={{ width: "84px" }}
          />
        </Stack>
      )}
    </Stack>
  );
};

export type { SpinControlsProps };
export default SpinControls;
