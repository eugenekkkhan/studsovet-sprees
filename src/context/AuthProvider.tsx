import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  fetchAuthConfig,
  fetchMe,
  loginAsDeveloper,
  loginAsTester as requestTestLogin,
  loginWithTelegram,
  loginWithTelegramWidget,
  type TelegramLoginUser,
  type AuthConfig,
  type SessionUser,
} from "../api/authApi";
import { ApiError, setUnauthorizedHandler } from "../api/http";
import { getSession, setSession } from "../api/session";
import { prepareMiniApp, telegramWebApp } from "../api/telegram";
import AuthContext, {
  type AuthContextType,
  type AuthStatus,
} from "./AuthContext";

/**
 * Вход в приложение. Внутри Telegram он молчаливый: мини-приложение отдаёт
 * подписанный `initData`, сервер проверяет подпись и участие в чате с ботом.
 * Вне Telegram остаётся вход по имени — если сервер его разрешает.
 */
const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    return prepareMiniApp();
  }, []);

  useEffect(() => {
    let active = true;

    const signIn = async () => {
      setStatus("loading");
      setError("");

      let settings: AuthConfig;
      try {
        settings = await fetchAuthConfig();
      } catch {
        if (!active) return;
        setStatus("offline");
        setError("Игровой сервер не отвечает. Проверьте, что он запущен.");
        return;
      }
      if (!active) return;
      setConfig(settings);

      // Живая сессия с прошлого раза — самый быстрый путь внутрь.
      if (getSession()) {
        try {
          const me = await fetchMe();
          if (!active) return;
          setUser(me.user);
          setStatus("authorized");
          return;
        } catch {
          setSession(null);
        }
      }
      if (!active) return;

      const initData = telegramWebApp()?.initData ?? "";
      if (initData) {
        try {
          const session = await loginWithTelegram(initData);
          if (!active) return;
          setSession({ token: session.token, expiresAt: session.expiresAt });
          setUser(session.user);
          setStatus("authorized");
          return;
        } catch (cause) {
          if (!active) return;
          const denied = cause instanceof ApiError && cause.status === 403;
          setError(
            cause instanceof ApiError ? cause.message : "Telegram не подтвердил вход.",
          );
          setStatus(denied ? "denied" : "anonymous");
          return;
        }
      }

      setUser(null);
      setStatus("anonymous");
    };

    void signIn();
    return () => {
      active = false;
    };
  }, [attempt]);

  // Просроченный токен где-нибудь в фоне не должен оставлять полупустой экран.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus("anonymous");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const signInAsDeveloper = useCallback(async (name: string) => {
    setError("");
    try {
      const session = await loginAsDeveloper(name);
      setSession({ token: session.token, expiresAt: session.expiresAt });
      setUser(session.user);
      setStatus("authorized");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось войти.");
      throw cause;
    }
  }, []);

  const signInFromWebsite = useCallback(async (telegramUser: TelegramLoginUser) => {
    setError("");
    try {
      const session = await loginWithTelegramWidget(telegramUser);
      setSession({ token: session.token, expiresAt: session.expiresAt });
      setUser(session.user);
      setStatus("authorized");
    } catch (cause) {
      const denied = cause instanceof ApiError && cause.status === 403;
      setError(cause instanceof ApiError ? cause.message : "Не удалось войти через Telegram.");
      setStatus(denied ? "denied" : "anonymous");
      throw cause;
    }
  }, []);

  const signInAsTester = useCallback(async (key: string, name: string) => {
    setError("");
    try {
      const session = await requestTestLogin(key, name);
      setSession({ token: session.token, expiresAt: session.expiresAt });
      setUser(session.user);
      setStatus("authorized");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось выполнить тестовый вход.");
      throw cause;
    }
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      status,
      user,
      config,
      error,
      signInAsDeveloper,
      signInAsTester,
      signInFromWebsite,
      retry: () => setAttempt((current) => current + 1),
      signOut: () => {
        setSession(null);
        setUser(null);
        setStatus("anonymous");
      },
    }),
    [config, error, signInAsDeveloper, signInAsTester, signInFromWebsite, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
