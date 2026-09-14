import { io, type Socket } from "socket.io-client";
import { backendUrl, publicUrl } from "./backendUrl";
import { getSession } from "./session";

export const createQuizSocket = (): Socket =>
  io(`${backendUrl}/quiz`, {
    autoConnect: false,
    transports: ["websocket"],
    reconnection: true,
    // Комнату открывает вошедший пользователь: владельца сервер берёт отсюда,
    // а не из строки, которую клиент присылал сам. Функция, а не объект, —
    // чтобы после переподключения ушёл свежий токен.
    auth: (cb: (data: Record<string, unknown>) => void) =>
      cb({ token: getSession()?.token ?? "" }),
  });

export interface Ack<T = undefined> {
  ok: boolean;
  error?: string;
  code?: string;
  teamId?: string;
  hostToken?: string;
  hostJoinKey?: string;
  state?: T;
}

/** Запрос с подтверждением: сервер отвечает на каждое действие. */
export const emitAck = <T,>(socket: Socket, event: string, payload: unknown) =>
  new Promise<Ack<T>>((resolve) => {
    socket
      .timeout(7000)
      .emit(event, payload, (error: Error | null, response?: Ack<T>) => {
        resolve(
          error || !response
            ? { ok: false, error: "Сервер не ответил. Проверьте подключение." }
            : response,
        );
      });
  });

/** Ссылки для приглашений: капитаны, второй пульт ведущего и табло. */
export const quizPublicUrl = () => publicUrl;
