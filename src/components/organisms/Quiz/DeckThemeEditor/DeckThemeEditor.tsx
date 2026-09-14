import { Button, Card, Input, Stack, Text } from "../../../atoms";
import { ReorderControls, SortableItem, SortableList } from "../../../molecules";
import DeckQuestionEditor from "../DeckQuestionEditor/DeckQuestionEditor";
import type { Deck, DeckTheme } from "../../../../types/quiz";
import {
  addQuestion,
  moveQuestion,
  moveTheme,
  removeQuestion,
  removeTheme,
  reorderQuestions,
  updateQuestion,
  updateTheme,
} from "../../../../utils/quizDeck";
interface DeckThemeEditorProps {
  deck: Deck;
  roundId: string;
  theme: DeckTheme;
  index: number;
  total: number;
  onChange: (deck: Deck) => void;
}

/** Тема раунда со своими клетками. Свёрнута, пока её не открыли. */
const DeckThemeEditor = ({
  deck,
  roundId,
  theme,
  index,
  total,
  onChange,
}: DeckThemeEditorProps) => {
  const filled = theme.questions.filter(
    (question) => question.text.trim() && question.answer.trim(),
  ).length;
  const specials = theme.questions.filter((question) => question.type !== "simple");

  return (
    <Card padding="md" clip content="sm">
      <details>
        <summary className="flex cursor-pointer flex-wrap items-center gap-sm">
          <Text as="span" weight={600}>
            {theme.name || "Тема без названия"}
          </Text>
          <Text as="span" size="sm" tone={filled === theme.questions.length ? "success" : "muted"}>
            {filled} из {theme.questions.length} готово
          </Text>
          {specials.length > 0 && (
            <Text as="span" size="sm" tone="primary">
              спецвопросов: {specials.length}
            </Text>
          )}
          <span className="ml-auto flex items-center gap-xs">
            <ReorderControls
              what="тему"
              keepOpen
              disabledUp={index === 0}
              disabledDown={index === total - 1}
              onUp={() => onChange(moveTheme(deck, roundId, theme.id, -1))}
              onDown={() => onChange(moveTheme(deck, roundId, theme.id, 1))}
            />
            <Button
              size="sm"
              variant="danger"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (window.confirm(`Удалить тему «${theme.name || "без названия"}»?`)) {
                  onChange(removeTheme(deck, roundId, theme.id));
                }
              }}
            >
              Удалить
            </Button>
          </span>
        </summary>

        <Stack gap="sm" className="pt-md">
          <Input
            value={theme.name}
            placeholder="Название темы"
            invalid={!theme.name.trim()}
            onChange={(event) =>
              onChange(updateTheme(deck, roundId, theme.id, { name: event.target.value }))
            }
          />

          <SortableList
            items={theme.questions.map((question) => question.id)}
            onReorder={(fromId, toId) =>
              onChange(reorderQuestions(deck, roundId, theme.id, fromId, toId))
            }
          >
            {theme.questions.map((question, questionIndex) => (
              <SortableItem key={question.id} id={question.id}>
                <DeckQuestionEditor
                  question={question}
                  index={questionIndex}
                  total={theme.questions.length}
                  onChange={(patch) =>
                    onChange(updateQuestion(deck, roundId, theme.id, question.id, patch))
                  }
                  onMove={(direction) =>
                    onChange(moveQuestion(deck, roundId, theme.id, question.id, direction))
                  }
                  onRemove={() =>
                    onChange(removeQuestion(deck, roundId, theme.id, question.id))
                  }
                />
              </SortableItem>
            ))}
          </SortableList>

          <Button
            size="sm"
            variant="dashed"
            onClick={() => onChange(addQuestion(deck, roundId, theme.id))}
          >
            Добавить клетку
          </Button>
        </Stack>
      </details>
    </Card>
  );
};

export type { DeckThemeEditorProps };
export default DeckThemeEditor;
