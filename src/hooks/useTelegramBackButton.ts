import { useEffect } from "react";
import { telegramWebApp } from "../api/telegram";

/**
 * Родная кнопка «назад» Telegram. Она была описана в типах и не использовалась
 * ни разу: на экране капитана и на табло выйти было нечем, кроме закрытия
 * всего приложения.
 */
export const useTelegramBackButton = (onBack: (() => void) | null) => {
  useEffect(() => {
    const app = telegramWebApp();
    if (!app?.initData || !onBack) return;

    app.BackButton.onClick(onBack);
    app.BackButton.show();
    return () => {
      app.BackButton.offClick(onBack);
      app.BackButton.hide();
    };
  }, [onBack]);
};
