import { useState } from "react";
import { useSearchParams } from "react-router";
import {
  Badge,
  Button,
  Card,
  Heading,
  Input,
  LoadingSpinner,
  Stack,
  Text,
} from "../../components/atoms";
import { FullscreenButton, MediaPreview } from "../../components/molecules";
import { QuizBoard, QuizScoreboard } from "../../components/organisms";
import { useQuizRoom } from "../../hooks/useQuizRoom";
import { PHASE_LABEL, QUESTION_TYPE_LABEL } from "../../utils/quizLabels";
import type { PublicGameState } from "../../types/quiz";

/** Фазы, на которых зал смотрит на табло, а не на всплывающий вопрос. */
const BOARD_ONLY = ["lobby", "board", "round-over"];

const StageAnswer = ({ answer }: { answer: string }) => (
  <div className="stage-answer ui-surface w-full border-[1.5px] border-success bg-success-soft px-lg py-md">
    <Stack gap="2xs" align="center">
      <Text size="sm" tone="muted" uppercase>
        Ответ
      </Text>
      <Text
        as="p"
        weight={700}
        align="center"
        className="text-[clamp(24px,3.4vw,44px)] leading-tight"
      >
        {answer}
      </Text>
    </Stack>
  </div>
);

/** Содержимое всплывающего слоя: торги, вопрос с ответом или финал. */
const Stage = ({ game }: { game: PublicGameState }) => {
  const active = game.activeQuestion;
  const final = game.final;

  if (game.phase === "bidding" && game.bidding) {
    const leader = game.teams.find((team) => team.id === game.bidding?.highestTeamId);
    return (
      <Stack gap="sm" align="center">
        <Badge tone="danger">Аукцион</Badge>
        <Heading level={2} align="center" className="text-[clamp(28px,4vw,52px)]">
          {game.bidding.highestBid}
        </Heading>
        <Text as="p" size="xl" align="center">
          «{leader?.name ?? "—"}»{game.bidding.allIn ? " · ва-банк" : ""}
        </Text>
      </Stack>
    );
  }

  if (final && game.phase.startsWith("final")) {
    return (
      <Stack gap="md" align="center">
        <Badge tone="primary">
          Финал{final.playingThemeName ? `: ${final.playingThemeName}` : ""}
        </Badge>
        {game.phase === "final-themes" && (
          <Stack direction="row" gap="sm" wrap justify="center">
            {final.themes.map((theme) => (
              <Badge
                key={theme.id}
                tone={final.removedThemeIds.includes(theme.id) ? "neutral" : "primary"}
              >
                {final.removedThemeIds.includes(theme.id) ? `✕ ${theme.name}` : theme.name}
              </Badge>
            ))}
          </Stack>
        )}
        {final.question && (
          <Text
            as="p"
            align="center"
            className="text-[clamp(22px,3vw,40px)] leading-snug"
          >
            {final.question}
          </Text>
        )}
        <MediaPreview
          url={final.media?.url}
          type={final.media?.type}
          maxHeight="min(52vh, 640px)"
        />
        {final.answer && <StageAnswer answer={final.answer} />}
      </Stack>
    );
  }

  if (!active) {
    return (
      <Text as="p" size="xl" align="center" tone="muted">
        {game.statusMessage}
      </Text>
    );
  }

  return (
    <Stack gap="md" align="center">
      <Stack direction="row" gap="sm" align="center" justify="center" wrap>
        <Badge tone="primary">{active.themeName}</Badge>
        {active.price > 0 && <Badge tone="neutral">{active.price}</Badge>}
        {active.type !== "simple" && (
          <Badge tone="danger">{QUESTION_TYPE_LABEL[active.type]}</Badge>
        )}
      </Stack>
      <Text
        as="p"
        align="center"
        className="text-[clamp(22px,3.2vw,44px)] leading-snug font-medium"
      >
        {active.text || "…"}
      </Text>
      <MediaPreview
        url={active.media?.url}
        type={active.media?.type}
        maxHeight={
          active.media?.type === "video"
            ? "min(78dvh, 1100px)"
            : "min(62vh, 760px)"
        }
      />
      {active.answerRevealed && active.answer && (
        <>
          <StageAnswer answer={active.answer} />
          <MediaPreview
            url={active.answerMedia?.url}
            type={active.answerMedia?.type}
            maxHeight={
              active.answerMedia?.type === "video"
                ? "min(68dvh, 940px)"
                : "min(38vh, 460px)"
            }
          />
        </>
      )}
    </Stack>
  );
};

/** Табло на проектор: только то, что можно показывать залу. */
const QuizBoardPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const room = searchParams.get("room")?.trim().toUpperCase() ?? "";
  const [roomDraft, setRoomDraft] = useState(room);
  const { game, status, error } = useQuizRoom(room);

  if (!room) {
    return (
      <main className="quiz-board-page mx-auto flex min-h-dvh w-full max-w-[420px] items-center p-lg">
        {/* The lg submit button holds the bottom corners. */}
        <Card padding="lg" content="lg" className="w-full">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const next = roomDraft.trim().toUpperCase();
              if (next) setSearchParams({ room: next }, { replace: true });
            }}
          >
            <Stack gap="md">
              <Heading level={1} size={26} align="center">
                Табло игры
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
      <main className="quiz-board-page flex min-h-dvh w-full items-center justify-center p-lg">
        <Stack direction="row" gap="xs" align="center">
          {status === "connecting" && <LoadingSpinner size="sm" />}
          <Text role="status">{error ?? "Подключаемся к комнате…"}</Text>
        </Stack>
      </main>
    );
  }

  const stageOpen = !BOARD_ONLY.includes(game.phase);

  return (
    <main className="quiz-board-page flex min-h-dvh w-full flex-col gap-md p-lg">
      <Stack direction="row" gap="sm" align="center" justify="center" wrap>
        <Heading level={1} size={24}>
          {game.deckName ?? "Своя игра"}
        </Heading>
        <Badge tone={status === "connected" ? "success" : "neutral"}>
          Комната {room}
        </Badge>
        <Badge tone="primary">{PHASE_LABEL[game.phase]}</Badge>
        <FullscreenButton />
      </Stack>

      {/* Табло занимает весь экран и остаётся на месте: вопрос всплывает над ним. */}
      <div className="relative flex min-h-0 flex-1">
        <QuizBoard
          board={game.board}
          teams={game.teams}
          activeQuestionId={game.activeQuestion?.questionId ?? null}
          size="lg"
          fill
        />

        {/* Вопрос перекрывает весь экран, а не только область табло: в зале
            смотрят на него, и обрезать его сеткой тем незачем. */}
        {stageOpen && (
          <div
            className="stage-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-md"
            role="region"
            aria-live="polite"
            aria-label="Разыгрываемый вопрос"
          >
            <Card
              padding="xl"
              className="stage-card scroll-panel max-h-[94vh] w-[min(96vw,1500px)] overflow-y-auto shadow-xl"
            >
              <Stage game={game} />
            </Card>
          </div>
        )}
      </div>

      <div className="shrink-0">
        <QuizScoreboard
          teams={game.teams}
          pickerTeamId={game.pickerTeamId}
          answeringTeamId={
            game.activeQuestion?.buzzedTeamId ??
            game.activeQuestion?.soloTeamId ??
            null
          }
          lockedTeamIds={game.activeQuestion?.lockedTeamIds ?? []}
          size="lg"
        />
      </div>
    </main>
  );
};

export default QuizBoardPage;
