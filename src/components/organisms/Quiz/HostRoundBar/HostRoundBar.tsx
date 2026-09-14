import { Badge, Button, Card, Notice, Stack, Text } from "../../../atoms";
import { useQuizGame } from "../../../../hooks/useQuizGame";
import { PHASE_LABEL } from "../../../../utils/quizLabels";

const IN_PLAY = ["question", "answer", "bidding", "transfer"];

/** Управление ходом партии: раунды, финал, отмена, настройки правил. */
const HostRoundBar = () => {
  const { game, send } = useQuizGame();
  const rounds = game.deck?.rounds ?? [];
  const busy = IN_PLAY.includes(game.phase);
  const finalReady = (game.deck?.finalThemes.length ?? 0) > 0;

  const resetGame = () => {
    if (window.confirm("Начать новую игру и обнулить счёт всех команд?")) {
      send({ type: "NEW_GAME" });
    }
  };

  return (
    <Card padding="md">
      <Stack gap="sm">
        <Stack direction="row" gap="sm" align="center" wrap>
          <Badge tone="primary">{PHASE_LABEL[game.phase]}</Badge>
          {game.deck && <Badge tone="neutral">{game.deck.name}</Badge>}
          <Text size="sm" tone="muted" role="status" aria-live="polite">
            {game.statusMessage}
          </Text>
        </Stack>

        {!game.deck && (
          <Notice tone="warning">
            Колода не загружена — соберите её во вкладке «Колода» и отправьте в игру.
          </Notice>
        )}

        <Stack direction="row" gap="sm" wrap>
          {rounds.map((round, index) => (
            <Button
              key={round.id}
              size="sm"
              variant={game.roundIndex === index ? "primary" : "neutral"}
              disabled={busy || game.teams.length === 0}
              onClick={() => send({ type: "START_ROUND", roundIndex: index })}
            >
              {round.name}
            </Button>
          ))}
          {finalReady && (
            <Button
              size="sm"
              variant={game.phase.startsWith("final") ? "primary" : "neutral"}
              disabled={busy || game.teams.length === 0}
              onClick={() => send({ type: "START_FINAL" })}
            >
              Финал
            </Button>
          )}
        </Stack>

        <Stack direction="row" gap="sm" wrap align="center">
          <Button
            size="sm"
            variant="neutral"
            disabled={!game.undoAvailable}
            onClick={() => send({ type: "UNDO" })}
          >
            Отменить шаг
          </Button>
          <Button
            size="sm"
            variant="neutral"
            disabled={game.phase === "lobby" || game.phase === "game-over"}
            onClick={() => send({ type: "END_ROUND" })}
          >
            Завершить раунд
          </Button>
          <Button size="sm" variant="danger" onClick={resetGame}>
            Новая игра
          </Button>

          <label className="ml-auto flex items-center gap-xs text-sm">
            <input
              type="checkbox"
              checked={game.settings.penalty}
              onChange={(event) =>
                send({
                  type: "SET_SETTINGS",
                  settings: { penalty: event.target.checked },
                })
              }
            />
            Снимать очки за неверный ответ
          </label>
        </Stack>
      </Stack>
    </Card>
  );
};

export default HostRoundBar;
