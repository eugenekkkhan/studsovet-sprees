import { createContext } from "react";
import type { AuthConfig, SessionUser, TelegramLoginUser } from "../api/authApi";

/**
 * `loading` — спрашиваем сервер; `authorized` — вошли; `anonymous` — вход нужен,
 * но ещё не состоялся; `denied` — Telegram узнал человека, а доступа нет;
 * `offline` — сервер не отвечает.
 */
export type AuthStatus =
  | "loading"
  | "authorized"
  | "anonymous"
  | "denied"
  | "offline";

export interface AuthContextType {
  status: AuthStatus;
  user: SessionUser | null;
  config: AuthConfig | null;
  error: string;
  /** Вход по имени для локальной разработки — сервер разрешает его сам. */
  signInAsDeveloper: (name: string) => Promise<void>;
  signInAsTester: (key: string, name: string) => Promise<void>;
  signInFromWebsite: (user: TelegramLoginUser) => Promise<void>;
  retry: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export default AuthContext;
