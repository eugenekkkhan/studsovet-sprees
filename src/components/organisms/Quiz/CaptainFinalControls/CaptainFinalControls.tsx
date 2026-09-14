import { useState } from "react";
import { Badge, Button, Card, Input, Stack, Text, TextArea } from "../../../atoms";
import { AnswerBox, answerBoxRadius, MediaPreview } from "../../../molecules";
import type { ParticipantCommand, PublicGameState } from "../../../../types/quiz";

interface CaptainFinalControlsProps {
  game: PublicGameState;
  teamId: string;
  pending: boolean;
  onCommand: (command: ParticipantCommand) => void;
}

/** Финал на телефоне капитана: вычёркивание тем, ставка и письменный ответ. */
const CaptainFinalControls = ({
  game,
  teamId,
  pending,
  onCommand,
}: CaptainFinalControlsProps) => {
  const final = game.final;
  const team = game.teams.find((item) => item.id === teamId);
  const [bet, setBet] = useState("");
  const [answer, setAnswer] = useState("");

  if (!final || !team) return null;
  if (!final.participantIds.includes(teamId)) {
    return (
      <Card padding="md" tone="muted">
        <Text align="center">
          В финал проходят только команды с положительным счётом. Ваша игра окончена.
        </Text>
      </Card>
    );
  }

  // На вскрытии углы карточки держит коробка ответа, в остальных фазах —
  // кнопки и поля. Радиус строится по тому, что в углу сейчас.
  const revealing =
    game.phase === "final-reveal" || game.phase === "game-over";
  const betPlaced = final.betPlacedTeamIds.includes(teamId);
  const answerPlaced = final.answerPlacedTeamIds.includes(teamId);
  const parsedBet = Number(bet);

  return (
    <Card
      padding="md"
      tone="primary"
      content={revealing ? answerBoxRadius("md") : "md"}
    >
      <Stack gap="sm">
        {game.phase === "final-themes" && (
          <Stack gap="sm">
            <Text weight={600}>
              {final.turnTeamId === teamId
                ? "Уберите одну тему"
                : "Тему убирает другая команда"}
            </Text>
            <Stack direction="row" gap="xs" wrap>
              {final.themes.map((theme) => {
                const removed = final.removedThemeIds.includes(theme.id);
                return (
                  <Button
                    key={theme.id}
                    size="sm"
                    variant={removed ? "neutral" : "primary"}
                    disabled={removed || pending || final.turnTeamId !== teamId}
                    onClick={() =>
                      onCommand({ type: "FINAL_REMOVE_THEME", themeId: theme.id })
                    }
                  >
                    {removed ? `✕ ${theme.name}` : theme.name}
                  </Button>
                );
              })}
            </Stack>
          </Stack>
        )}

        {game.phase === "final-bets" && (
          <Stack gap="sm">
            <Text weight={600}>Тема: {final.playingThemeName ?? "—"}</Text>
            {betPlaced ? (
              <Badge tone="success">Ставка принята</Badge>
            ) : (
              <>
                <Text size="sm" tone="muted">
                  От 1 до {team.score} — соперники ставку не видят.
                </Text>
                <Stack direction="row" gap="xs" wrap>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={bet}
                    placeholder="Ставка"
                    aria-label="Ставка в финале"
                    className="min-w-[140px] flex-1"
                    onChange={(event) => setBet(event.target.value)}
                  />
                  <Button
                    disabled={
                      pending || !(parsedBet >= 1 && parsedBet <= team.score)
                    }
                    onClick={() => onCommand({ type: "FINAL_BET", amount: parsedBet })}
                  >
                    Поставить
                  </Button>
                </Stack>
              </>
            )}
          </Stack>
        )}

        {game.phase === "final-answers" && (
          <Stack gap="sm">
            <Text as="p" weight={600}>
              {final.question ?? "Ведущий читает вопрос…"}
            </Text>
            <MediaPreview
              url={final.media?.url}
              type={final.media?.type}
              maxHeight="min(48dvh, 480px)"
              zoomable
            />
            {answerPlaced ? (
              <Badge tone="success">Ответ записан</Badge>
            ) : (
              <>
                <TextArea
                  rows={2}
                  value={answer}
                  placeholder="Ваш ответ"
                  onChange={(event) => setAnswer(event.target.value)}
                />
                <Button
                  disabled={pending || !answer.trim()}
                  onClick={() => onCommand({ type: "FINAL_ANSWER", text: answer.trim() })}
                >
                  Сдать ответ
                </Button>
              </>
            )}
          </Stack>
        )}

        {(game.phase === "final-reveal" || game.phase === "game-over") && (
          <Stack gap="sm">
            <Text weight={600}>Вскрытие конвертов</Text>
            <AnswerBox
              answer={final.answer ?? "—"}
              mediaUrl={final.answerMedia?.url}
              mediaType={final.answerMedia?.type}
              size="md"
            />
          </Stack>
        )}
      </Stack>
    </Card>
  );
};

export type { CaptainFinalControlsProps };
export default CaptainFinalControls;
