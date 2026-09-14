import {
  Heading,
  Stack,
} from "../../components/atoms";
import {
  FortuneWheelSection,
  HistorySection,
  LetterSection,
  RoundControlSection,
  TeamSection,
} from "../../components/organisms";
import { GameSessionInviteCard } from "../../components/molecules";
import { useEffect } from "react";
import { setClosingConfirmation } from "../../api/telegram";
import FieldGameProvider from "../../context/FieldGameProvider";
import { useGameContext } from "../../hooks/useGameContext";

const SessionBar = () => {
  const {
    sessionCode,
    joinUrl,
    hostJoinUrl,
    boardUrl,
    connectionStatus,
    connectionError,
  } = useGameContext();

  return <GameSessionInviteCard
    sessionCode={sessionCode}
    connectionStatus={connectionStatus}
    connectionError={connectionError}
    connectedText="Код комнаты; персональные ключи находятся в карточках команд"
    hostUrl={hostJoinUrl}
    captainUrl={joinUrl}
    boardUrl={boardUrl}
  />;
};

export const FieldOfMiraclesHostContent = () => {
  // Свайп вниз закрывал приложение прямо посреди игры — спрашиваем ведущего.
  useEffect(() => {
    setClosingConfirmation(true);
    return () => setClosingConfirmation(false);
  }, []);

  return (
    <Stack gap="lg" className="mx-auto w-full max-w-[1180px]">
    <Heading level={1} size={30} align="center">
      Поле чудес
    </Heading>
    <SessionBar />
    <RoundControlSection />
    <div className="grid items-start gap-xl lg:grid-cols-[minmax(0,1fr)_minmax(360px,450px)]">
      <Stack gap="lg">
        <LetterSection />
        <div className="hidden lg:block">
          <HistorySection />
        </div>
      </Stack>
      <FortuneWheelSection />
    </div>
    <TeamSection />
      <div className="lg:hidden">
        <HistorySection />
      </div>
    </Stack>
  );
};

/** Host console. Every mutation is acknowledged and broadcast by NestJS. */
const FieldOfMiraclesPage = () => (
  <FieldGameProvider>
    <FieldOfMiraclesHostContent />
  </FieldGameProvider>
);

export default FieldOfMiraclesPage;
