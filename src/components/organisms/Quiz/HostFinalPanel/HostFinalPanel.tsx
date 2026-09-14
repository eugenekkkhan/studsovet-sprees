import { Badge, Button, Card, Heading, Notice, Stack, Text } from "../../../atoms";
import { MediaPreview } from "../../../molecules";
import HostAnswerReveal from "../HostAnswerReveal/HostAnswerReveal";
import { useQuizGame } from "../../../../hooks/useQuizGame";

/** Финал: вычёркивание тем, ставки, ответы и вскрытие конвертов. */
const HostFinalPanel = () => {
  const { game, send } = useQuizGame();
  const final = game.final;
  if (!final) return null;

  const teamName = (teamId: string | null) =>
    game.teams.find((team) => team.id === teamId)?.name ?? "—";
  const participants = final.participantIds
    .map((id) => game.teams.find((team) => team.id === id))
    .filter((team): team is NonNullable<typeof team> => Boolean(team))
    .sort((left, right) => left.score - right.score);
  const question = game.deck?.finalThemes.find(
    (theme) => theme.id === final.playingThemeId,
  );
  const nextToReveal = participants.find(
    (team) => !final.revealedTeamIds.includes(team.id),
  );
  const betPlaced = Object.keys(final.bets);
  const answerPlaced = Object.keys(final.answers);

  return (
    <Card padding="lg" tone="primary">
      <Stack gap="md">
        <Stack direction="row" gap="sm" align="center" wrap>
          <Heading level={2} size={22}>
            Финальный раунд
          </Heading>
          <Badge tone="neutral">играют: {participants.length}</Badge>
          {question && <Badge tone="primary">Тема: {question.name}</Badge>}
        </Stack>

        {game.phase === "final-themes" && (
          <Stack gap="sm">
            <Notice tone="info">
              Тему убирает «{teamName(final.turnTeamId)}» — по очереди, начиная с
              аутсайдера.
            </Notice>
            <Stack direction="row" gap="sm" wrap>
              {final.themes.map((theme) => {
                const removed = final.removedThemeIds.includes(theme.id);
                return (
                  <Button
                    key={theme.id}
                    size="sm"
                    variant={removed ? "neutral" : "primary"}
                    disabled={removed}
                    onClick={() =>
                      send({ type: "FINAL_REMOVE_THEME", themeId: theme.id })
                    }
                  >
                    {removed ? `✕ ${theme.name}` : `Убрать «${theme.name}»`}
                  </Button>
                );
              })}
            </Stack>
          </Stack>
        )}

        {game.phase === "final-bets" && (
          <Stack gap="sm">
            <Notice tone="info">
              Команды делают закрытые ставки со своих телефонов: от 1 до всей суммы.
            </Notice>
            <Stack direction="row" gap="sm" wrap>
              {participants.map((team) => (
                <Badge
                  key={team.id}
                  tone={betPlaced.includes(team.id) ? "success" : "neutral"}
                >
                  {team.name}: {betPlaced.includes(team.id) ? "готово" : "ждём"}
                </Badge>
              ))}
            </Stack>
          </Stack>
        )}

        {(game.phase === "final-answers" ||
          game.phase === "final-reveal" ||
          game.phase === "game-over") &&
          question && (
            <Stack gap="sm">
              <Text as="p" size="xl" weight={600}>
                {question.text}
              </Text>
              <MediaPreview url={question.media?.url} type={question.media?.type} />
              <HostAnswerReveal
                answer={question.answer}
                media={question.answerMedia}
                comment={question.comment}
                resetKey={question.id}
                revealed={game.phase === "final-reveal" || game.phase === "game-over"}
              />
            </Stack>
          )}

        {game.phase === "final-answers" && (
          <Stack gap="sm">
            <Stack direction="row" gap="sm" wrap>
              {participants.map((team) => (
                <Badge
                  key={team.id}
                  tone={
                    answerPlaced.includes(team.id) ? "success" : "neutral"
                  }
                >
                  {team.name}:{" "}
                  {answerPlaced.includes(team.id) ? "ответ записан" : "пишет"}
                </Badge>
              ))}
            </Stack>
            <Button variant="neutral" onClick={() => send({ type: "FINAL_LOCK_ANSWERS" })}>
              Время вышло — вскрываем
            </Button>
          </Stack>
        )}

        {(game.phase === "final-reveal" || game.phase === "game-over") && (
          <Stack gap="sm">
            {participants.map((team) => {
              const revealed = final.revealedTeamIds.includes(team.id);
              const judged = final.judgedTeamIds.includes(team.id);
              return (
                <Card key={team.id} borderColor={team.color} padding="sm" content="sm">
                  <Stack direction="row" gap="sm" align="center" justify="space-between" wrap>
                    <Stack gap="2xs">
                      <Text weight={600}>
                        {team.name} · счёт {team.score}
                      </Text>
                      <Text size="sm" tone={revealed ? "default" : "muted"}>
                        {revealed
                          ? `Ставка ${final.bets[team.id] ?? 0} · ответ: ${final.answers[team.id] || "—"}`
                          : "Конверт закрыт"}
                      </Text>
                    </Stack>
                    {revealed && !judged && (
                      <Stack direction="row" gap="xs">
                        <Button
                          size="sm"
                          onClick={() =>
                            send({ type: "FINAL_JUDGE", teamId: team.id, correct: true })
                          }
                        >
                          Верно
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() =>
                            send({ type: "FINAL_JUDGE", teamId: team.id, correct: false })
                          }
                        >
                          Неверно
                        </Button>
                      </Stack>
                    )}
                    {judged && <Badge tone="neutral">Засчитано</Badge>}
                  </Stack>
                </Card>
              );
            })}

            {nextToReveal && (
              <Button onClick={() => send({ type: "FINAL_REVEAL_NEXT" })}>
                Вскрыть конверт «{nextToReveal.name}»
              </Button>
            )}
          </Stack>
        )}
      </Stack>
    </Card>
  );
};

export default HostFinalPanel;
