import { rawInk } from "../styles/tokens";
import {
  contrastRatio,
  readableInk,
  relativeLuminance,
  resetSurfaceBackdrop,
} from "../utils/color";

/** Минимум из Telegram WebApp, которым пользуется приложение. */
interface TelegramThemeParams {
  bg_color?: string;
  secondary_bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  section_separator_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
  bottom_bar_bg_color?: string;
}

interface TelegramBackButton {
  show: () => void;
  hide: () => void;
  onClick: (handler: () => void) => void;
  offClick: (handler: () => void) => void;
}

interface TelegramHaptics {
  impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  notificationOccurred: (type: "error" | "success" | "warning") => void;
  selectionChanged: () => void;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { start_param?: string; user?: { id: number; first_name?: string } };
  version: string;
  colorScheme: "light" | "dark";
  themeParams: TelegramThemeParams;
  isExpanded: boolean;
  BackButton: TelegramBackButton;
  HapticFeedback?: TelegramHaptics;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  ready: () => void;
  expand: () => void;
  close: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  onEvent?: (event: "themeChanged", handler: () => void) => void;
  offEvent?: (event: "themeChanged", handler: () => void) => void;
  openTelegramLink?: (url: string) => void;
  showAlert?: (message: string) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** Возвращает мост Telegram или null, если страницу открыли в обычном браузере. */
export const telegramWebApp = (): TelegramWebApp | null => {
  const app = window.Telegram?.WebApp;
  // В браузере скрипт Telegram тоже подгружается, но initData там пустой.
  return app && typeof app.initData === "string" ? app : null;
};

export const insideTelegram = () => Boolean(telegramWebApp()?.initData);

/**
 * Параметр из ссылки `t.me/бот/приложение?startapp=…`. Им открываем нужный
 * экран сразу: `quiz_ABCD` — комната, `roulette` — колесо.
 */
export const telegramStartParam = () =>
  telegramWebApp()?.initDataUnsafe?.start_param?.trim() ?? "";

/** Разворачивает окно и подставляет цвета клиента — иначе экран выглядит чужим. */
const applyTelegramTheme = (app: TelegramWebApp) => {
  const root = document.documentElement;
  // Цвет подложки меняется вместе с темой: пересчитаем его при следующем чтении.
  resetSurfaceBackdrop();
  root.dataset.telegram = "true";
  root.dataset.telegramTheme = app.colorScheme;

  // Telegram обычно создаёт эти переменные сам. Записываем их также здесь:
  // это устраняет вспышку старой темы и работает в клиентах со старым мостом.
  Object.entries(app.themeParams ?? {}).forEach(([name, value]) => {
    if (value) root.style.setProperty(`--tg-theme-${name.replace(/_/g, "-")}`, value);
  });

  // Некоторые клиенты и кастомные темы не присылают button_text_color, а
  // некоторые присылают такой, что надпись на кнопке не читается. И в том, и
  // в другом случае берём чёрный или белый — тот, что контрастнее.
  const button = app.themeParams?.button_color;
  const buttonText = app.themeParams?.button_text_color;
  const legible =
    button && buttonText
      ? contrastRatio(relativeLuminance(button), relativeLuminance(buttonText)) >= 4.5
      : false;
  if (button && !legible) {
    root.style.setProperty(
      "--tg-theme-button-text-color",
      readableInk(button) === "dark" ? rawInk.dark : rawInk.light,
    );
  }

  // Цвета destructive/hint у кастомных тем также не гарантируют белую
  // надпись. Компоненты используют эти семантические пары вместо text-white.
  const setReadableForeground = (property: string, background?: string) => {
    if (!background) return;
    root.style.setProperty(
      property,
      readableInk(background) === "dark" ? rawInk.dark : rawInk.light,
    );
  };
  setReadableForeground(
    "--color-danger-foreground",
    app.themeParams?.destructive_text_color,
  );
  setReadableForeground(
    "--color-neutral-foreground",
    app.themeParams?.hint_color ?? app.themeParams?.subtitle_text_color,
  );

  const background = app.themeParams?.bg_color;
  const header = app.themeParams?.header_bg_color ?? background;
  const bottomBar = app.themeParams?.bottom_bar_bg_color ?? background;
  if (header) app.setHeaderColor?.(header);
  if (background) app.setBackgroundColor?.(background);
  if (bottomBar) app.setBottomBarColor?.(bottomBar);
};

export const prepareMiniApp = () => {
  const app = telegramWebApp();
  // В обычном браузере мост тоже есть, но пустой: трогать его незачем.
  if (!app?.initData) return undefined;

  app.ready();
  app.expand();
  // Свайп вниз закрывает мини-приложение прямо посреди игры — выключаем.
  // Старые клиенты такого не умеют и в ответ пишут предупреждение в консоль.
  if (parseFloat(app.version) >= 7.7) app.disableVerticalSwipes?.();

  applyTelegramTheme(app);

  const handleThemeChanged = () => applyTelegramTheme(app);
  app.onEvent?.("themeChanged", handleThemeChanged);
  return () => app.offEvent?.("themeChanged", handleThemeChanged);
};

/**
 * Тактильный отклик. Для игры на кнопку это главная опора: палец узнаёт, что
 * нажатие засчитано, раньше, чем глаз находит подтверждение на экране.
 * Вне Telegram всё тихо: моста там нет, и вызовы просто не происходят.
 */
export const haptic = {
  press: () => telegramWebApp()?.HapticFeedback?.impactOccurred("heavy"),
  tap: () => telegramWebApp()?.HapticFeedback?.selectionChanged(),
  success: () => telegramWebApp()?.HapticFeedback?.notificationOccurred("success"),
  failure: () => telegramWebApp()?.HapticFeedback?.notificationOccurred("error"),
  warning: () => telegramWebApp()?.HapticFeedback?.notificationOccurred("warning"),
};

export type HapticKind = keyof typeof haptic;

/**
 * Обработчик клика с откликом. Живёт рядом с мостом, чтобы отклик задавался
 * один раз в базовом компоненте, а не повторялся на каждом экране: иначе на
 * одну кнопку легко приходит две вибрации, а на соседнюю — ни одной.
 */
export const withHaptic =
  <E>(kind: HapticKind, handler?: (event: E) => void) =>
  (event: E) => {
    haptic[kind]();
    handler?.(event);
  };

/**
 * Спрашивать ли подтверждение при закрытии. Ведущий закрывает приложение
 * свайпом посреди игры — и возвращается уже к пустому экрану.
 */
export const setClosingConfirmation = (enabled: boolean) => {
  const app = telegramWebApp();
  if (!app?.initData) return;
  if (enabled) app.enableClosingConfirmation?.();
  else app.disableClosingConfirmation?.();
};
