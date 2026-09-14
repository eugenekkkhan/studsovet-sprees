import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { uploadMedia, type UploadAuth } from "../api/mediaApi";
import { createQuizSocket, emitAck, quizPublicUrl } from "../api/quizSocket";
import { noteServerTime } from "../api/serverClock";
import type { HostCommand, HostGameState, Team } from "../types/quiz";
import { showToast } from "../utils/toast";
import { useAuth } from "../hooks/useAuth";
import { inviteLink, startParams } from "../utils/inviteLinks";
import QuizGameContext, {
  EMPTY_HOST_STATE,
  type ConnectionStatus,
  type QuizGameContextType,
} from "./QuizGameContext";

const CREDENTIALS_KEY = "quizHostCredentialsV1";
const HOST_CACHE_KEY = "quizHostCacheV1";

interface HostCredentials {
  code: string;
  hostToken: string;
  hostJoinKey?: string;
}

export interface RemoteHostCredentials {
  code: string;
  hostJoinKey: string;
}

const parseJson = <T,>(key: string): T | null => {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
};

/** Команды прошлой комнаты переезжают в новую, если сервер перезапустился. */
const cachedTeams = (): Team[] => {
  const teams = parseJson<HostGameState>(HOST_CACHE_KEY)?.teams;
  return Array.isArray(teams) ? teams : [];
};

const QuizGameProvider = ({
  children,
  remoteCredentials,
}: {
  children: ReactNode;
  remoteCredentials?: RemoteHostCredentials;
}) => {
  const { config } = useAuth();
  const [socket] = useState(createQuizSocket);
  const [game, setGame] = useState<HostGameState>(EMPTY_HOST_STATE);
  const [sessionCode, setSessionCode] = useState("");
  const [hostJoinKey, setHostJoinKey] = useState("");
  // Права ведущего нужны и загрузке файлов, а не только сокету.
  const [uploadAuth, setUploadAuth] = useState<UploadAuth>({ code: "" });
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const acceptState = (state: HostGameState, replace = false) => {
      if (!active) return;
      noteServerTime(state.serverNow);
      setGame((current) =>
        replace || state.revision >= current.revision ? state : current,
      );
      localStorage.setItem(HOST_CACHE_KEY, JSON.stringify(state));
    };

    const fail = (message: string) => {
      if (!active) return;
      setConnectionStatus("disconnected");
      setConnectionError(message);
    };

    const succeed = (
      code: string,
      key: string,
      state: HostGameState,
      auth: Omit<UploadAuth, "code">,
      replace = false,
    ) => {
      setSessionCode(code);
      setHostJoinKey(key);
      setUploadAuth({ code, ...auth });
      acceptState(state, replace);
      setConnectionStatus("connected");
      setConnectionError(null);
    };

    const createSession = async () => {
      // Владельца комнаты сервер берёт из токена в рукопожатии сокета.
      const response = await emitAck<HostGameState>(socket, "session:create", {
        initialTeams: cachedTeams(),
      });
      if (!active) return;
      if (!response.ok || !response.code || !response.hostToken || !response.state) {
        fail(response.error ?? "Не удалось создать комнату.");
        return;
      }
      localStorage.setItem(
        CREDENTIALS_KEY,
        JSON.stringify({
          code: response.code,
          hostToken: response.hostToken,
          hostJoinKey: response.hostJoinKey,
        }),
      );
      // Перезапущенный сервер отдаёт новую комнату с нулевой ревизией.
      succeed(
        response.code,
        response.hostJoinKey ?? "",
        response.state,
        { hostToken: response.hostToken },
        true,
      );
    };

    const restoreOrCreate = async () => {
      setConnectionStatus("connecting");

      if (remoteCredentials) {
        const response = await emitAck<HostGameState>(socket, "host:join-remote", {
          code: remoteCredentials.code,
          hostJoinKey: remoteCredentials.hostJoinKey,
        });
        if (!active) return;
        if (!response.ok || !response.state) {
          fail(response.error ?? "Не удалось подключить пульт ведущего.");
          return;
        }
        succeed(
          remoteCredentials.code,
          response.hostJoinKey ?? remoteCredentials.hostJoinKey,
          response.state,
          { hostJoinKey: remoteCredentials.hostJoinKey },
          true,
        );
        return;
      }

      const credentials = parseJson<HostCredentials>(CREDENTIALS_KEY);
      if (credentials?.code && credentials.hostToken) {
        const response = await emitAck<HostGameState>(socket, "host:join", {
          code: credentials.code,
          hostToken: credentials.hostToken,
        });
        if (!active) return;
        if (response.ok && response.state) {
          const key = response.hostJoinKey ?? credentials.hostJoinKey ?? "";
          localStorage.setItem(
            CREDENTIALS_KEY,
            JSON.stringify({ ...credentials, hostJoinKey: key }),
          );
          succeed(credentials.code, key, response.state, {
            hostToken: credentials.hostToken,
          });
          return;
        }
        localStorage.removeItem(CREDENTIALS_KEY);
      }

      await createSession();
    };

    socket.on("connect", restoreOrCreate);
    socket.on("state:update", acceptState);
    socket.on("disconnect", () => {
      if (active) setConnectionStatus("disconnected");
    });
    socket.on("connect_error", () => fail("Нет соединения с игровым сервером."));
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

  const send = useCallback(
    (command: HostCommand) => {
      void emitAck(socket, "host:command", command).then((response) => {
        if (response.ok) return;
        const message = response.error ?? "Сервер отклонил действие.";
        setConnectionError(message);
        showToast.error(message);
      });
    },
    [socket],
  );

  const value = useMemo<QuizGameContextType>(() => {
    const base = quizPublicUrl();
    const room = encodeURIComponent(sessionCode);
    const telegramTarget = {
      miniAppUrl: config?.miniAppUrl,
      botUsername: config?.botUsername,
    };
    return {
      game,
      sessionCode,
      captainUrl: (teamKey?: string) =>
        sessionCode ? inviteLink(
          telegramTarget,
          startParams.quizPlayer(sessionCode, teamKey),
          `${base}/quiz/play?room=${room}${teamKey ? `&key=${encodeURIComponent(teamKey)}` : ""}`,
        ) : "",
      hostJoinUrl:
        sessionCode && hostJoinKey
          ? inviteLink(
              telegramTarget,
              startParams.quizHost(sessionCode, hostJoinKey),
              `${base}/quiz/host?room=${room}&key=${encodeURIComponent(hostJoinKey)}`,
            )
          : "",
      boardUrl: sessionCode ? `${base}/quiz/board?room=${room}` : "",
      connectionStatus,
      connectionError,
      isRemoteHost: Boolean(remoteCredentials),
      send,
      uploadMedia: (file: File) => uploadMedia(file, uploadAuth),
    };
  }, [
    connectionError,
    connectionStatus,
    config?.botUsername,
    config?.miniAppUrl,
    game,
    hostJoinKey,
    remoteCredentials,
    send,
    sessionCode,
    uploadAuth,
  ]);

  return (
    <QuizGameContext.Provider value={value}>{children}</QuizGameContext.Provider>
  );
};

export default QuizGameProvider;
