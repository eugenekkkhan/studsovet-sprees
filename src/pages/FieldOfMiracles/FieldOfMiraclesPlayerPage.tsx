import { useCallback, useEffect, useMemo, useState } from "react";
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
import { TeamCard, Wheel } from "../../components/molecules";
import { createFieldOfMiraclesSocket } from "../../api/fieldOfMiraclesSocket";
import { noteServerTime } from "../../api/serverClock";
import { haptic } from "../../api/telegram";
import {
  FORTUNE_SECTORS,
  isPunishingSector,
} from "../../constants/fortuneSectors";
import { useAuthoritativeSpin } from "../../hooks/useAuthoritativeSpin";
import { useWheelSpin } from "../../hooks/useWheelSpin";
import type {
  PublicFieldGameState,
  PublicPuzzle,
  Team,
} from "../../types/fieldOfMiracles";
import {
  isPlayableLetter,
  RUSSIAN_LETTERS,
} from "../../utils/fieldOfMiracles";
import { equalBoundaries } from "../../utils/wheel";
import { showToast } from "../../utils/toast";
import { cardRadius, color as token } from "../../styles/tokens";

// The team fold is padded md around TeamScore cards, which are md all through.
const PLAYER_TEAM_GROUP_RADIUS = cardRadius("md", cardRadius("md", "md"));

interface Ack {
  ok: boolean;
  error?: string;
  code?: string;
  teamId?: string;
  state?: PublicFieldGameState;
}

const emitAck = (
  socket: ReturnType<typeof createFieldOfMiraclesSocket>,
  event: string,
  payload: unknown,
) =>
  new Promise<Ack>((resolve) => {
    socket.timeout(7000).emit(
      event,
      payload,
      (error: Error | null, response?: Ack) =>
        resolve(
          error || !response
            ? { ok: false, error: "Сервер не ответил." }
            : response,
        ),
    );
  });

const teamKeyStorageKey = (code: string) =>
  `fieldOfMiraclesParticipantKey:${code}`;
const PARTICIPANT_ID_KEY = "fieldOfMiraclesParticipantIdV1";

