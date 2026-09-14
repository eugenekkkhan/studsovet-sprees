import { Button, Card, Input, Stack, Text, TextArea } from "../../../atoms";
import { MediaField, ReorderControls, Tabs } from "../../../molecules";
import { useQuizGame } from "../../../../hooks/useQuizGame";
import type { DeckQuestion, QuestionType } from "../../../../types/quiz";
import { QUESTION_TYPE_HINT, QUESTION_TYPE_LABEL } from "../../../../utils/quizLabels";
const typeTabs: { value: QuestionType; label: string }[] = (
  ["simple", "secret", "stake", "norisk"] as const
).map((value) => ({ value, label: QUESTION_TYPE_LABEL[value] }));

interface DeckQuestionEditorProps {
  question: DeckQuestion;
  index: number;
  total: number;
  onChange: (patch: Partial<DeckQuestion>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

/** Одна клетка колоды: цена, тип, текст, ответ и медиа. */
const DeckQuestionEditor = ({
  question,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: DeckQuestionEditorProps) => {
  const { uploadMedia } = useQuizGame();
  const incomplete = !question.text.trim() || !question.answer.trim();

  return (
    <Card padding="md" content="sm" tone={incomplete ? "muted" : "default"}>
      <Stack gap="sm">
        <Stack direction="row" gap="xs" align="center" wrap>
          <Input
            type="number"
            inputSize="sm"
            value={String(question.price)}
            aria-label="Номинал"
            className="max-w-[110px]"
            onChange={(event) => onChange({ price: Number(event.target.value) })}
          />
          <div className="min-w-[260px] flex-1">
            <Tabs
              items={typeTabs}
              value={question.type}
              variant="segmented"
              block
              compact
              onChange={(type) => onChange({ type })}
            />
          </div>
          <ReorderControls
            what="клетку"
            disabledUp={index === 0}
            disabledDown={index === total - 1}
            onUp={() => onMove(-1)}
            onDown={() => onMove(1)}
          />
          <Button size="sm" variant="danger" onClick={onRemove}>
            Удалить
          </Button>
        </Stack>

        <Text size="xs" tone="muted">
          {QUESTION_TYPE_HINT[question.type]}
        </Text>

        <TextArea
          rows={2}
          value={question.text}
          placeholder="Текст вопроса"
          onChange={(event) => onChange({ text: event.target.value })}
        />
        <Input
          value={question.answer}
          placeholder="Ответ"
          invalid={!question.answer.trim()}
          onChange={(event) => onChange({ answer: event.target.value })}
        />

        {question.type === "secret" && (
          <Stack direction="row" gap="xs" wrap>
            <Input
              value={question.secretTheme}
              placeholder="Своя тема «Кота»"
              onChange={(event) => onChange({ secretTheme: event.target.value })}
            />
            <Input
              type="number"
              value={question.secretPrice === null ? "" : String(question.secretPrice)}
              placeholder="Своя цена"
              aria-label="Цена «Кота»"
              className="max-w-[150px]"
              onChange={(event) =>
                onChange({
                  secretPrice:
                    event.target.value.trim() === "" ? null : Number(event.target.value),
                })
              }
            />
          </Stack>
        )}

        <details className="text-left">
          <summary className="cursor-pointer text-[13px] text-muted-foreground">
            Медиа и комментарий ведущему
          </summary>
          <Stack gap="xs" className="pt-sm">
            <MediaField
              label="К вопросу"
              value={question.media}
              upload={uploadMedia}
              onChange={(media) => onChange({ media })}
            />
            <MediaField
              label="К ответу"
              value={question.answerMedia}
              upload={uploadMedia}
              onChange={(answerMedia) => onChange({ answerMedia })}
            />
            <Input
              value={question.comment}
              placeholder="Комментарий: он виден только ведущему"
              onChange={(event) => onChange({ comment: event.target.value })}
            />
          </Stack>
        </details>
      </Stack>
    </Card>
  );
};

export type { DeckQuestionEditorProps };
export default DeckQuestionEditor;
