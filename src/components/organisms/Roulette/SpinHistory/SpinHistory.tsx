import { useState } from "react";
import { Button, ColorDot, Stack, Text } from "../../../atoms";
import type { SpinRecord } from "../../../../types/roulette";

interface SpinHistoryProps {
  records: SpinRecord[];
  onClear: () => void;
}

const formatTime = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Collapsed log of past spins. Newest first, capped by the hook that feeds it. */
const SpinHistory = ({ records, onClear }: SpinHistoryProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Stack gap="sm" block align="flex-start">
      <Stack direction="row" gap="sm" align="center" wrap>
        <Button
          variant="ghost"
          disabled={records.length === 0}
          onClick={() => setOpen((previous) => !previous)}
        >
          {open ? "Скрыть историю" : `История (${records.length})`}
        </Button>
        {open && records.length > 0 && (
          <Button variant="ghost" onClick={onClear}>
            Очистить историю
          </Button>
        )}
      </Stack>

      {open && (
        <Stack gap="2xs" block align="flex-start">
          {records.map((record) => (
            <Stack key={record.id} direction="row" gap="sm" align="center">
              <ColorDot color={record.color} size={12} />
              <Text as="span" size="sm">
                {record.title}
              </Text>
              <Text as="span" size="xs" tone="muted">
                {formatTime(record.at)}
              </Text>
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

export type { SpinHistoryProps };
export default SpinHistory;
