import { Badge, Button, Card, Heading, Notice, Stack, Text } from "../../../atoms";
import { MediaPreview } from "../../../molecules";
import HostAnswerReveal from "../HostAnswerReveal/HostAnswerReveal";
import { useQuizGame } from "../../../../hooks/useQuizGame";
import { QUESTION_TYPE_LABEL } from "../../../../utils/quizLabels";

/** Разыгрываемый вопрос и всё судейство: кнопки, «верно/неверно», снятие. */
const HostQuestionPanel = () => {
  const { game, send } = useQuizGame();
  const active = game.activeQuestion;
  if (!active) return null;

  const teamName = (teamId: string | null) =>
    game.teams.find((team) => team.id === teamId)?.name ?? "—";
  const soloTeam = active.soloTeamId;
  const answering =
    game.phase === "answer" ? active.buzzedTeamId : game.phase === "question" ? soloTeam : null;
  const canJudge = Boolean(answering);

  return (
    <Card padding="lg" tone="primary">
      <Stack gap="md">
        <Stack direction="row" gap="sm" align="center" wrap>
          <Heading level={2} size={22}>
            {game.phase === "transfer" ? "Кот в мешке" : active.themeName}
          </Heading>
          {game.phase !== "transfer" && (
            <Badge tone="neutral">{active.price} очков</Badge>
          )}
          <Badge tone={active.type === "simple" ? "primary" : "danger"}>
            {QUESTION_TYPE_LABEL[active.type]}
          </Badge>
          {soloTeam && <Badge tone="success">Играет «{teamName(soloTeam)}»</Badge>}
        </Stack>

        {game.phase === "transfer" ? (
          <Notice tone="warning">
            «{teamName(active.openerTeamId)}» обязана отдать вопрос сопернику. Выберите
            команду в списке ниже.
          </Notice>
        ) : (
          <Stack gap="sm">
            <Text as="p" size="xl" weight={600}>
              {active.text || "—"}
            </Text>
            <MediaPreview
              url={active.media?.url}
              type={active.media?.type}
              maxHeight="min(44vh, 400px)"
            />
            <HostAnswerReveal
              answer={active.answer}
              media={active.answerMedia}
              comment={active.comment}
              resetKey={active.questionId}
              revealed={active.answerRevealed}
            />
          </Stack>
        )}

        {game.phase === "question" && !soloTeam && (
          <Stack direction="row" gap="sm" wrap align="center">
            <Button
              variant={active.buzzOpen ? "neutral" : "primary"}
              onClick={() => send({ type: "SET_BUZZ", open: !active.buzzOpen })}
            >
              {active.buzzOpen ? "Закрыть кнопки" : "Открыть кнопки"}
            </Button>
            <Text size="sm" tone={active.buzzOpen ? "success" : "muted"}>
              {active.buzzOpen
                ? "Кнопки открыты — ждём нажатия."
                : "Дочитайте вопрос и откройте кнопки: нажатие раньше — фальстарт."}
            </Text>
          </Stack>
        )}

        {answering && (
          <Notice tone="info">Отвечает команда «{teamName(answering)}».</Notice>
        )}

        <Stack direction="row" gap="sm" wrap>
          {canJudge && (
            <>
              <Button onClick={() => send({ type: "JUDGE", correct: true })}>
                Верно (+{active.price})
              </Button>
              <Button
                variant="danger"
                onClick={() => send({ type: "JUDGE", correct: false })}
              >
                Неверно{game.settings.penalty && active.type !== "norisk"
                  ? ` (−${active.price})`
                  : ""}
              </Button>
            </>
          )}
          {(game.phase === "question" || game.phase === "answer") && (
            <Button variant="neutral" onClick={() => send({ type: "NO_ANSWER" })}>
              Никто не ответил
            </Button>
          )}
          {game.phase === "reveal" && (
            <Button onClick={() => send({ type: "CLOSE_QUESTION" })}>
              Дальше — к табло
            </Button>
          )}
        </Stack>
      </Stack>
    </Card>
  );
};

export default HostQuestionPanel;
