import { publicUrl } from "../api/backendUrl";

/**
 * Приглашения внутрь Telegram. Раньше QR вёл на обычный веб-адрес, и капитан,
 * сканируя его прямо в Telegram, вываливался в браузер — без вибрации, без
 * входа по подписи и с чужой сессией. Формат `startapp` разбирается в
 * `startParam.ts`; здесь он собирается.
 */
export interface MiniAppTarget {
  /** `https://t.me/бот/приложение` из настроек сервера. */
  miniAppUrl?: string;
  /** Запасной вариант, когда мини-приложение через BotFather не заведено. */
  botUsername?: string;
}

/** `https://t.me/бот/приложение` → адрес, куда можно дописать `?startapp=`. */
const miniAppBase = ({ miniAppUrl, botUsername }: MiniAppTarget) => {
  const direct = (miniAppUrl ?? "").trim().replace(/\/$/, "");
  if (/^https:\/\/t\.me\/[^/]+\/[^/]+$/i.test(direct)) return direct;
  const username = (botUsername ?? "").trim().replace(/^@/, "");
  // Без короткого имени приложения ссылка открывает бота, а не экран игры.
  return username ? `https://t.me/${username}` : "";
};

/**
 * Ссылка в мини-приложение или, если оно не настроено, обычный веб-адрес.
 * Параметр не экранируем: и код комнаты, и ключи собраны из букв и цифр,
 * которые `startapp` принимает как есть.
 */
export const inviteLink = (
  target: MiniAppTarget,
  startParam: string,
  webFallback: string,
) => {
  const base = miniAppBase(target);
  return base ? `${base}?startapp=${startParam}` : webFallback;
};

/** Веб-адрес того же экрана: проектор на ноутбуке открывают не через Telegram. */
export const webLink = (path: string) => `${publicUrl}${path}`;

export const startParams = {
  quizPlayer: (room: string, teamKey?: string) =>
    teamKey ? `quiz_${room}_${teamKey}` : `quiz_${room}`,
  quizBoard: (room: string) => `board_${room}`,
  quizHost: (room: string, key: string) => `host_${room}_${key}`,
  fieldPlayer: (room: string, teamKey?: string) =>
    teamKey ? `field_${room}_${teamKey}` : `field_${room}`,
  fieldBoard: (room: string) => `fboard_${room}`,
  fieldHost: (room: string, key: string) => `fhost_${room}_${key}`,
};
