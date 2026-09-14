import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Badge,
  Button,
  Card,
  Heading,
  Input,
  LetterTile,
  LoadingSpinner,
  Stack,
  Text,
} from "../../components/atoms";
import { FullscreenButton, TeamCard, Wheel } from "../../components/molecules";
import { FORTUNE_SECTORS } from "../../constants/fortuneSectors";
import { useFieldRoom } from "../../hooks/useFieldRoom";
import { useTelegramBackButton } from "../../hooks/useTelegramBackButton";
import { useWheelSpin } from "../../hooks/useWheelSpin";
import { useAuthoritativeSpin } from "../../hooks/useAuthoritativeSpin";
import type {
  PublicFieldGameState,
  PublicPuzzle,
} from "../../types/fieldOfMiracles";
import { isPlayableLetter } from "../../utils/fieldOfMiracles";
import { equalBoundaries } from "../../utils/wheel";
import { color as token } from "../../styles/tokens";

const PHASE_LABEL: Record<PublicFieldGameState["phase"], string> = {
  setup: "Подготовка",
  ready: "Крутим барабан",
  spinning: "Барабан крутится",
  "awaiting-letter": "Называют букву",
  "awaiting-position": "Открывают позицию",
  "awaiting-special": "Особый сектор",
  "round-complete": "Раунд сыгран",
};

/** Загаданное слово во всю ширину экрана: зал читает его с задних рядов. */
const BoardWord = ({ puzzle }: { puzzle: PublicPuzzle }) => (
  <Stack gap="md" align="center">
    {puzzle.category && (
      <Badge tone="neutral">{puzzle.category}</Badge>
    )}
    {puzzle.clue && (
      <Text
        as="p"
        align="center"
        weight={600}
        className="text-[clamp(18px,2.6vw,34px)] leading-snug"
      >
        {puzzle.clue}
      </Text>
    )}
    <div
      className="flex flex-wrap justify-center gap-[clamp(4px,0.6vw,10px)]"
      role="group"
      aria-label="Загаданное слово"
    >
      {puzzle.maskedAnswer.map((character, index) => {
        if (character === " ") {
          return <span key={`space-${index}`} aria-hidden className="w-lg" />;
        }
        // Знаки препинания открыты изначально — прятать в них нечего.
        if (character !== null && !isPlayableLetter(character)) {
          return (
            <span
              key={`punct-${index}`}
              className="flex items-center justify-center text-[clamp(28px,4vw,64px)] font-bold"
              style={{ width: "clamp(34px, 4.6vw, 76px)" }}
            >
              {character}
            </span>
          );
        }
        return (
          <LetterTile
            key={`slot-${index}`}
            letter={character ?? ""}
            revealed={character !== null}
            disabled
            size={0}
            className="!size-[clamp(34px,4.6vw,76px)] !text-[clamp(20px,3vw,48px)]"
            aria-label={
              character === null
                ? `Закрытая позиция ${index + 1}`
                : `Открытая буква ${character}`
            }
          />
        );
      })}
    </div>
  </Stack>
);

const BoardScore = ({ game }: { game: PublicFieldGameState }) => (
  <Stack direction="row" gap="md" justify="center" wrap className="items-stretch">
    {game.teams.map((team) => {
      const active = team.id === game.activeTeamId;
      const winner = team.id === game.winnerTeamId;
      return (
        <TeamCard
          key={team.id}
          name={team.name}
          color={team.color}
          score={team.points}
          size="lg"
          highlighted={active}
          badges={
            <>
              {active && <Badge tone="success">ход</Badge>}
              {winner && <Badge tone="primary">победа</Badge>}
            </>
          }
          note={team.roundPoints > 0 ? `+${team.roundPoints} в раунде` : undefined}
        />
      );
    })}
  </Stack>
);

/** Экран для зала: слово, барабан и счёт. Ответа в этом состоянии нет. */
const FieldOfMiraclesBoardPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const room = searchParams.get("room")?.trim().toUpperCase() ?? "";
  const [roomDraft, setRoomDraft] = useState(room);
  const { game, status, error } = useFieldRoom(room);
  // Внутри Telegram «назад» возвращает к вводу кода, а не закрывает приложение.
  const leaveRoom = useCallback(() => setSearchParams({}), [setSearchParams]);
  useTelegramBackButton(room ? leaveRoom : null);

  const boundaries = useMemo(
    () => equalBoundaries(FORTUNE_SECTORS.length),
    [],
  );
  const wheel = useWheelSpin({
    boundaries,
    durationMs: game?.spin?.durationMs,
  });
  useAuthoritativeSpin(game?.spin ?? null, wheel);

  if (!room) {
    return (
      <main className="flex min-h-dvh w-full items-center justify-center p-lg">
        {/* The lg submit button holds the bottom corners. */}
        <Card padding="lg" content="lg">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const next = roomDraft.trim().toUpperCase();
              if (next) setSearchParams({ room: next });
            }}
          >
            <Stack gap="md">
              <Heading level={1} size={26} align="center">
                Табло «Поля чудес»
              </Heading>
              <Input
                autoFocus
                value={roomDraft}
                placeholder="Код комнаты"
                autoCapitalize="characters"
                onChange={(event) => setRoomDraft(event.target.value.toUpperCase())}
              />
              <Button type="submit" size="lg" disabled={!roomDraft.trim()}>
                Показать
              </Button>
            </Stack>
          </form>
        </Card>
      </main>
    );
  }

  if (!game) {
    return (
      <main className="flex min-h-dvh w-full items-center justify-center p-lg">
        <Stack direction="row" gap="xs" align="center">
          {status === "connecting" && <LoadingSpinner size="sm" />}
          <Text role="status">{error ?? "Подключаемся к комнате…"}</Text>
        </Stack>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh w-full flex-col gap-lg p-lg">
      <Stack direction="row" gap="sm" align="center" justify="center" wrap>
        <Heading level={1} size={24}>
          Поле чудес
        </Heading>
        <Badge tone={status === "connected" ? "success" : "neutral"}>
          Комната {room}
        </Badge>
        {game.round > 0 && <Badge tone="neutral">Раунд {game.round}</Badge>}
        <Badge tone="primary">{PHASE_LABEL[game.phase]}</Badge>
        <FullscreenButton />
      </Stack>

      <div className="grid min-h-0 flex-1 items-center gap-xl lg:grid-cols-[minmax(0,1fr)_minmax(280px,38%)]">
        <Stack gap="lg" align="center" className="min-w-0">
          {game.puzzle ? (
            <BoardWord puzzle={game.puzzle} />
          ) : (
            <Text
              as="p"
              align="center"
              tone="muted"
              className="text-[clamp(18px,2.4vw,32px)]"
            >
              Ведущий готовит раунд.
            </Text>
          )}
          <Text
            as="p"
            align="center"
            aria-live="polite"
            className="text-[clamp(14px,1.6vw,24px)]"
          >
            {game.statusMessage}
          </Text>
        </Stack>

        <Wheel
          sectors={FORTUNE_SECTORS}
          rotation={wheel.rotation}
          size="min(80vw, 42vh, 420px)"
          spinDurationMs={wheel.effectiveDurationMs}
          easing={wheel.easing}
          spinRef={wheel.spinRef}
          winnerIndex={wheel.winnerIndex}
          hub
          rim
          hubColor={token.primaryStrong}
          ariaLabel="Барабан «Поля чудес»"
        />
      </div>

      <BoardScore game={game} />
    </main>
  );
};

export default FieldOfMiraclesBoardPage;
