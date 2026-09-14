import { useEffect, useState } from "react";
import { msUntil } from "../../../../api/serverClock";
import { Button, Card, Notice, Stack, Text } from "../../../atoms";
import { BuzzButton } from "../../../molecules";
import CaptainBidControls from "../CaptainBidControls/CaptainBidControls";
import CaptainFinalControls from "../CaptainFinalControls/CaptainFinalControls";
import type { ParticipantCommand, PublicGameState } from "../../../../types/quiz";

interface CaptainPanelProps {
  game: PublicGameState;
  teamId: string;
  pending: boolean;
  onCommand: (command: ParticipantCommand) => void;
}

/**
 * Секунды до конца блокировки кнопки после фальстарта. Дедлайн приходит в
 * часах сервера, поэтому считаем через `msUntil`: часы телефона врут.
 */
const useLockCountdown = (lockedUntil: number) => {
  const [left, setLeft] = useState(() => msUntil(lockedUntil));

  useEffect(() => {
    setLeft(msUntil(lockedUntil));
    if (msUntil(lockedUntil) <= 0) return;
    const timer = window.setInterval(() => setLeft(msUntil(lockedUntil)), 200);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  return left;
};

/** Всё, что капитан делает со своего телефона, кроме выбора клетки на табло. */
const CaptainPanel = ({ game, teamId, pending, onCommand }: CaptainPanelProps) => {
  const active = game.activeQuestion;
  const lockedUntil = active?.falseStartUntil[teamId] ?? 0;
  const lockLeft = useLockCountdown(lockedUntil);

  if (game.phase === "bidding") {
    return (
      <CaptainBidControls
        game={game}
        teamId={teamId}
        pending={pending}
        onCommand={onCommand}
      />
    );
  }

  if (game.phase.startsWith("final")) {
    return (
      <CaptainFinalControls
        game={game}
        teamId={teamId}
        pending={pending}
        onCommand={onCommand}
      />
    );
  }

  if (game.phase === "transfer" && active) {
    const mine = active.openerTeamId === teamId;
    return (
      <Card padding="md" tone="primary">
        <Stack gap="sm">
          <Text weight={600}>
            {mine ? "Кот в мешке: отдайте вопрос сопернику" : "Соперник передаёт «Кота»"}
          </Text>
          {mine && (
            <Stack direction="row" gap="xs" wrap>
              {game.teams
                .filter((team) => team.id !== teamId)
                .map((team) => (
                  <Button
                    key={team.id}
                    disabled={pending}
                    onClick={() => onCommand({ type: "ASSIGN_SECRET", teamId: team.id })}
                  >
                    {team.name}
                  </Button>
                ))}
            </Stack>
          )}
        </Stack>
      </Card>
    );
  }

  if (game.phase === "question" || game.phase === "answer") {
    const solo = active?.soloTeamId ?? null;
    if (solo) {
      return (
        <Notice tone={solo === teamId ? "info" : "warning"}>
          {solo === teamId
            ? `Вопрос ваш — отвечайте вслух. Цена ${active?.price ?? 0}.`
            : "Вопрос играет другая команда — кнопка не работает."}
        </Notice>
      );
    }

    const buzzed = active?.buzzedTeamId ?? null;
    if (buzzed) {
      // Кто именно отвечает, страница печатает статусом ниже, и он приходит с
      // сервера тем же текстом. Здесь остаётся только то, что касается этого
      // капитана лично, иначе одна и та же фраза стоит на экране дважды.
      return buzzed === teamId ? (
        <Notice tone="success">Вы нажали первым — отвечайте!</Notice>
      ) : null;
    }

    const locked = active?.lockedTeamIds.includes(teamId) ?? false;
    const blocked = lockLeft > 0;

    return (
      <Stack gap="sm" align="center">
        <BuzzButton
          label={
            locked
              ? "Попытка использована"
              : blocked
                ? `Фальстарт · ${(lockLeft / 1000).toFixed(1)} с`
                : active?.buzzOpen
                  ? "Отвечать!"
                  : "Ждите сигнала"
          }
          enabled={!locked && !blocked && !pending}
          onClick={() => onCommand({ type: "BUZZ" })}
        />
        <Text size="sm" tone="muted" align="center">
          {active?.buzzOpen
            ? "Кнопки открыты."
            : "Нажатие до сигнала ведущего — фальстарт и блокировка на пару секунд."}
        </Text>
      </Stack>
    );
  }

  if (game.phase === "board") {
    return (
      <Notice tone={game.pickerTeamId === teamId ? "info" : "warning"}>
        {game.pickerTeamId === teamId
          ? "Ваш ход: выберите тему и стоимость на табло ниже."
          : "Клетку выбирает другая команда."}
      </Notice>
    );
  }

  // На остальных фазах капитану делать нечего, а статус игры страница и так
  // печатает ниже: вторая копия того же текста только сбивала с толку.
  return null;
};

export type { CaptainPanelProps };
export default CaptainPanel;
