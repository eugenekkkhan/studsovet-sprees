import { afterEach, describe, expect, it, vi } from "vitest";
import {
  haptic,
  insideTelegram,
  prepareMiniApp,
  setClosingConfirmation,
  telegramStartParam,
} from "./telegram";

const bridge = (overrides: Record<string, unknown> = {}) => ({
  initData: "auth_date=1&hash=abc",
  initDataUnsafe: { start_param: "field_ABCDEF" },
  version: "7.7",
  colorScheme: "dark" as const,
  themeParams: { bg_color: "#111111" },
  isExpanded: false,
  BackButton: { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
  ready: vi.fn(),
  expand: vi.fn(),
  close: vi.fn(),
  ...overrides,
});

afterEach(() => {
  delete (window as { Telegram?: unknown }).Telegram;
  document.documentElement.removeAttribute("data-telegram");
  document.documentElement.removeAttribute("data-telegram-theme");
  document.documentElement.removeAttribute("style");
  vi.restoreAllMocks();
});

describe("мост Telegram", () => {
  it("вне Telegram все вызовы молчат, а не падают", () => {
    // В обычном браузере скрипт Telegram тоже подгружается, но initData пуст.
    expect(insideTelegram()).toBe(false);
    expect(() => {
      haptic.press();
      haptic.tap();
      haptic.success();
      haptic.failure();
      setClosingConfirmation(true);
      prepareMiniApp();
    }).not.toThrow();
    expect(telegramStartParam()).toBe("");
  });

  it("пустой initData не считается запуском из Telegram", () => {
    (window as { Telegram?: unknown }).Telegram = {
      WebApp: bridge({ initData: "" }),
    };
    expect(insideTelegram()).toBe(false);
  });

  it("внутри Telegram передаёт отклик и параметр запуска", () => {
    const HapticFeedback = {
      impactOccurred: vi.fn(),
      notificationOccurred: vi.fn(),
      selectionChanged: vi.fn(),
    };
    (window as { Telegram?: unknown }).Telegram = {
      WebApp: bridge({ HapticFeedback }),
    };

    haptic.press();
    haptic.tap();
    haptic.failure();
    expect(HapticFeedback.impactOccurred).toHaveBeenCalledWith("heavy");
    expect(HapticFeedback.selectionChanged).toHaveBeenCalled();
    expect(HapticFeedback.notificationOccurred).toHaveBeenCalledWith("error");
    expect(telegramStartParam()).toBe("field_ABCDEF");
  });

  it("на старом клиенте без отклика ничего не ломается", () => {
    (window as { Telegram?: unknown }).Telegram = { WebApp: bridge() };
    expect(() => haptic.press()).not.toThrow();
  });

  it("подтверждение закрытия включается и снимается", () => {
    const enableClosingConfirmation = vi.fn();
    const disableClosingConfirmation = vi.fn();
    (window as { Telegram?: unknown }).Telegram = {
      WebApp: bridge({ enableClosingConfirmation, disableClosingConfirmation }),
    };

    setClosingConfirmation(true);
    setClosingConfirmation(false);
    expect(enableClosingConfirmation).toHaveBeenCalledTimes(1);
    expect(disableClosingConfirmation).toHaveBeenCalledTimes(1);
  });

  it("не трогает свайпы на клиенте старше 7.7", () => {
    const disableVerticalSwipes = vi.fn();
    (window as { Telegram?: unknown }).Telegram = {
      WebApp: bridge({ version: "6.9", disableVerticalSwipes }),
    };
    prepareMiniApp();
    expect(disableVerticalSwipes).not.toHaveBeenCalled();
  });

  it("применяет палитру Telegram и обновляет её при смене темы", () => {
    let themeChanged: (() => void) | undefined;
    const offEvent = vi.fn();
    const app = bridge({
      themeParams: {
        bg_color: "#101010",
        text_color: "#f5f5f5",
        hint_color: "#f5f5f5",
        destructive_text_color: "#ffdddd",
        button_color: "#ffffff",
      },
      setHeaderColor: vi.fn(),
      setBackgroundColor: vi.fn(),
      onEvent: vi.fn((_event: string, handler: () => void) => {
        themeChanged = handler;
      }),
      offEvent,
    });
    (window as { Telegram?: unknown }).Telegram = { WebApp: app };

    const cleanup = prepareMiniApp();
    const root = document.documentElement;
    expect(root.dataset.telegramTheme).toBe("dark");
    expect(root.style.getPropertyValue("--tg-theme-bg-color")).toBe("#101010");
    expect(root.style.getPropertyValue("--tg-theme-button-color")).toBe("#ffffff");
    expect(root.style.getPropertyValue("--tg-theme-button-text-color")).toBe("#081520");
    expect(root.style.getPropertyValue("--color-neutral-foreground")).toBe("#081520");
    expect(root.style.getPropertyValue("--color-danger-foreground")).toBe("#081520");

    app.themeParams.bg_color = "#202020";
    themeChanged?.();
    expect(root.style.getPropertyValue("--tg-theme-bg-color")).toBe("#202020");

    cleanup?.();
    expect(offEvent).toHaveBeenCalledWith("themeChanged", themeChanged);
  });

  it("заменяет нечитаемый цвет надписи на кнопке", () => {
    const app = bridge({
      themeParams: {
        bg_color: "#212121",
        text_color: "#ffffff",
        // Сочетание самого Telegram: белым по сиреневому это 3.7:1.
        button_color: "#8774e1",
        button_text_color: "#ffffff",
      },
    });
    (window as { Telegram?: unknown }).Telegram = { WebApp: app };

    prepareMiniApp();
    expect(
      document.documentElement.style.getPropertyValue("--tg-theme-button-text-color"),
    ).toBe("#081520");
  });

  it("оставляет читаемый цвет надписи как есть", () => {
    const app = bridge({
      themeParams: {
        bg_color: "#ffffff",
        text_color: "#081520",
        button_color: "#1d4ed8",
        button_text_color: "#ffffff",
      },
    });
    (window as { Telegram?: unknown }).Telegram = { WebApp: app };

    prepareMiniApp();
    expect(
      document.documentElement.style.getPropertyValue("--tg-theme-button-text-color"),
    ).toBe("#ffffff");
  });
});
