import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Badge,
  Button,
  Card,
  Heading,
  Input,
  LoadingSpinner,
  Notice,
  Stack,
  Text,
} from "../../components/atoms";
import { AnswerBox, answerBoxRadius, MediaPreview } from "../../components/molecules";
import {
  CaptainPanel,
  QuizBoard,
  QuizScoreboard,
} from "../../components/organisms";
import { teamKeyStorageKey, useQuizRoom } from "../../hooks/useQuizRoom";
import { formatScore, QUESTION_TYPE_LABEL } from "../../utils/quizLabels";
import { cardRadius } from "../../styles/tokens";

// The score fold is padded md around the scoreboard's team cards.
const SCORE_GROUP_RADIUS = cardRadius("md", cardRadius("sm", "sm"));

const RoomForm = ({
  room,
  teamKey,
  error,
  onSubmit,
}: {
  room: string;
  teamKey: string;
  error: string | null;
  onSubmit: (room: string, key: string) => void;
}) => {
  const [roomDraft, setRoomDraft] = useState(room);
  const [keyDraft, setKeyDraft] = useState(teamKey);

  return (
    <main className="quiz-player-page mx-auto w-full max-w-[480px]">
      {/* The lg submit button holds the bottom corners. */}
      <Card padding="lg" content="lg">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(roomDraft.trim().toUpperCase(), keyDraft.trim().toUpperCase());
          }}
        >
          <Stack gap="md">
            <Heading level={1} size={28} align="center">
              Вход капитана
            </Heading>
            <Input
              autoFocus
              value={roomDraft}
              placeholder="Код комнаты"
              autoCapitalize="characters"
              onChange={(event) => setRoomDraft(event.target.value.toUpperCase())}
            />
            <Input
              value={keyDraft}
              placeholder="Ключ команды"
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(event) => setKeyDraft(event.target.value.toUpperCase())}
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
};

