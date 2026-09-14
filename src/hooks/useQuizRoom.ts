import { useCallback, useEffect, useState } from "react";
import { createQuizSocket, emitAck } from "../api/quizSocket";
import { noteServerTime } from "../api/serverClock";
import type { ParticipantCommand, PublicGameState } from "../types/quiz";
import { showToast } from "../utils/toast";

const PARTICIPANT_ID_KEY = "quizParticipantIdV1";

export const teamKeyStorageKey = (room: string) => `quizCaptainKey:${room}`;

const getParticipantId = () => {
  const stored = localStorage.getItem(PARTICIPANT_ID_KEY);
  if (stored) return stored;
  const generated =
    globalThis.crypto?.randomUUID?.() ??
    `quiz-player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(PARTICIPANT_ID_KEY, generated);
  return generated;
};

/**
 * Публичное подключение к комнате: капитан входит по ключу команды,
 * табло — как зритель. Состояние приходит без ответов на вопросы.
 */
export const useQuizRoom = (room: string) => {
  const [socket] = useState(createQuizSocket);
  const [game, setGame] = useState<PublicGameState | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">(
    "connecting",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;

    const acceptState = (next: PublicGameState) => {
      if (!active) return;
      noteServerTime(next.serverNow);
      setGame((current) =>
        !current || next.revision >= current.revision ? next : current,
      );
      setTeamId((currentTeamId) => {
        if (currentTeamId && !next.teams.some((team) => team.id === currentTeamId)) {
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
      const rememberedKey = localStorage.getItem(teamKeyStorageKey(room));
      const response = await emitAck<PublicGameState>(
        socket,
        rememberedKey ? "participant:join" : "session:watch",
        rememberedKey
          ? { code: room, teamKey: rememberedKey, participantId: getParticipantId() }
          : { code: room },
      );
      if (!active) return;

      if (!response.ok || !response.state) {
        // Ключ мог устареть — остаёмся в комнате хотя бы зрителем.
        if (rememberedKey) {
          setTeamId(null);
          const fallback = await emitAck<PublicGameState>(socket, "session:watch", {
            code: room,
          });
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

      setTeamId(response.teamId ?? null);
      acceptState(response.state);
      setStatus("connected");
      setError(null);
    };

    socket.on("connect", enterRoom);
    socket.on("state:update", acceptState);
    socket.on("disconnect", () => active && setStatus("disconnected"));
    socket.on("connect_error", () => {
      if (!active) return;
      setStatus("disconnected");
      setError("Нет соединения с игровым сервером.");
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
      const response = await emitAck<PublicGameState>(socket, event, payload);
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

  const sendCommand = useCallback(
    (command: ParticipantCommand) => {
      void request("participant:command", command);
    },
    [request],
  );

  const joinTeam = useCallback(
    async (key: string) => {
      const normalized = key.trim().toUpperCase();
      if (!normalized) return false;
      const response = await request("participant:join", {
        code: room,
        teamKey: normalized,
        participantId: getParticipantId(),
      });
      if (!response.ok || !response.teamId) return false;
      localStorage.setItem(teamKeyStorageKey(room), normalized);
      setTeamId(response.teamId);
      if (response.state) setGame(response.state);
      return true;
    },
    [request, room],
  );

  const leaveTeam = useCallback(async () => {
    const response = await request("session:watch", { code: room });
    if (!response.ok) return;
    localStorage.removeItem(teamKeyStorageKey(room));
    setTeamId(null);
    if (response.state) setGame(response.state);
  }, [request, room]);

  return { game, teamId, status, error, pending, sendCommand, joinTeam, leaveTeam };
};
