import { useEffect, useState } from "react";
import { createFieldOfMiraclesSocket } from "../api/fieldOfMiraclesSocket";
import { noteServerTime } from "../api/serverClock";
import type { PublicFieldGameState } from "../types/fieldOfMiracles";

export type FieldRoomStatus = "connecting" | "connected" | "disconnected";

interface Ack {
  ok: boolean;
  error?: string;
  state?: PublicFieldGameState;
}

/**
 * Наблюдение за комнатой «Поля чудес» без права хода: так смотрит зал.
 * Состояние приходит публичное — загаданное слово в нём закрыто маской,
 * поэтому проектор можно вывести на экран, ничего не выдав игрокам.
 */
export const useFieldRoom = (room: string) => {
  const [socket] = useState(createFieldOfMiraclesSocket);
  const [game, setGame] = useState<PublicFieldGameState | null>(null);
  const [status, setStatus] = useState<FieldRoomStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const acceptState = (next: PublicFieldGameState) => {
      if (!active) return;
      noteServerTime(next.serverNow);
      setGame((current) =>
        !current || next.revision >= current.revision ? next : current,
      );
    };

    const watch = () => {
      if (!room) {
        setStatus("connected");
        return;
      }
      setStatus("connecting");
      socket.timeout(7000).emit(
        "session:watch",
        { code: room },
        (timeout: Error | null, response?: Ack) => {
          if (!active) return;
          if (timeout || !response?.ok || !response.state) {
            setStatus("disconnected");
            setError(response?.error ?? "Комната не найдена.");
            return;
          }
          acceptState(response.state);
          setStatus("connected");
          setError(null);
        },
      );
    };

    socket.on("connect", watch);
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
      socket.off("connect", watch);
      socket.off("state:update", acceptState);
      socket.off("disconnect");
      socket.off("connect_error");
      socket.disconnect();
    };
  }, [room, socket]);

  return { game, status, error };
};
