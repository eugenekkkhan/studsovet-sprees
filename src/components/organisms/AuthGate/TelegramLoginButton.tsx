import { useEffect, useRef } from "react";
import type { TelegramLoginUser } from "../../../api/authApi";
import { useAuth } from "../../../hooks/useAuth";

declare global {
  interface Window {
    onStudsovetTelegramAuth?: (user: TelegramLoginUser) => void;
  }
}

/**
 * Telegram's widget wants a plain number of pixels, so this is the one corner
 * in the app that has to be read back out of CSS rather than written in it.
 * Its large button is 40px tall, which is also the app's md control height —
 * so the same radius makes it the same pill.
 */
const controlRadiusPx = () =>
  Number.parseInt(
    getComputedStyle(document.documentElement).getPropertyValue(
      "--radius-control-md",
    ),
    10,
  ) || 20;

const TelegramLoginButton = ({ botUsername }: { botUsername: string }) => {
  const container = useRef<HTMLDivElement>(null);
  const { signInFromWebsite } = useAuth();

  useEffect(() => {
    const target = container.current;
    if (!target || !botUsername) return;
    window.onStudsovetTelegramAuth = (user) => {
      void signInFromWebsite(user).catch(() => undefined);
    };

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.dataset.telegramLogin = botUsername.replace(/^@/, "");
    script.dataset.size = "large";
    script.dataset.radius = String(controlRadiusPx());
    script.dataset.userpic = "false";
    script.dataset.requestAccess = "write";
    script.dataset.onauth = "onStudsovetTelegramAuth(user)";
    target.appendChild(script);

    return () => {
      delete window.onStudsovetTelegramAuth;
      target.replaceChildren();
    };
  }, [botUsername, signInFromWebsite]);

  return (
    <div
      ref={container}
      className="flex min-h-(--control-height-md) justify-center"
    />
  );
};

export default TelegramLoginButton;
