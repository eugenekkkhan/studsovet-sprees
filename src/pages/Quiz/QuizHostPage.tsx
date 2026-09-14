import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { accessDeckShare } from "../../api/decksApi";
import { ApiError } from "../../api/http";
import { Heading, Stack } from "../../components/atoms";
import { Tabs } from "../../components/molecules";
import {
  DeckEditor,
  DeckLibraryPanel,
  HostGameTab,
  QuizSessionBar,
  SharedDecksPanel,
} from "../../components/organisms";
import QuizGameProvider from "../../context/QuizGameProvider";
import { useDeckLibrary } from "../../hooks/useDeckLibrary";
import { useQuizGame } from "../../hooks/useQuizGame";
import { useSharedDecks } from "../../hooks/useSharedDecks";
import { cardRadius } from "../../styles/tokens";
import { showToast } from "../../utils/toast";

type HostTab = "game" | "deck" | "shared";

const tabs: { value: HostTab; label: string }[] = [
  { value: "game", label: "Игра" },
  { value: "deck", label: "Мои колоды" },
  { value: "shared", label: "Общие" },
];

/**
 * `/quiz?share=<код>` — «запустить в своей игре» с экрана секретной ссылки.
 * Колода приезжает в комнату один раз, после чего код уходит из адреса: F5 не
 * должен грузить её заново поверх начатой игры.
 */
const useSharedDeckLoader = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { game, send, connectionStatus } = useQuizGame();
  const code = searchParams.get("share");
  const handled = useRef(false);

  useEffect(() => {
    if (!code || handled.current || connectionStatus !== "connected") return;
    handled.current = true;

    const drop = () => {
      const rest = new URLSearchParams(searchParams);
      rest.delete("share");
      setSearchParams(rest, { replace: true });
    };

    if (game.deck && !window.confirm("Загрузить колоду в игру? Табло и текущий раунд сбросятся.")) {
      drop();
      return;
    }

    void accessDeckShare(code)
      .then(({ deck }) => {
        send({ type: "LOAD_DECK", deck: deck.deck });
        showToast.success(`Колода «${deck.deck.name}» отправлена в игру.`);
      })
      .catch((cause) =>
        showToast.error(
          cause instanceof ApiError ? cause.message : "Не удалось открыть колоду по ссылке.",
        ),
      )
      .finally(drop);
  }, [code, connectionStatus, game.deck, searchParams, send, setSearchParams]);
};

/** Консоль ведущего. Её же открывает второе устройство по ключу. */
export const QuizHostConsole = ({ remote = false }: { remote?: boolean }) => {
  const [tab, setTab] = useState<HostTab>("game");
  const library = useDeckLibrary();
  useSharedDeckLoader();
  // Общий список тянем только когда на него смотрят и вход состоялся.
  const shared = useSharedDecks(tab === "shared" && library.syncState !== "signedOut");

  return (
    <Stack gap="lg" className="mx-auto w-full max-w-[1180px]">
      <Heading level={1} size={30} align="center">
        Своя игра
      </Heading>
      <QuizSessionBar />
      <div
        className={
          remote
            ? "sticky top-xs z-[100] bg-surface/95 p-2xs shadow-sm backdrop-blur"
            : undefined
        }
        // 4px of padding around the segmented control it wraps.
        style={remote ? { borderRadius: cardRadius("2xs", "md") } : undefined}
      >
        <Tabs
          items={tabs}
          value={tab}
          onChange={setTab}
          variant="segmented"
          block
        />
      </div>

      {tab === "game" && <HostGameTab />}

      {tab === "deck" && (
        <Stack gap="lg">
          <DeckLibraryPanel library={library} onPublish={library.publish} />
          {library.activeDeck && (
            <DeckEditor deck={library.activeDeck} onChange={library.save} />
          )}
        </Stack>
      )}

      {tab === "shared" && (
        <SharedDecksPanel shared={shared} onCopied={library.reload} />
      )}
    </Stack>
  );
};

const QuizHostPage = () => (
  <QuizGameProvider>
    <QuizHostConsole />
  </QuizGameProvider>
);

export default QuizHostPage;
