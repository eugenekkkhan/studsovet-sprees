import { Button, Card, Input, Notice, Stack, Text } from "../../../atoms";
import { SortableItem, SortableList } from "../../../molecules";
import DeckFinalEditor from "../DeckFinalEditor/DeckFinalEditor";
import DeckRoundEditor from "../DeckRoundEditor/DeckRoundEditor";
import type { Deck } from "../../../../types/quiz";
import {
  addRound,
  deckIssues,
  deckStats,
  reorderRounds,
} from "../../../../utils/quizDeck";

interface DeckEditorProps {
  deck: Deck;
  onChange: (deck: Deck) => void;
}

/** Полный редактор колоды: шапка, раунды с темами и финальные темы. */
const DeckEditor = ({ deck, onChange }: DeckEditorProps) => {
  const stats = deckStats(deck);
  const issues = deckIssues(deck);
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");

  return (
    <Stack gap="lg">
      <Card padding="lg">
        <Stack gap="sm">
          <Stack direction="row" gap="xs" wrap>
            <Input
              value={deck.name}
              placeholder="Название колоды"
              className="min-w-[220px] flex-1"
              onChange={(event) => onChange({ ...deck, name: event.target.value })}
            />
            <Input
              value={deck.author}
              placeholder="Автор пакета"
              className="min-w-[220px] flex-1"
              onChange={(event) => onChange({ ...deck, author: event.target.value })}
            />
          </Stack>

          <Text size="sm" tone="muted">
            Раундов: {stats.rounds} · тем: {stats.themes} · клеток: {stats.questions} ·
            спецвопросов: {stats.specials} · финальных тем: {stats.finalThemes}
            {stats.incomplete > 0 ? ` · не дописано: ${stats.incomplete}` : ""}
          </Text>

          {errors.length > 0 && (
            <Notice tone="danger">
              <Stack gap="2xs">
                <Text as="span" weight={600}>
                  Пока играть нельзя ({errors.length}):
                </Text>
                {errors.slice(0, 6).map((issue, index) => (
                  <Text as="span" key={index} size="sm">
                    · {issue.message}
                  </Text>
                ))}
                {errors.length > 6 && (
                  <Text as="span" size="sm">
                    …и ещё {errors.length - 6}
                  </Text>
                )}
              </Stack>
            </Notice>
          )}

          {errors.length === 0 && warnings.length > 0 && (
            <Notice tone="warning">
              Играть можно, но есть замечания: {warnings[0].message}
              {warnings.length > 1 ? ` (и ещё ${warnings.length - 1})` : ""}
            </Notice>
          )}

          {issues.length === 0 && <Notice tone="success">Колода готова к игре.</Notice>}
        </Stack>
      </Card>

      <SortableList
        gap="lg"
        items={deck.rounds.map((round) => round.id)}
        onReorder={(fromId, toId) => onChange(reorderRounds(deck, fromId, toId))}
      >
        {deck.rounds.map((round, index) => (
          <SortableItem key={round.id} id={round.id}>
            <DeckRoundEditor
              deck={deck}
              round={round}
              index={index}
              onChange={onChange}
            />
          </SortableItem>
        ))}
      </SortableList>

      <Button variant="dashed" onClick={() => onChange(addRound(deck))}>
        Добавить раунд
      </Button>

      <DeckFinalEditor deck={deck} onChange={onChange} />
    </Stack>
  );
};

export type { DeckEditorProps };
export default DeckEditor;
