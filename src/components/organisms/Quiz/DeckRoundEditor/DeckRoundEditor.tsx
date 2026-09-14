import { Button, Card, Heading, Input, Stack, Text } from "../../../atoms";
import { ReorderControls, SortableItem, SortableList } from "../../../molecules";
import DeckThemeEditor from "../DeckThemeEditor/DeckThemeEditor";
import type { Deck, DeckRound } from "../../../../types/quiz";
import {
  addTheme,
  moveRound,
  removeRound,
  reorderThemes,
  updateRound,
} from "../../../../utils/quizDeck";
interface DeckRoundEditorProps {
  deck: Deck;
  round: DeckRound;
  index: number;
  onChange: (deck: Deck) => void;
}

/** Раунд колоды: название и набор тем. */
const DeckRoundEditor = ({ deck, round, index, onChange }: DeckRoundEditorProps) => {
  const questions = round.themes.reduce(
    (total, theme) => total + theme.questions.length,
    0,
  );

  return (
    <Card padding="lg" content="sm">
      <Stack gap="md">
        <Stack direction="row" gap="xs" align="center" wrap>
          <Heading level={3}>Раунд {index + 1}</Heading>
          <Input
            inputSize="sm"
            value={round.name}
            placeholder="Название раунда"
            className="min-w-[220px] flex-1"
            onChange={(event) =>
              onChange(updateRound(deck, round.id, { name: event.target.value }))
            }
          />
          <ReorderControls
            what="раунд"
            disabledUp={index === 0}
            disabledDown={index === deck.rounds.length - 1}
            onUp={() => onChange(moveRound(deck, round.id, -1))}
            onDown={() => onChange(moveRound(deck, round.id, 1))}
          />
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (window.confirm(`Удалить раунд «${round.name}» целиком?`)) {
                onChange(removeRound(deck, round.id));
              }
            }}
          >
            Удалить раунд
          </Button>
        </Stack>

        <Text size="sm" tone="muted">
          Тем: {round.themes.length} · клеток: {questions}
        </Text>

        <SortableList
          items={round.themes.map((theme) => theme.id)}
          onReorder={(fromId, toId) =>
            onChange(reorderThemes(deck, round.id, fromId, toId))
          }
        >
          {round.themes.map((theme, themeIndex) => (
            <SortableItem key={theme.id} id={theme.id}>
              <DeckThemeEditor
                deck={deck}
                roundId={round.id}
                theme={theme}
                index={themeIndex}
                total={round.themes.length}
                onChange={onChange}
              />
            </SortableItem>
          ))}
        </SortableList>

        <Button
          size="sm"
          variant="dashed"
          onClick={() => onChange(addTheme(deck, round.id))}
        >
          Добавить тему
        </Button>
      </Stack>
    </Card>
  );
};

export type { DeckRoundEditorProps };
export default DeckRoundEditor;
