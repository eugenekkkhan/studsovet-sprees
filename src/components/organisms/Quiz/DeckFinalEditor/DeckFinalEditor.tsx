import { Button, Card, Heading, Input, Stack, Text, TextArea } from "../../../atoms";
import { MediaField } from "../../../molecules";
import { useQuizGame } from "../../../../hooks/useQuizGame";
import type { Deck } from "../../../../types/quiz";
import {
  addFinalTheme,
  removeFinalTheme,
  updateFinalTheme,
} from "../../../../utils/quizDeck";
interface DeckFinalEditorProps {
  deck: Deck;
  onChange: (deck: Deck) => void;
}

/** Темы финального раунда: из них команды по очереди вычёркивают лишние. */
const DeckFinalEditor = ({ deck, onChange }: DeckFinalEditorProps) => {
  const { uploadMedia } = useQuizGame();

  return (
  <Card padding="lg">
    <Stack gap="md">
      <Stack gap="2xs">
        <Heading level={3}>Финальный раунд</Heading>
        <Text size="sm" tone="muted">
          Классика — семь тем: команды убирают их по очереди, пока не останется одна.
          Тема без вопроса или названия в игру не попадёт.
        </Text>
      </Stack>

      {deck.finalThemes.map((theme, index) => (
        <Card
          key={theme.id}
          padding="md"
          tone={theme.text.trim() ? "default" : "muted"}
        >
          <Stack gap="sm">
            <Stack direction="row" gap="xs" align="center" wrap>
              <Input
                value={theme.name}
                placeholder={`Тема ${index + 1}`}
                className="min-w-[180px] flex-1"
                onChange={(event) =>
                  onChange(updateFinalTheme(deck, theme.id, { name: event.target.value }))
                }
              />
              <Button
                variant="danger"
                onClick={() => onChange(removeFinalTheme(deck, theme.id))}
              >
                Удалить
              </Button>
            </Stack>
            <TextArea
              rows={2}
              value={theme.text}
              placeholder="Финальный вопрос"
              onChange={(event) =>
                onChange(updateFinalTheme(deck, theme.id, { text: event.target.value }))
              }
            />
            <Input
              value={theme.answer}
              placeholder="Ответ"
              onChange={(event) =>
                onChange(updateFinalTheme(deck, theme.id, { answer: event.target.value }))
              }
            />
            <MediaField
              label="К вопросу"
              value={theme.media}
              upload={uploadMedia}
              onChange={(media) => onChange(updateFinalTheme(deck, theme.id, { media }))}
            />
            <MediaField
              label="К ответу"
              value={theme.answerMedia}
              upload={uploadMedia}
              onChange={(answerMedia) =>
                onChange(updateFinalTheme(deck, theme.id, { answerMedia }))
              }
            />
          </Stack>
        </Card>
      ))}

      <Button variant="dashed" onClick={() => onChange(addFinalTheme(deck))}>
        Добавить финальную тему
      </Button>
    </Stack>
  </Card>
  );
};

export type { DeckFinalEditorProps };
export default DeckFinalEditor;