const getParticipantId = () => {
  const stored = localStorage.getItem(PARTICIPANT_ID_KEY);
  if (stored) return stored;
  const generated =
    globalThis.crypto?.randomUUID?.() ??
    `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(PARTICIPANT_ID_KEY, generated);
  return generated;
};

const TeamScore = ({
  team,
  active,
  own = false,
}: {
  team: Team;
  active: boolean;
  own?: boolean;
}) => (
  <TeamCard
    name={team.name}
    color={team.color}
    score={team.points}
    size="md"
    own={own}
    highlighted={active}
    badges={active ? <Badge tone="success">{own ? "Ваш ход" : "Ходит"}</Badge> : null}
    note={team.roundPoints > 0 ? `+${team.roundPoints} в раунде` : undefined}
  />
);

const PlayerPuzzlePreview = ({
  puzzle,
  canChoose,
  pending,
  onChoose,
}: {
  puzzle: PublicPuzzle;
  canChoose: boolean;
  pending: boolean;
  onChoose: (index: number) => void;
}) => (
  <Card padding="md">
    <Stack gap="sm">
      <div className="grid grid-cols-[1rem_minmax(0,1fr)_1rem] items-center gap-xs">
        <span className="inline-flex size-4 items-center justify-center">
          {canChoose && pending && <LoadingSpinner size="sm" />}
        </span>
        <Heading level={2} size={18} align="center">
          {canChoose ? "Выберите закрытую позицию" : "Текущее слово"}
        </Heading>
        <span aria-hidden className="size-4" />
      </div>

      <div
        className="flex flex-wrap justify-center gap-2xs"
        role="group"
        aria-label="Текущее слово"
      >
        {puzzle.maskedAnswer.map((character, index) => {
          if (character === " ") {
            return <span key={`space-${index}`} aria-hidden className="w-sm" />;
          }
          if (character !== null && !isPlayableLetter(character)) {
            return (
              <span
                key={`${character}-${index}`}
                className="flex size-8 items-center justify-center text-lg font-bold"
              >
                {character}
              </span>
            );
          }
          const revealed = character !== null;
          return (
            <LetterTile
              key={index}
              letter={character ?? ""}
              revealed={revealed}
              size={32}
              shape="preview"
              disabled={!canChoose || pending || revealed}
              className={revealed ? "bg-surface" : undefined}
              aria-label={
                revealed
                  ? `Открытая буква ${character}`
                  : canChoose
                    ? `Открыть позицию ${index + 1}`
                    : `Закрытая позиция ${index + 1}`
              }
              onClick={() => onChoose(index)}
            />
          );
        })}
      </div>
    </Stack>
  </Card>
);

const PlayerWheel = ({
  game,
  canAct,
  onSpin,
}: {
  game: PublicFieldGameState;
  canAct: boolean;
  onSpin: () => void;
}) => {
  const boundaries = useMemo(
    () => equalBoundaries(FORTUNE_SECTORS.length),
    [],
  );
  const {
    rotation,
    spinning,
    winnerIndex,
    effectiveDurationMs,
    easing,
    spinRef,
    spinToAngle,
    snapToAngle,
    reset,
  } = useWheelSpin({
    boundaries,
    durationMs: game.spin?.durationMs,
    onSettle: (index) => {
      const sector = FORTUNE_SECTORS[index];
      if (isPunishingSector(sector)) haptic.failure();
      showToast.message(`Выпало: ${sector.label}`);
    },
  });

  useAuthoritativeSpin(game.spin, { spinToAngle, snapToAngle, reset });

  const winner = winnerIndex === null ? null : FORTUNE_SECTORS[winnerIndex];
  const activeTeam = game.teams.find((team) => team.id === game.activeTeamId);

  return (
    <Stack gap="sm" align="center">
      <Button
        block
        size="lg"
        hapticFeedback="press"
        loading={game.phase === "spinning" || spinning}
        disabled={!canAct || game.phase !== "ready" || spinning}
        onClick={() => {
          onSpin();
        }}
      >
        {game.phase === "spinning" || spinning
          ? "Барабан крутится…"
          : canAct && game.phase === "ready"
            ? "Крутить барабан"
            : game.phase === "ready"
              ? `Ход команды «${activeTeam?.name ?? "—"}»`
              : "Ожидайте результата"}
      </Button>
      <Text as="p" weight={700} align="center" aria-live="polite">
        {winner ? `Выпало: ${winner.label}` : " "}
      </Text>
      <Wheel
        sectors={FORTUNE_SECTORS}
        rotation={rotation}
        size="min(94vw, 470px)"
        spinDurationMs={effectiveDurationMs}
        easing={easing}
        spinRef={spinRef}
        winnerIndex={winnerIndex}
        hub
        rim
        hubColor={token.primaryStrong}
        ariaLabel="Барабан «Поля чудес»"
      />
      {game.spin && (
        <details className="w-full text-xs text-muted-foreground">
          <summary className="cursor-pointer">Проверить seed вращения</summary>
          <code className="mt-2xs block break-all text-left">
            {game.spin.seed}
          </code>
        </details>
      )}
    </Stack>
  );
};

const PlayerActions = ({
  game,
  canAct,
  pending,
  guessLetter,
}: {
  game: PublicFieldGameState;
  canAct: boolean;
  pending: boolean;
  guessLetter: (letter: string) => void;
}) => {
  if (!canAct || !game.puzzle) return null;
  const puzzle = game.puzzle;

  if (game.phase === "awaiting-letter") {
    const guessed = new Set(puzzle.guessedLetters);
    return (
      <Card padding="md" tone="primary">
        <Stack gap="sm">
          <div className="grid grid-cols-[1rem_minmax(0,1fr)_1rem] items-center gap-xs">
            <span className="inline-flex size-4 items-center justify-center">
              {pending && <LoadingSpinner size="sm" />}
            </span>
            <Heading level={2} size={18} align="center">
              Выберите букву
            </Heading>
            <span aria-hidden className="size-4" />
          </div>
          <div className="flex flex-wrap justify-center gap-2xs">
            {Array.from(RUSSIAN_LETTERS).map((letter) => {
              const used = guessed.has(letter);
              const present = puzzle.maskedAnswer.includes(letter);
              return (
                <LetterTile
                  key={letter}
                  letter={letter}
                  revealed
                  size={36}
                  shape="choice"
                  disabled={pending || used}
                  aria-label={
                    used
                      ? `Буква ${letter} уже называлась`
                      : `Назвать букву ${letter}`
                  }
                  className={
                    used
                      ? present
                        ? "border-success bg-success-soft text-success-strong"
                        : "border-border bg-surface-muted text-muted-foreground"
                      : "bg-surface hover:bg-primary-soft"
                  }
                  onClick={() => guessLetter(letter)}
                />
              );
            })}
          </div>
        </Stack>
      </Card>
    );
  }

  return null;
};

const FieldOfMiraclesPlayerPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRoom = searchParams.get("room")?.trim().toUpperCase() ?? "";
  const initialTeamKey = searchParams.get("key")?.trim().toUpperCase() ?? "";
  const [socket] = useState(createFieldOfMiraclesSocket);
  const [room, setRoom] = useState(initialRoom);
  const [roomDraft, setRoomDraft] = useState(initialRoom);
  const [teamKeyDraft, setTeamKeyDraft] = useState(
    initialTeamKey ||
      (initialRoom ? localStorage.getItem(teamKeyStorageKey(initialRoom)) : "") ||
      "",
  );
  const [teamId, setTeamId] = useState<string | null>(null);
  const [game, setGame] = useState<PublicFieldGameState | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">(
    "connecting",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;

    const acceptState = (next: PublicFieldGameState) => {
      if (!active) return;
      noteServerTime(next.serverNow);
      setGame((current) =>
        !current || next.revision >= current.revision ? next : current,
      );
      setTeamId((currentTeamId) => {
        if (
          currentTeamId &&
          !next.teams.some((team) => team.id === currentTeamId)
        ) {
          localStorage.removeItem(teamKeyStorageKey(room));
          return null;
        }
        return currentTeamId;
      });
    };

    const enterRoom = async () => {
      if (!room) {
        setStatus("connected");
        return;
      }
      setStatus("connecting");
      const urlKey =
        new URLSearchParams(window.location.search)
          .get("key")
          ?.trim()
          .toUpperCase() ?? "";
      const rememberedKey =
        urlKey || localStorage.getItem(teamKeyStorageKey(room));
      const response = await emitAck(
        socket,
        rememberedKey ? "participant:join" : "session:watch",
        rememberedKey
          ? {
              code: room,
              teamKey: rememberedKey,
              participantId: getParticipantId(),
            }
          : { code: room },
      );
      if (!active) return;
      if (!response.ok || !response.state) {
        if (rememberedKey) {
          setTeamId(null);
          const fallback = await emitAck(socket, "session:watch", { code: room });
          if (!active) return;
          if (fallback.ok && fallback.state) {
            acceptState(fallback.state);
            setStatus("connected");
            setError(response.error ?? "Не удалось занять команду.");
            return;
          }
        }
        setStatus("disconnected");
        setError(response.error ?? "Не удалось войти в комнату.");
        return;
      }
      if (rememberedKey) {
        localStorage.setItem(teamKeyStorageKey(room), rememberedKey);
        setTeamKeyDraft(rememberedKey);
      }
      setTeamId(response.teamId ?? null);
      acceptState(response.state);
      setStatus("connected");
      setError(null);
    };

    socket.on("connect", enterRoom);
    socket.on("state:update", acceptState);
    socket.on("disconnect", () => active && setStatus("disconnected"));
    socket.on("connect_error", () => {
      if (active) {
        setStatus("disconnected");
        setError("Нет соединения с игровым сервером.");
      }
    });
    socket.connect();

    return () => {
      active = false;
      socket.off("connect", enterRoom);
      socket.off("state:update", acceptState);
      socket.off("disconnect");
      socket.off("connect_error");
      socket.disconnect();
    };
  }, [room, socket]);

  const request = useCallback(
    async (event: string, payload: unknown) => {
      setPending(true);
      const response = await emitAck(socket, event, payload);
      setPending(false);
      if (!response.ok) {
        const message = response.error ?? "Сервер отклонил действие.";
        setError(message);
        showToast.error(message);
      }
      return response;
    },
    [socket],
  );

  const submitRoom = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = roomDraft.trim().toUpperCase();
    if (!normalized) return;
    const normalizedKey = teamKeyDraft.trim().toUpperCase();
    if (normalizedKey) {
      localStorage.setItem(teamKeyStorageKey(normalized), normalizedKey);
    }
    setSearchParams(
      normalizedKey
        ? { room: normalized, key: normalizedKey }
        : { room: normalized },
      { replace: true },
    );
    setRoom(normalized);
    setTeamId(null);
    setGame(null);
    setError(null);
  };

  const joinTeam = async () => {
    const normalizedKey = teamKeyDraft.trim().toUpperCase();
    if (!normalizedKey) return;
    const response = await request("participant:join", {
      code: room,
      teamKey: normalizedKey,
      participantId: getParticipantId(),
    });
    if (response.ok && response.teamId) {
      localStorage.setItem(teamKeyStorageKey(room), normalizedKey);
      setSearchParams({ room, key: normalizedKey }, { replace: true });
      setTeamId(response.teamId);
      if (response.state) setGame(response.state);
    }
  };

  const leaveTeam = async () => {
    const response = await request("session:watch", { code: room });
    if (!response.ok) return;
    localStorage.removeItem(teamKeyStorageKey(room));
    setSearchParams({ room }, { replace: true });
    setTeamKeyDraft("");
    setTeamId(null);
    if (response.state) setGame(response.state);
  };

  if (!room || (!game && status !== "connecting")) {
    return (
      <main className="field-player-page mx-auto w-full max-w-[480px]">
        {/* The lg submit button holds the bottom corners. */}
        <Card padding="lg" content="lg">
          <form onSubmit={submitRoom}>
            <Stack gap="md">
              <Heading level={1} size={28} align="center">
                Подключиться к игре
              </Heading>
              <Input
                autoFocus
                value={roomDraft}
                placeholder="Код комнаты"
                autoCapitalize="characters"
                onChange={(event) => setRoomDraft(event.target.value.toUpperCase())}
              />
              <Input
                value={teamKeyDraft}
                placeholder="Ключ команды"
                autoCapitalize="characters"
                autoComplete="off"
                onChange={(event) =>
                  setTeamKeyDraft(event.target.value.toUpperCase())
                }
              />
              {error && <Text tone="danger">{error}</Text>}
              <Button type="submit" size="lg" disabled={!roomDraft.trim()}>
                Войти
              </Button>
            </Stack>
          </form>
        </Card>
      </main>
    );
  }

  if (!game) {
    return (
      <main className="field-player-page mx-auto w-full max-w-[480px]">
        <Stack direction="row" gap="xs" align="center" justify="center">
          <LoadingSpinner size="sm" />
          <Text align="center" role="status">
            Подключаемся к игре…
          </Text>
        </Stack>
      </main>
    );
  }

  if (!teamId) {
    return (
      <main className="field-player-page mx-auto w-full max-w-[520px]">
        <Stack gap="md">
          <Stack gap="2xs" align="center">
            <Badge tone="neutral">Комната {room}</Badge>
            <Heading level={1} size={26} align="center">
              Выберите свою команду
            </Heading>
          </Stack>
          {game.teams.length > 0 ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void joinTeam();
              }}
            >
              <Stack gap="sm">
                <Input
                  autoFocus
                  value={teamKeyDraft}
                  placeholder="Ключ вашей команды"
                  autoCapitalize="characters"
                  autoComplete="off"
                  onChange={(event) =>
                    setTeamKeyDraft(event.target.value.toUpperCase())
                  }
                />
                {error && <Text tone="danger">{error}</Text>}
                <Button
                  type="submit"
                  size="lg"
                  loading={pending}
                  disabled={pending || !teamKeyDraft.trim()}
                >
                  Занять место команды
                </Button>
                <Text as="p" size="sm" tone="muted" align="center">
                  Ключ выдаёт ведущий. Одновременно командой может управлять
                  только один участник.
                </Text>
              </Stack>
            </form>
          ) : (
            <Card padding="lg" tone="muted">
              <Text align="center">Ведущий ещё не добавил команды.</Text>
            </Card>
          )}
        </Stack>
      </main>
    );
  }

  const ownTeam = game.teams.find((team) => team.id === teamId);
  if (!ownTeam) return null;
  const canAct = game.activeTeamId === teamId;
  const otherTeams = game.teams.filter((team) => team.id !== teamId);

  return (
    <main className="field-player-page mx-auto w-full max-w-[560px]">
      <Stack gap="lg">
        <Stack direction="row" gap="xs" align="center" justify="center" wrap>
          <Badge tone={status === "connected" ? "success" : "neutral"}>
            {status === "connected" ? `Комната ${room}` : "Переподключение…"}
          </Badge>
          <Button size="sm" variant="ghost" onClick={() => void leaveTeam()}>
            Сменить команду
          </Button>
        </Stack>

        <TeamScore team={ownTeam} active={canAct} own />

        {game.puzzle && (
          <PlayerPuzzlePreview
            puzzle={game.puzzle}
            canChoose={
              canAct &&
              status === "connected" &&
              game.phase === "awaiting-position"
            }
            pending={pending}
            onChoose={(index) => void request("position:choose", { index })}
          />
        )}

        <PlayerActions
          game={game}
          canAct={canAct && status === "connected"}
          pending={pending}
          guessLetter={(letter) => void request("letter:guess", { letter })}
        />

        <Card padding="md">
          <Stack gap="md">
            {game.puzzle?.clue && (
              <Text as="p" weight={600} align="center">
                {game.puzzle.clue}
              </Text>
            )}
            <Text as="p" size="sm" tone="muted" align="center" aria-live="polite">
              {game.statusMessage}
            </Text>
            <PlayerWheel
              game={game}
              canAct={canAct && status === "connected"}
              onSpin={() => void request("spin:request", {})}
            />
          </Stack>
        </Card>

        {otherTeams.length > 0 && (
          <details
            className="border border-border bg-surface p-md text-left"
            style={{ borderRadius: PLAYER_TEAM_GROUP_RADIUS }}
          >
            <summary className="cursor-pointer text-center font-semibold">
              Статистика других команд
            </summary>
            <div className="mt-md grid gap-sm">
              {otherTeams.map((team) => (
                <TeamScore
                  key={team.id}
                  team={team}
                  active={game.activeTeamId === team.id}
                />
              ))}
            </div>
          </details>
        )}
      </Stack>
    </main>
  );
};

export default FieldOfMiraclesPlayerPage;
