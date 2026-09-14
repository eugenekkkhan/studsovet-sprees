import { io, type Socket } from "socket.io-client";
import { backendUrl } from "./backendUrl";
import { getSession } from "./session";

export const createFieldOfMiraclesSocket = (): Socket =>
  io(`${backendUrl}/field-of-miracles`, {
    autoConnect: false,
    transports: ["websocket"],
    reconnection: true,
    // Комнату открывает вошедший пользователь: владельца сервер берёт отсюда,
    // а не из строки, которую клиент присылал сам. Функция, а не объект, —
    // чтобы после переподключения ушёл свежий токен.
    auth: (cb: (data: Record<string, unknown>) => void) =>
      cb({ token: getSession()?.token ?? "" }),
  });
