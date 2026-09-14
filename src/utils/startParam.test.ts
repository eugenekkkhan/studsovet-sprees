import { describe, expect, it } from "vitest";
import { routeForStartParam } from "./startParam";

describe("routeForStartParam", () => {
  it("открывает стол капитана и проектор по коду комнаты", () => {
    expect(routeForStartParam("quiz_abcd")).toBe("/quiz/play?room=ABCD");
    expect(routeForStartParam("board_ABCD")).toBe("/quiz/board?room=ABCD");
  });

  it("открывает пульт ведущего только вместе с ключом", () => {
    expect(routeForStartParam("host_ABCD_KEY7")).toBe(
      "/quiz/host?room=ABCD&key=KEY7",
    );
    expect(routeForStartParam("host_ABCD")).toBeNull();
  });

  it("ведёт на разделы без комнаты", () => {
    expect(routeForStartParam("quiz")).toBe("/quiz");
    expect(routeForStartParam("roulette")).toBe("/roulette");
    expect(routeForStartParam("field")).toBe("/field-of-miracles");
  });

  it("не пускает посторонние значения", () => {
    expect(routeForStartParam("")).toBeNull();
    expect(routeForStartParam("quiz_../../etc")).toBeNull();
    expect(routeForStartParam("что-то")).toBeNull();
  });
});
