/**
 * Ссылка `t.me/бот/приложение?startapp=…` открывает мини-приложение сразу на
 * нужном экране. Формат живёт в одном месте — и разбор входящих ссылок, и
 * сборка исходящих в `inviteLinks.ts` смотрят сюда.
 *
 * Своя игра: `quiz_КОД`, `quiz_КОД_КЛЮЧ`, `board_КОД`, `host_КОД_КЛЮЧ`.
 * Поле чудес: `field_КОД`, `field_КОД_КЛЮЧ`, `fboard_КОД`, `fhost_КОД_КЛЮЧ`.
 */
const CODE = /^[A-Z0-9]{0,12}$/;
/** Ключи команды и второго пульта — тот же алфавит, только длиннее. */
const KEY = /^[A-Z0-9]{1,16}$/;

export const routeForStartParam = (param: string): string | null => {
  const [screen, code, key] = param.trim().split("_");
  const room = (code ?? "").toUpperCase();
  const secret = (key ?? "").toUpperCase();
  if (!CODE.test(room)) return null;
  if (key !== undefined && !KEY.test(secret)) return null;

  const withKey = (path: string) =>
    secret ? `${path}&key=${encodeURIComponent(secret)}` : path;

  switch (screen) {
    case "quiz":
      return room ? withKey(`/quiz/play?room=${room}`) : "/quiz";
    case "board":
      return room ? `/quiz/board?room=${room}` : null;
    case "host":
      return room && secret
        ? `/quiz/host?room=${room}&key=${encodeURIComponent(secret)}`
        : null;
    case "field":
      return room
        ? withKey(`/field-of-miracles/play?room=${room}`)
        : "/field-of-miracles";
    case "fboard":
      return room ? `/field-of-miracles/board?room=${room}` : null;
    case "fhost":
      return room && secret
        ? `/field-of-miracles/host?room=${room}&key=${encodeURIComponent(secret)}`
        : null;
    case "roulette":
      return "/roulette";
    default:
      return null;
  }
};
