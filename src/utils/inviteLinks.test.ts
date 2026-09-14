import { describe, expect, it } from "vitest";
import { inviteLink, startParams } from "./inviteLinks";
import { routeForStartParam } from "./startParam";

const WEB = "https://spree.example/field-of-miracles/play?room=ABCDEF";

describe("ссылки-приглашения в мини-приложение", () => {
  it("собирает ссылку из адреса мини-приложения", () => {
    expect(
      inviteLink(
        { miniAppUrl: "https://t.me/ammbot/games" },
        startParams.fieldPlayer("ABCDEF", "KEY1234567"),
        WEB,
      ),
    ).toBe("https://t.me/ammbot/games?startapp=field_ABCDEF_KEY1234567");
  });

  it("без короткого имени приложения откатывается на бота", () => {
    expect(
      inviteLink({ botUsername: "@ammbot" }, startParams.fieldBoard("ABCDEF"), WEB),
    ).toBe("https://t.me/ammbot?startapp=fboard_ABCDEF");
  });

  it("без настроек Telegram отдаёт обычный веб-адрес", () => {
    expect(inviteLink({}, startParams.fieldPlayer("ABCDEF"), WEB)).toBe(WEB);
    // Мусор вместо адреса тоже не должен подсовывать битую ссылку.
    expect(
      inviteLink({ miniAppUrl: "https://example.com/app" }, "field_ABCDEF", WEB),
    ).toBe(WEB);
  });

  it("собранный параметр разбирается обратно в тот же экран", () => {
    const cases: [string, string][] = [
      [startParams.fieldPlayer("ABCDEF", "KEY1234567"), "/field-of-miracles/play?room=ABCDEF&key=KEY1234567"],
      [startParams.fieldBoard("ABCDEF"), "/field-of-miracles/board?room=ABCDEF"],
      [startParams.fieldHost("ABCDEF", "HOSTKEY12345"), "/field-of-miracles/host?room=ABCDEF&key=HOSTKEY12345"],
      [startParams.quizPlayer("ABCDEF", "KEY1234567"), "/quiz/play?room=ABCDEF&key=KEY1234567"],
      [startParams.quizBoard("ABCDEF"), "/quiz/board?room=ABCDEF"],
      [startParams.quizHost("ABCDEF", "HOSTKEY12345"), "/quiz/host?room=ABCDEF&key=HOSTKEY12345"],
    ];
    for (const [param, route] of cases) {
      expect(routeForStartParam(param)).toBe(route);
    }
  });

  it("параметр укладывается в разрешённые Telegram символы", () => {
    const param = startParams.fieldPlayer("ABCDEF", "KEY1234567");
    expect(param).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });
});
