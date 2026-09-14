import { request } from "./http";

export interface SessionUser {
  id: number;
  name: string;
  username: string;
  photoUrl: string;
  kind: "telegram" | "dev";
}

export interface SessionResponse {
  token: string;
  expiresAt: number;
  user: SessionUser;
}

export interface AuthConfig {
  /** Сервер настроен на Telegram: без него в приложение не пускают. */
  requiresTelegram: boolean;
  /** Разрешён вход по имени — так работает локальная разработка. */
  devAuth: boolean;
  /** Включён временный вход для тестирования публичной сборки. */
  testAuth: boolean;
  miniAppUrl: string;
  botUsername: string;
  /** Чаты, участие в которых открывает доступ. */
  chats: { id: number; title: string }[];
}

export const fetchAuthConfig = () =>
  request<AuthConfig>("/auth/config", { auth: false });

export const loginWithTelegram = (initData: string) =>
  request<SessionResponse>("/auth/telegram", {
    method: "POST",
    body: JSON.stringify({ initData }),
    auth: false,
  });

export interface TelegramLoginUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export const loginWithTelegramWidget = (user: TelegramLoginUser) =>
  request<SessionResponse>("/auth/telegram/widget", {
    method: "POST",
    body: JSON.stringify({ user }),
    auth: false,
  });

export const loginAsDeveloper = (name: string) =>
  request<SessionResponse>("/auth/dev", {
    method: "POST",
    body: JSON.stringify({ name }),
    auth: false,
  });

export const loginAsTester = (key: string, name: string) =>
  request<SessionResponse>("/auth/test", {
    method: "POST",
    body: JSON.stringify({ key, name }),
    auth: false,
  });

export const fetchMe = () => request<{ user: SessionUser }>("/auth/me");
