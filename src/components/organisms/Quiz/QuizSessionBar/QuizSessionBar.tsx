import { GameSessionInviteCard } from "../../../molecules";
import { useQuizGame } from "../../../../hooks/useQuizGame";

/** Код комнаты и ссылки: табло на проектор, пульт ведущего, вход капитанов. */
const QuizSessionBar = () => {
  const {
    sessionCode,
    boardUrl,
    hostJoinUrl,
    captainUrl,
    connectionStatus,
    connectionError,
  } = useQuizGame();
  const joinUrl = captainUrl();

  return <GameSessionInviteCard
    sessionCode={sessionCode}
    connectionStatus={connectionStatus}
    connectionError={connectionError}
    connectedText="Код комнаты; ключи капитанов — в карточках команд"
    hostUrl={hostJoinUrl}
    captainUrl={joinUrl}
    boardUrl={boardUrl}
  />;
};

export default QuizSessionBar;
