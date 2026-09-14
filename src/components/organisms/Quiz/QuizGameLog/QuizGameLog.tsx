import { Card, EmptyState, Heading, Stack, Text } from "../../../atoms";
import type { GameLogEntry, GameMessageTone } from "../../../../types/quiz";

const toneClass: Record<GameMessageTone, string> = {
  info: "border-primary",
  success: "border-success",
  warning: "border-warning-strong",
  danger: "border-danger",
};

interface QuizGameLogProps {
  history: GameLogEntry[];
  limit?: number;
  title?: string;
}

/** Последние события игры — ведущему проще восстановить, что происходило. */
const QuizGameLog = ({
  history,
  limit = 10,
  title = "Ход игры",
}: QuizGameLogProps) => {
  const entries = history.slice(-limit).reverse();

  return (
    <Card padding="md">
      <Stack gap="sm">
        <Heading level={3}>{title}</Heading>
        {entries.length === 0 ? (
          <EmptyState paddingY="sm">Событий пока нет.</EmptyState>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-xs p-0 text-left">
            {entries.map((entry) => (
              <li key={entry.id} className={`border-l-2 pl-sm ${toneClass[entry.tone]}`}>
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

export type { QuizGameLogProps };
export default QuizGameLog;
