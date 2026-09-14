import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { publicUrl } from "../api/backendUrl";
import { useAuth } from "../hooks/useAuth";
import { inviteLink, startParams } from "../utils/inviteLinks";
import { noteServerTime } from "../api/serverClock";
import { createFieldOfMiraclesSocket } from "../api/fieldOfMiraclesSocket";
import { getFortuneSector } from "../constants/fortuneSectors";
import { createInitialGameState } from "../reducers/fieldOfMiraclesReducer";
import type {
  FieldGameViewState,
  Team,
} from "../types/fieldOfMiracles";
import { showToast } from "../utils/toast";
import GameContext, {
  type GameContextType,
  type StartRoundPayload,
} from "./GameContext";

const CREDENTIALS_KEY = "fieldOfMiraclesHostCredentialsV1";
const HOST_CACHE_KEY = "fieldOfMiraclesHostCacheV1";

interface HostCredentials {
  code: string;
  hostToken: string;
  hostJoinKey?: string;
}

interface RemoteHostCredentials {
  code: string;
  hostJoinKey: string;
}

interface Ack<T = undefined> {
  ok: boolean;
  error?: string;
  code?: string;
  hostToken?: string;
  hostJoinKey?: string;
  state?: T;
}

type HostCommand =
  | { type: "ADD_TEAM"; name: string; color: string }
  | { type: "REMOVE_TEAM"; teamId: string }
  | { type: "UPDATE_TEAM"; teamId: string; name: string; color: string }
  | { type: "SET_TEAM_POINTS"; teamId: string; points: number }
  | ({ type: "START_ROUND" } & StartRoundPayload)
  | { type: "GUESS_LETTER"; letter: string }
  | { type: "CHOOSE_POSITION"; index: number }
  | { type: "ATTEMPT_SOLVE"; answer: string }
  | { type: "RESOLVE_SPECIAL"; success: boolean }
  | { type: "PASS_TURN" }
  | { type: "UNDO" }
  | { type: "NEW_GAME" };

const initialViewState = (): FieldGameViewState => {
  const game = createInitialGameState();
  return {
    teams: game.teams,
    activeTeamId: game.activeTeamId,
    phase: game.phase,
    round: game.round,
    puzzle: game.puzzle,
    currentSectorId: game.currentSectorId,
    winnerTeamId: game.winnerTeamId,
    correctGuessStreak: game.correctGuessStreak,
    statusMessage: game.statusMessage,
    statusTone: game.statusTone,
    history: game.history,
    spin: game.spin,
    undoAvailable: false,
    revision: 0,
    serverNow: 0,
    connectedTeamIds: [],
  };
};

const parseJson = <T,>(key: string): T | null => {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
};

const readMigratedTeams = (): Team[] => {
  const cached = parseJson<FieldGameViewState>(HOST_CACHE_KEY)?.teams;
  if (Array.isArray(cached)) return cached;
  const legacy = parseJson<{ state?: { teams?: Team[] } }>(
    "fieldOfMiraclesGameV2",
  )?.state?.teams;
  return Array.isArray(legacy) ? legacy : [];
};

const emitAck = <T,>(
  socket: ReturnType<typeof createFieldOfMiraclesSocket>,
  event: string,
  payload: unknown,
) =>
  new Promise<Ack<T>>((resolve) => {
    socket.timeout(7000).emit(
      event,
      payload,
      (error: Error | null, response?: Ack<T>) => {
        resolve(
          error || !response
            ? { ok: false, error: "Сервер не ответил. Проверьте подключение." }
            : response,
        );
      },
    );
  });

