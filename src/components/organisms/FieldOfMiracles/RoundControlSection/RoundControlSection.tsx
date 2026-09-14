import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Badge, Button, Card, Input, Notice, Stack, Text } from "../../../atoms";
import { useGameContext } from "../../../../hooks/useGameContext";
import {
  isPlayableLetter,
  normalizePuzzleText,
} from "../../../../utils/fieldOfMiracles";
import { STREAK_BONUS } from "../../../../reducers/fieldOfMiraclesReducer";

const fieldLabelClass = "flex min-w-0 flex-1 flex-col gap-2xs text-left text-sm font-medium";

/** Round setup, status and host-only actions for the Field of Miracles game. */
const RoundControlSection = () => {
  const {
    game,
    teams,
    activeTeam,
    currentSector,
    startRound,
    attemptSolve,
    resolveSpecial,
    passTurn,
    undo,
    newGame,
  } = useGameContext();
  const [category, setCategory] = useState("");
  const [clue, setClue] = useState("");
  const [answer, setAnswer] = useState("");
  const [solveAnswer, setSolveAnswer] = useState("");
  const [showSolve, setShowSolve] = useState(false);

  useEffect(() => {
    setShowSolve(false);
    setSolveAnswer("");
  }, [game.activeTeamId, game.round]);

  const normalizedAnswer = normalizePuzzleText(answer);
  const hasPlayableAnswer = Array.from(normalizedAnswer).some(isPlayableLetter);
  const canStartRound = teams.length > 0 && hasPlayableAnswer;

  const handleStart = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canStartRound) {
      return;
    }
    startRound({ category, clue, answer });
    setCategory("");
    setClue("");
    setAnswer("");
  };

  const handleSolve = (event: React.FormEvent) => {
    event.preventDefault();
    if (!solveAnswer.trim()) {
      return;
    }
    attemptSolve(solveAnswer);
    setSolveAnswer("");
    setShowSolve(false);
  };

  const resetGame = () => {
    if (window.confirm("Начать новую игру и обнулить очки всех команд?")) {
      newGame();
    }
  };

  const canConfigureRound =
    game.phase === "setup" || game.phase === "round-complete";

  return (
    <Card
      padding="lg"
      tone={game.phase === "round-complete" ? "primary" : "default"}
    >
      <Stack gap="md">
        {game.puzzle && (
          <Stack direction="row" gap="xs" wrap align="center" justify="center">
            <Badge>Раунд {game.round}</Badge>
            {game.puzzle.category && <Badge tone="neutral">{game.puzzle.category}</Badge>}
            {activeTeam && game.phase !== "round-complete" && (
              <Badge tone="success">Ход: {activeTeam.name}</Badge>
            )}
          </Stack>
        )}

        {game.puzzle?.clue && (
          <Text as="p" size="xl" weight={600} align="center">
            {game.puzzle.clue}
          </Text>
        )}

        <Notice tone={game.statusTone} aria-live="polite">
          {game.statusMessage}
        </Notice>

        {game.phase === "awaiting-special" && currentSector && (
          <Stack direction="row" gap="sm" wrap justify="center">
            <Button variant="success" onClick={() => resolveSpecial(true)}>
              {currentSector.type === "task"
                ? `Выполнено (+${currentSector.value ?? 500})`
                : `Приз получен (+${currentSector.value ?? 500})`}
            </Button>
            <Button variant="ghost" onClick={() => resolveSpecial(false)}>
              {currentSector.type === "task" ? "Не выполнено" : "Отказаться"}
            </Button>
          </Stack>
        )}

        {!canConfigureRound && (
          <Stack direction="row" gap="sm" wrap justify="center">
            <Button
              variant="success"
              disabled={game.phase !== "ready"}
              onClick={() => setShowSolve((visible) => !visible)}
            >
              Назвать слово
            </Button>
            <Button
              variant="ghost"
              disabled={
                game.phase === "spinning" || game.phase === "round-complete"
              }
              onClick={passTurn}
            >
              Передать ход
            </Button>
            <Button
              variant="ghost"
              disabled={!game.undoAvailable || game.phase === "spinning"}
              onClick={undo}
            >
              Отменить действие
            </Button>
            <Button variant="danger" onClick={resetGame}>
              Новая игра
            </Button>
          </Stack>
        )}

        {showSolve && game.phase === "ready" && (
          <form onSubmit={handleSolve}>
            <Stack direction="row" gap="sm">
              <Input
                autoFocus
                value={solveAnswer}
                placeholder={`Ответ команды «${activeTeam?.name ?? "—"}»`}
                onChange={(event) => setSolveAnswer(event.target.value)}
              />
              <Button type="submit" disabled={!solveAnswer.trim()}>
                Проверить
              </Button>
            </Stack>
          </form>
        )}

        {canConfigureRound && (
          <form onSubmit={handleStart}>
            <Stack gap="sm">
              <Stack direction="row" gap="sm" wrap>
                <label className={fieldLabelClass}>
                  Тема
                  <Input
                    value={category}
                    placeholder="Например: Космос"
                    onChange={(event) => setCategory(event.target.value)}
                  />
                </label>
                <label className={fieldLabelClass}>
                  Секретное слово
                  <Input
                    type="text"
                    lang="ru"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={answer}
                    placeholder="Не показывается игрокам"
                    onChange={(event) => setAnswer(event.target.value)}
                    style={{ WebkitTextSecurity: "disc" } as CSSProperties}
                  />
                </label>
              </Stack>
              <label className={fieldLabelClass}>
                Вопрос или подсказка
                <Input
                  value={clue}
                  placeholder="Что должны отгадать команды?"
                  onChange={(event) => setClue(event.target.value)}
                />
              </label>
              <Stack direction="row" gap="sm" wrap justify="center">
                <Button
                  type="submit"
                  size="lg"
                  disabled={!canStartRound}
                >
                  {game.round === 0 ? "Начать игру" : "Начать следующий раунд"}
                </Button>
                {game.round > 0 && (
                  <Button type="button" variant="danger" onClick={resetGame}>
                    Новая игра
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!game.undoAvailable}
                  onClick={undo}
                >
                  Отменить действие
                </Button>
              </Stack>
              {teams.length === 0 && (
                <Text as="p" tone="muted" size="sm" align="center">
                  Сначала добавьте хотя бы одну команду ниже.
                </Text>
              )}
              {answer.trim() && !hasPlayableAnswer && (
                <Text as="p" tone="danger" size="sm" align="center">
                  В ответе должна быть хотя бы одна русская буква.
                </Text>
              )}
            </Stack>
          </form>
        )}

        <details className="ui-surface border border-border px-md py-xs text-left text-sm">
          <summary className="cursor-pointer font-semibold">Короткие правила</summary>
          <ul className="mb-0 flex flex-col gap-2xs pl-lg text-neutral">
            <li>Верная буква открывается везде, очки умножаются на число вхождений, ход сохраняется.</li>
            <li>Неверная или уже названная буква и неверное слово передают ход следующей команде.</li>
            <li>«Банкрот» сжигает очки текущего раунда; сектор 0 только передаёт ход.</li>
            <li>«Плюс» открывает выбранную позицию, ×2 умножает текущие очки раунда.</li>
            <li>Три правильные буквы подряд дают бонус {STREAK_BONUS} очков.</li>
          </ul>
        </details>
      </Stack>
    </Card>
  );
};

export default RoundControlSection;
