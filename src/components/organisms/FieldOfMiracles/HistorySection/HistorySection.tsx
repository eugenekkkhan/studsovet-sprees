import { Card, EmptyState, Heading, Stack, Text } from "../../../atoms";
import { useGameContext } from "../../../../hooks/useGameContext";
import type { GameMessageTone } from "../../../../types/fieldOfMiracles";

const toneClass: Record<GameMessageTone, string> = {
  info: "border-primary",
  success: "border-success",
  warning: "border-warning-strong",
  danger: "border-danger",
};

/** The latest host actions; the reducer keeps the full persisted game log. */
const HistorySection = () => {
  const { game } = useGameContext();
  const entries = game.history.slice(-8).reverse();

  return (
    <Card padding="md">
      <Stack gap="sm">
        <Heading level={3}>История</Heading>
        {entries.length === 0 ? (
          <EmptyState paddingY="sm">Событий пока нет.</EmptyState>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-xs p-0 text-left">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className={`border-l-2 pl-sm ${toneClass[entry.tone]}`}
              >
                <Text as="p" size="sm">
                  {entry.message}
                </Text>
              </li>
            ))}
          </ol>
        )}
      </Stack>
    </Card>
  );
};

export default HistorySection;