/** Экран капитана: кнопка, ставки, выбор клетки и финальные ответы. */
const QuizPlayerPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const room = searchParams.get("room")?.trim().toUpperCase() ?? "";
  const urlKey = searchParams.get("key")?.trim().toUpperCase() ?? "";
  const [keyDraft, setKeyDraft] = useState(urlKey);
  const { game, teamId, status, error, pending, sendCommand, joinTeam, leaveTeam } =
    useQuizRoom(room);

  // Ключ из ссылки запоминается, чтобы следующий вход прошёл сам.
  useEffect(() => {
    if (room && urlKey) localStorage.setItem(teamKeyStorageKey(room), urlKey);
  }, [room, urlKey]);

  const enterRoom = (nextRoom: string, nextKey: string) => {
    if (!nextRoom) return;
    if (nextKey) localStorage.setItem(teamKeyStorageKey(nextRoom), nextKey);
    setSearchParams(
      nextKey ? { room: nextRoom, key: nextKey } : { room: nextRoom },
      { replace: true },
    );
  };

  if (!room || (!game && status !== "connecting")) {
    return <RoomForm room={room} teamKey={urlKey} error={error} onSubmit={enterRoom} />;
  }

  if (!game) {
    return (
      <main className="quiz-player-page mx-auto w-full max-w-[480px]">
        <Stack direction="row" gap="xs" align="center" justify="center">
          <LoadingSpinner size="sm" />
          <Text role="status">Подключаемся к игре…</Text>
        </Stack>
      </main>
    );
  }

  if (!teamId) {
    return (
      <main className="quiz-player-page mx-auto w-full max-w-[520px]">
        <Stack gap="md">
          <Stack gap="2xs" align="center">
            <Badge tone="neutral">Комната {room}</Badge>
            <Heading level={1} size={26} align="center">
              Займите место команды
            </Heading>
          </Stack>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void joinTeam(keyDraft);
            }}
          >
            <Stack gap="sm">
              <Input
                autoFocus
                value={keyDraft}
                placeholder="Ключ вашей команды"
                autoCapitalize="characters"
                autoComplete="off"
                onChange={(event) => setKeyDraft(event.target.value.toUpperCase())}
              />
              {error && <Text tone="danger">{error}</Text>}
              <Button type="submit" size="lg" loading={pending} disabled={pending}>
                Войти за команду
              </Button>
              <Text as="p" size="sm" tone="muted" align="center">
                Ключ выдаёт ведущий. За команду играет один капитан.
              </Text>
            </Stack>
          </form>
          <QuizScoreboard teams={game.teams} pickerTeamId={game.pickerTeamId} />
        </Stack>
      </main>
    );
  }

  const own = game.teams.find((team) => team.id === teamId);
  const active = game.activeQuestion;
  const isPicker = game.pickerTeamId === teamId;

  return (
    <main className="quiz-player-page mx-auto w-full max-w-[620px]">
      <Stack gap="lg">
        <Stack direction="row" gap="xs" align="center" justify="center" wrap>
          <Badge tone={status === "connected" ? "success" : "neutral"}>
            {status === "connected" ? `Комната ${room}` : "Переподключение…"}
          </Badge>
          {own && (
            <Badge tone="primary">
              {own.name}: {formatScore(own.score)}
            </Badge>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => void leaveTeam()}
          >
            Сменить команду
          </Button>
        </Stack>

        <CaptainPanel
          game={game}
          teamId={teamId}
          pending={pending}
          onCommand={sendCommand}
        />

        <Notice
          tone={game.statusTone}
          className="text-center"
          role="status"
          aria-live="polite"
        >
          {game.statusMessage}
        </Notice>

        {active && active.text && (
          // Открытый ответ садится в нижние углы карточки, и её радиус тогда
          // строится от него, а не от кнопок.
          <Card
            padding="md"
            tone="primary"
            content={
              active.answerRevealed && (active.answer || active.answerMedia)
                ? answerBoxRadius("md")
                : "md"
            }
          >
            <Stack gap="sm">
              <Stack direction="row" gap="xs" align="center" wrap>
                <Text weight={600}>{active.themeName}</Text>
                <Badge tone="neutral">{active.price}</Badge>
                {active.type !== "simple" && (
                  <Badge tone="danger">{QUESTION_TYPE_LABEL[active.type]}</Badge>
                )}
              </Stack>
              <Text as="p" size="lg">
                {active.text}
              </Text>
              {/* На телефоне картинка — сам вопрос: отдаём ей столько экрана,
                  сколько остаётся под текстом, а по касанию раскрываем во весь
                  экран — мелкую деталь иначе не разглядеть. */}
              <MediaPreview
                url={active.media?.url}
                type={active.media?.type}
                maxHeight="min(56vh, 520px)"
                zoomable
              />
              {active.answerRevealed && (active.answer || active.answerMedia) && (
                <AnswerBox
                  answer={active.answer ?? ""}
                  mediaUrl={active.answerMedia?.url}
                  mediaType={active.answerMedia?.type}
                  size="md"
                  zoomable
                />
              )}
            </Stack>
          </Card>
        )}

        {game.phase === "board" && (
          <QuizBoard
            board={game.board}
            teams={game.teams}
            activeQuestionId={active?.questionId ?? null}
            disabled={!isPicker || pending}
            onPick={(questionId) =>
              sendCommand({ type: "PICK_QUESTION", questionId })
            }
          />
        )}

        <details
          className="overflow-hidden border border-border bg-surface p-md text-left"
          style={{ borderRadius: SCORE_GROUP_RADIUS }}
        >
          <summary className="cursor-pointer text-center font-semibold">
            Счёт всех команд
          </summary>
          <div className="mt-md">
            <QuizScoreboard
              teams={game.teams}
              pickerTeamId={game.pickerTeamId}
              answeringTeamId={active?.buzzedTeamId ?? active?.soloTeamId ?? null}
              lockedTeamIds={active?.lockedTeamIds ?? []}
              ownTeamId={teamId}
            />
          </div>
        </details>
      </Stack>
    </main>
  );
};

export default QuizPlayerPage;