const FieldGameProvider = ({
  children,
  remoteCredentials,
}: {
  children: ReactNode;
  remoteCredentials?: RemoteHostCredentials;
}) => {
  const { config } = useAuth();
  const [socket] = useState(createFieldOfMiraclesSocket);
  const [game, setGame] = useState<FieldGameViewState>(initialViewState);
  const [sessionCode, setSessionCode] = useState("");
  const [hostJoinKey, setHostJoinKey] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const acceptState = (state: FieldGameViewState, replace = false) => {
      if (!active) return;
      noteServerTime(state.serverNow);
      setGame((current) =>
        replace || state.revision >= current.revision ? state : current,
      );
      localStorage.setItem(HOST_CACHE_KEY, JSON.stringify(state));
    };

    const createSession = async () => {
      const response = await emitAck<FieldGameViewState>(
        socket,
        "session:create",
        // Владельца комнаты сервер берёт из токена в рукопожатии сокета.
        { initialTeams: readMigratedTeams() },
      );
      if (!active) return;
      if (!response.ok || !response.code || !response.hostToken || !response.state) {
        setConnectionStatus("disconnected");
        setConnectionError(response.error ?? "Не удалось создать комнату.");
        return;
      }
      const credentials = {
        code: response.code,
        hostToken: response.hostToken,
        hostJoinKey: response.hostJoinKey,
      };
      localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
      setSessionCode(response.code);
      setHostJoinKey(response.hostJoinKey ?? "");
      // A restarted backend creates a new room whose revision begins at zero.
      acceptState(response.state, true);
      setConnectionStatus("connected");
      setConnectionError(null);
    };

    const restoreOrCreate = async () => {
      setConnectionStatus("connecting");
      if (remoteCredentials) {
        const response = await emitAck<FieldGameViewState>(
          socket,
          "host:join-remote",
          remoteCredentials,
        );
        if (!active) return;
        if (!response.ok || !response.state) {
          setConnectionStatus("disconnected");
          setConnectionError(
            response.error ?? "Не удалось подключить пульт ведущего.",
          );
          return;
        }
        setSessionCode(remoteCredentials.code);
        setHostJoinKey(response.hostJoinKey ?? remoteCredentials.hostJoinKey);
        acceptState(response.state, true);
        setConnectionStatus("connected");
        setConnectionError(null);
        return;
      }
      const credentials = parseJson<HostCredentials>(CREDENTIALS_KEY);
      if (credentials?.code && credentials.hostToken) {
        const response = await emitAck<FieldGameViewState>(socket, "host:join", {
          code: credentials.code,
          hostToken: credentials.hostToken,
        });
        if (!active) return;
        if (response.ok && response.state) {
          setSessionCode(credentials.code);
          setHostJoinKey(
            response.hostJoinKey ?? credentials.hostJoinKey ?? "",
          );
          localStorage.setItem(
            CREDENTIALS_KEY,
            JSON.stringify({
              ...credentials,
              hostJoinKey:
                response.hostJoinKey ?? credentials.hostJoinKey ?? undefined,
            }),
          );
          acceptState(response.state);
          setConnectionStatus("connected");
          setConnectionError(null);
          return;
        }
        localStorage.removeItem(CREDENTIALS_KEY);
      }
      await createSession();
    };

    socket.on("connect", restoreOrCreate);
    socket.on("disconnect", () => {
      if (active) setConnectionStatus("disconnected");
    });
    socket.on("connect_error", () => {
      if (!active) return;
      setConnectionStatus("disconnected");
      setConnectionError("Нет соединения с игровым сервером.");
    });
    socket.on("state:update", acceptState);
    socket.connect();

    return () => {
      active = false;
      socket.off("connect", restoreOrCreate);
      socket.off("state:update", acceptState);
      socket.off("disconnect");
      socket.off("connect_error");
      socket.disconnect();
    };
  }, [remoteCredentials, socket]);

  const sendCommand = useCallback(
    (command: HostCommand) => {
      // Прикладываем ревизию, которую видит этот пульт: сервер отобьёт
      // разрушающую команду, если второй пульт уже успел изменить игру.
      void emitAck(socket, "host:command", {
        command,
        expectedRevision: game.revision,
      }).then((response) => {
        if (!response.ok) {
          const message = response.error ?? "Сервер отклонил действие.";
          setConnectionError(message);
          showToast.error(message);
        }
      });
    },
    [game.revision, socket],
  );

  const beginSpin = useCallback(() => {
    void emitAck(socket, "spin:request", {}).then((response) => {
      if (!response.ok) {
        const message = response.error ?? "Сервер отклонил вращение.";
        setConnectionError(message);
        showToast.error(message);
      }
    });
  }, [socket]);

  const value = useMemo<GameContextType>(() => {
    const activeTeam =
      game.teams.find((team) => team.id === game.activeTeamId) ?? null;
    // Игроки и второй ведущий работают в Telegram. Табло — обычная публичная
    // веб-страница для проектора, телевизора или любого другого устройства.
    const target = {
      miniAppUrl: config?.miniAppUrl,
      botUsername: config?.botUsername,
    };
    const joinUrl = sessionCode
      ? inviteLink(
          target,
          startParams.fieldPlayer(sessionCode),
          `${publicUrl}/field-of-miracles/play?room=${encodeURIComponent(sessionCode)}`,
        )
      : "";
    const hostJoinUrl =
      sessionCode && hostJoinKey
        ? inviteLink(
            target,
            startParams.fieldHost(sessionCode, hostJoinKey),
            `${publicUrl}/field-of-miracles/host?room=${encodeURIComponent(sessionCode)}&key=${encodeURIComponent(hostJoinKey)}`,
          )
        : "";
    const boardUrl = sessionCode
      ? `${publicUrl}/field-of-miracles/board?room=${encodeURIComponent(sessionCode)}`
      : "";
    return {
      game,
      teams: game.teams,
      activeTeam,
      currentSector: getFortuneSector(game.currentSectorId),
      sessionCode,
      joinUrl,
      hostJoinUrl,
      boardUrl,
      connectionStatus,
      connectionError,
      addTeam: (name, color) =>
        sendCommand({ type: "ADD_TEAM", name, color }),
      removeTeam: (teamId) => sendCommand({ type: "REMOVE_TEAM", teamId }),
      updateTeam: (teamId, name, color) =>
        sendCommand({ type: "UPDATE_TEAM", teamId, name, color }),
      setPoints: (teamId, points) =>
        sendCommand({ type: "SET_TEAM_POINTS", teamId, points }),
      startRound: (payload) => sendCommand({ type: "START_ROUND", ...payload }),
      beginSpin,
      guessLetter: (letter) => sendCommand({ type: "GUESS_LETTER", letter }),
      choosePosition: (index) =>
        sendCommand({ type: "CHOOSE_POSITION", index }),
      attemptSolve: (answer) =>
        sendCommand({ type: "ATTEMPT_SOLVE", answer }),
      resolveSpecial: (success) =>
        sendCommand({ type: "RESOLVE_SPECIAL", success }),
      passTurn: () => sendCommand({ type: "PASS_TURN" }),
      undo: () => sendCommand({ type: "UNDO" }),
      newGame: () => sendCommand({ type: "NEW_GAME" }),
    };
  }, [
    beginSpin,
    config?.botUsername,
    config?.miniAppUrl,
    connectionError,
    connectionStatus,
    game,
    hostJoinKey,
    sendCommand,
    sessionCode,
  ]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export default FieldGameProvider;
export type { RemoteHostCredentials };
