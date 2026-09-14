import {
  Badge,
  Button,
  Card,
  EmptyState,
  Heading,
  Inset,
  Notice,
  Stack,
  Text,
} from "../../../atoms";
import DeckImportDialog from "../DeckImportDialog/DeckImportDialog";
import type { DeckLibrary } from "../../../../hooks/useDeckLibrary";
import { useAuth } from "../../../../hooks/useAuth";
import { useQuizGame } from "../../../../hooks/useQuizGame";
import type { Deck, DeckVisibility } from "../../../../types/quiz";
import {
  deckStats,
  downloadDeck,
  hasBlockingIssues,
} from "../../../../utils/quizDeck";
import { showToast } from "../../../../utils/toast";
import { cardRadius } from "../../../../styles/tokens";
import DeckShareDialog from "../DeckShareDialog/DeckShareDialog";

// A deck row is padded sm around sm pills; the panel's corners are held by
// those rows, so the panel is that radius plus its own padding.
const DECK_ROW_RADIUS = cardRadius("sm", "sm");

interface DeckLibraryPanelProps {
  library: DeckLibrary;
  /** Смена видимости идёт мимо автосейва — это отдельное решение автора. */
  onPublish?: (deckId: string, visibility: DeckVisibility) => void | Promise<void>;
}

/** Показывает, дошла ли правка до сервера: библиотека сохраняется сама. */
const syncBadge = (state: DeckLibrary["syncState"]) => {
  if (state === "saving") return { tone: "primary" as const, label: "сохраняем…" };
  if (state === "error") return { tone: "danger" as const, label: "не сохранено" };
  if (state === "loading") return { tone: "neutral" as const, label: "загружаем…" };
  if (state === "signedOut") return { tone: "neutral" as const, label: "без входа" };
  return null;
};

/** Библиотека колод автора: хранится на сервере, в игру уходит выбранная. */
const DeckLibraryPanel = ({ library, onPublish }: DeckLibraryPanelProps) => {
  const { game, send } = useQuizGame();
  const { user } = useAuth();
  const badge = syncBadge(library.syncState);
  // Без входа сервер колоды не отдаст: показываем игру, но не даём писать в пустоту.
  const signedOut = library.syncState === "signedOut";

  const loadIntoGame = (deck: Deck) => {
    if (hasBlockingIssues(deck)) {
      showToast.error("Сначала допишите вопросы и ответы — список ошибок ниже.");
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

  return (
    <Card padding="lg" content={DECK_ROW_RADIUS}>
      <Stack gap="md">
        <Stack direction="row" gap="sm" align="center" justify="space-between" wrap>
          <Stack gap="2xs">
            <Stack direction="row" gap="xs" align="center" wrap>
              <Heading level={3}>Библиотека колод</Heading>
              {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
            </Stack>
            <Text size="sm" tone="muted">
              {user
                ? `Автор: ${user.name}. Колоды открываются на любом устройстве, новые видны только вам.`
                : "Колоды хранятся на сервере за автором."}
            </Text>
          </Stack>
          <Inset content="sm" row className="flex-wrap gap-sm">
            <Button size="sm" disabled={signedOut} onClick={() => library.create()}>
              Новая колода
            </Button>
            <Button
              size="sm"
              variant="neutral"
              disabled={signedOut}
              onClick={() => library.create("Пустышка", { rounds: 1, themes: 3, questions: 5, finalThemes: 3 })}
            >
              Быстрая (1 раунд)
            </Button>
            {!signedOut && <DeckImportDialog onImported={library.add} />}
            <Button
              size="sm"
              variant="ghost"
              disabled={signedOut}
              onClick={library.reload}
            >
              Обновить
            </Button>
          </Inset>
        </Stack>

        {library.syncError && <Notice tone="warning">{library.syncError}</Notice>}

        {library.decks.length === 0 ? (
          <EmptyState paddingY="lg">
            {signedOut
              ? "Колоды лежат на сервере за автором. Откройте приложение из Telegram — на пульте комнаты библиотека недоступна."
              : library.syncState === "loading"
                ? "Забираем колоды с сервера…"
                : "Колод пока нет. Создайте новую — сразу появится классическая сетка 3 раунда × 6 тем × 5 вопросов."}
          </EmptyState>
        ) : (
          <Stack gap="sm">
            {library.decks.map((entry) => {
              const { deck, updatedAt, visibility, shareActive } = entry;
              const stats = deckStats(deck);
              const active = library.activeId === deck.id;
              const inGame = game.deck?.id === deck.id;

              return (
                <Card
                  key={deck.id}
                  padding="sm"
                  content="sm"
                  tone={active ? "primary" : "default"}
                >
                  <Stack direction="row" gap="sm" align="center" justify="space-between" wrap>
                    <Stack gap="2xs">
                      <Stack direction="row" gap="xs" align="center" wrap>
                        <Text weight={600}>{deck.name}</Text>
                        <Badge tone={visibility === "published" ? "primary" : "neutral"}>
                          {visibility === "published" ? "общая" : "приватная"}
                        </Badge>
                        {shareActive && <Badge tone="neutral">по ссылке</Badge>}
                        {inGame && <Badge tone="success">В игре</Badge>}
                        {stats.incomplete > 0 && (
                          <Badge tone="danger">не дописано: {stats.incomplete}</Badge>
                        )}
                      </Stack>
                      <Text size="sm" tone="muted">
                        {stats.rounds} раунд(а) · {stats.questions} вопросов · изменена{" "}
                        {new Date(updatedAt).toLocaleDateString("ru-RU")}
                      </Text>
                    </Stack>

                    <Stack direction="row" gap="xs" wrap>
                      {!active && (
                        <Button
                          size="sm"
                          variant="neutral"
                          onClick={() => library.select(deck.id)}
                        >
                          Редактировать
                        </Button>
                      )}
                      <Button size="sm" onClick={() => loadIntoGame(deck)}>
                        В игру
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => downloadDeck(deck)}
                      >
                        Экспорт
                      </Button>
                      <DeckShareDialog
                        deckId={deck.id}
                        deckName={deck.name}
                        active={Boolean(shareActive)}
                        allowCopy={entry.shareAllowCopy !== false}
                        views={entry.shareViews ?? 0}
                        copies={entry.shareCopies ?? 0}
                        lastViewedAt={entry.shareLastViewedAt}
                        onChanged={library.reload}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => library.duplicate(deck.id)}
                      >
                        Копия
                      </Button>
                      {onPublish && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            onPublish(
                              deck.id,
                              visibility === "published" ? "private" : "published",
                            )
                          }
                        >
                          {visibility === "published" ? "Скрыть" : "Опубликовать"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          if (window.confirm(`Удалить колоду «${deck.name}»?`)) {
                            library.remove(deck.id);
                          }
                        }}
                      >
                        Удалить
                      </Button>
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

export type { DeckLibraryPanelProps };
export default DeckLibraryPanel;
