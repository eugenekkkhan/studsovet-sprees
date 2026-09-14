import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Heading,
  Input,
  Inset,
  Notice,
  Stack,
  Text,
} from "../../../atoms";
import { useAuth } from "../../../../hooks/useAuth";
import { useQuizGame } from "../../../../hooks/useQuizGame";
import type { SharedDecks } from "../../../../hooks/useSharedDecks";
import type { Deck } from "../../../../types/quiz";
import { deckStats, hasBlockingIssues } from "../../../../utils/quizDeck";
import { showToast } from "../../../../utils/toast";
import { cardRadius } from "../../../../styles/tokens";

// Same shape as the author's own library: rows padded sm around sm pills.
const DECK_ROW_RADIUS = cardRadius("sm", "sm");

/** Из адреса берём последний сегмент: вставляют обычно всю ссылку целиком. */
const codeFrom = (value: string) => {
  const trimmed = value.trim();
  const fromUrl = /\/quiz\/decks\/access\/([^/?#]+)/.exec(trimmed);
  return decodeURIComponent(fromUrl ? fromUrl[1] : trimmed);
};

/** Открыть колоду, которую автор не публиковал, а прислал кодом или ссылкой. */
const AccessByCodeForm = () => {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const code = codeFrom(value);

  return (
    <Card padding="sm" content="sm" tone="muted">
      <Stack gap="2xs">
        <form
          className="flex w-full flex-wrap items-center gap-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (code) void navigate(`/quiz/decks/access/${encodeURIComponent(code)}`);
          }}
        >
          <Input
            inputSize="sm"
            value={value}
            placeholder="Код доступа или ссылка"
            aria-label="Код доступа к колоде"
            className="min-w-[220px] flex-1"
            onChange={(event) => setValue(event.target.value)}
          />
          <Button size="sm" type="submit" disabled={!code}>
            Открыть
          </Button>
        </form>
        <Text size="xs" tone="muted">
          Колоду, открытую по ссылке, можно посмотреть и запустить у себя — в
          общей библиотеке она не появляется.
        </Text>
      </Stack>
    </Card>
  );
};

interface SharedDecksPanelProps {
  shared: SharedDecks;
  /** Обновляет список своих колод после того, как чужую забрали себе. */
  onCopied: () => void;
}

/**
 * Общие колоды: то, что авторы открыли для всех. Свою можно забрать себе
 * копией и дальше править как обычную. Начальник студсовета видит здесь
 * ещё и приватные — с пометкой, чтобы не спутать их с общими.
 */
const SharedDecksPanel = ({ shared, onCopied }: SharedDecksPanelProps) => {
  const { game, send } = useQuizGame();
  const { user } = useAuth();

  const loadIntoGame = (deck: Deck) => {
    if (hasBlockingIssues(deck)) {
      showToast.error("В этой колоде не дописаны вопросы — её нельзя вести.");
      return;
    }
    if (
      game.deck &&
      !window.confirm("Загрузить колоду в игру? Табло и текущий раунд сбросятся.")
    ) {
      return;
    }
    send({ type: "LOAD_DECK", deck });
    showToast.success(`Колода «${deck.name}» отправлена в игру.`);
  };

  const take = async (authorId: number, deckId: string) => {
    const copy = await shared.copyToOwn(authorId, deckId);
    if (copy) onCopied();
  };

  return (
    <Card padding="lg" content={DECK_ROW_RADIUS}>
      <Stack gap="md">
        <Stack direction="row" gap="sm" align="center" justify="space-between" wrap>
          <Stack gap="2xs">
            <Stack direction="row" gap="xs" align="center" wrap>
              <Heading level={3}>Общие колоды</Heading>
              {shared.isAdmin && <Badge tone="primary">видно всё</Badge>}
            </Stack>
            <Text size="sm" tone="muted">
              {shared.isAdmin
                ? "Здесь всё, что залили в приложение, — включая приватные колоды."
                : "Колоды, которые авторы открыли для всех. Понравившуюся можно забрать себе."}
            </Text>
          </Stack>
          <Inset content="sm">
            <Button
              size="sm"
              variant="ghost"
              disabled={shared.state === "loading"}
              onClick={shared.reload}
            >
              Обновить
            </Button>
          </Inset>
        </Stack>

        <AccessByCodeForm />

        {shared.error && <Notice tone="warning">{shared.error}</Notice>}

        {shared.decks.length === 0 ? (
          <EmptyState paddingY="lg">
            {shared.state === "signedOut"
              ? "Общая библиотека доступна после входа. Откройте приложение из Telegram."
              : shared.state === "loading"
                ? "Забираем общие колоды…"
                : "Общих колод пока нет. Опубликуйте свою — она появится здесь у всех."}
          </EmptyState>
        ) : (
          <Stack gap="sm">
            {shared.decks.map(({ deck, updatedAt, author, visibility }) => {
              const stats = deckStats(deck);
              const mine = author.id === user?.id;
              const inGame = game.deck?.id === deck.id;

              return (
                <Card key={`${author.id}:${deck.id}`} padding="sm" content="sm">
                  <Stack direction="row" gap="sm" align="center" justify="space-between" wrap>
                    <Stack gap="2xs">
                      <Stack direction="row" gap="xs" align="center" wrap>
                        <Text weight={600}>{deck.name}</Text>
                        {mine && <Badge tone="neutral">ваша</Badge>}
                        {visibility === "private" && <Badge tone="danger">приватная</Badge>}
                        {inGame && <Badge tone="success">В игре</Badge>}
                        {stats.incomplete > 0 && (
                          <Badge tone="danger">не дописано: {stats.incomplete}</Badge>
                        )}
                      </Stack>
                      <Text size="sm" tone="muted">
                        {author.name} · {stats.rounds} раунд(а) · {stats.questions} вопросов ·
                        изменена {new Date(updatedAt).toLocaleDateString("ru-RU")}
                      </Text>
                    </Stack>

                    <Stack direction="row" gap="xs" wrap>
                      <Button size="sm" onClick={() => loadIntoGame(deck)}>
                        В игру
                      </Button>
                      {!mine && (
                        <Button
                          size="sm"
                          variant="neutral"
                          onClick={() => void take(author.id, deck.id)}
                        >
                          Добавить себе
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Card>
  );
};

export type { SharedDecksPanelProps };
export default SharedDecksPanel;
