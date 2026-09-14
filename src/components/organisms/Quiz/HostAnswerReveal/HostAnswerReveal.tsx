import { useEffect, useState } from "react";
import { Button, Card, Stack, Text } from "../../../atoms";
import { AnswerBox } from "../../../molecules";
import { useQuizGame } from "../../../../hooks/useQuizGame";
import type { Media } from "../../../../types/quiz";

interface HostAnswerRevealProps {
  answer: string;
  media?: Media | null;
  /** Заметка редактора — она тоже выдаёт ответ, прячем вместе с ним. */
  comment?: string;
  /** Смена значения возвращает ответ на экран, если его прятали руками. */
  resetKey: string;
  /** Ответ уже прозвучал для зала — скрывать нечего. */
  revealed?: boolean;
}

/**
 * Это экран ведущего, поэтому ответ на нём виден сразу — искать его по кнопке
 * посреди партии некогда. Прятать приходится редко (если за спиной стоят
 * зрители и экран им виден), поэтому это ручное действие, а не режим по
 * умолчанию; на следующем вопросе ответ снова открыт.
 */
const HostAnswerReveal = ({
  answer,
  media = null,
  comment = "",
  resetKey,
  revealed = false,
}: HostAnswerRevealProps) => {
  const { isRemoteHost } = useQuizGame();
  const [shown, setShown] = useState(true);

  useEffect(() => {
    setShown(true);
  }, [resetKey]);

  const visible = isRemoteHost || revealed || shown;

  if (!visible) {
    return (
      <Card padding="md" tone="muted">
        <Stack direction="row" gap="sm" align="center" justify="space-between" wrap>
          <Stack gap="2xs">
            <Text size="sm" weight={600}>
              Ответ скрыт
            </Text>
            <Text size="sm" tone="muted">
              Вы скрыли его с этого экрана. На пульте ведущего он виден всегда.
            </Text>
          </Stack>
          <Button size="sm" variant="neutral" onClick={() => setShown(true)}>
            Показать
          </Button>
        </Stack>
      </Card>
    );
  }

  return (
    <Stack gap="2xs">
      <AnswerBox
        answer={answer}
        mediaUrl={media?.url}
        mediaType={media?.type}
        size="md"
      />
      {comment && (
        <Text as="p" size="sm" tone="muted">
          Комментарий редактора: {comment}
        </Text>
      )}
      {/* Ответ виден по умолчанию, так что красная метка про это была бы шумом
          на каждом вопросе: остаётся только сама возможность его убрать. */}
      {!isRemoteHost && !revealed && (
        <Stack direction="row" gap="xs" align="center">
          <Button size="sm" variant="ghost" onClick={() => setShown(false)}>
            Скрыть с этого экрана
          </Button>
        </Stack>
      )}
    </Stack>
  );
};

export type { HostAnswerRevealProps };
export default HostAnswerReveal;
