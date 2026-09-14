import { Notice, Stack } from "../../../atoms";
import HostBiddingPanel from "../HostBiddingPanel/HostBiddingPanel";
import HostFinalPanel from "../HostFinalPanel/HostFinalPanel";
import HostQuestionPanel from "../HostQuestionPanel/HostQuestionPanel";
import HostRoundBar from "../HostRoundBar/HostRoundBar";
import QuizBoard from "../QuizBoard/QuizBoard";
import QuizGameLog from "../QuizGameLog/QuizGameLog";
import QuizTeamsSection from "../QuizTeamsSection/QuizTeamsSection";
import { useQuizGame } from "../../../../hooks/useQuizGame";
import { boardFromHostState } from "../../../../utils/quizBoard";

/** Рабочий экран ведущего: табло, разыгрываемый вопрос и счёт. */
const HostGameTab = () => {
  const { game, send } = useQuizGame();
  const board = boardFromHostState(game);
  const active = game.activeQuestion;

  return (
    <Stack gap="lg">
      <HostRoundBar />

      {game.phase === "bidding" && <HostBiddingPanel />}
      {game.phase.startsWith("final") && <HostFinalPanel />}
      {["transfer", "question", "answer", "reveal"].includes(game.phase) && (
        <HostQuestionPanel />
      )}

      <QuizTeamsSection />

      {game.phase === "lobby" && !game.deck && (
        <Notice tone="info">
          Соберите колоду во вкладке «Колода», добавьте команды — и запускайте раунд.
        </Notice>
      )}

      <QuizBoard
        board={board}
        teams={game.teams}
        activeQuestionId={active?.questionId ?? null}
        disabled={game.phase !== "board"}
        onPick={(questionId) => send({ type: "PICK_QUESTION", questionId })}
      />

      <QuizGameLog history={game.history} />
    </Stack>
  );
};

export default HostGameTab;
