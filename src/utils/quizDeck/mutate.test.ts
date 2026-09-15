import { describe, expect, it } from "vitest";
import { createDeck } from "./factory";
import {
  reorderById,
  reorderQuestions,
  reorderRounds,
  reorderThemes,
} from "./mutate";

const ids = <T extends { id: string }>(items: T[]) => items.map((item) => item.id);
const named = ["a", "b", "c", "d"].map((id) => ({ id }));

describe("перестановки в колоде", () => {
  it("переносит элемент на место другого", () => {
    expect(ids(reorderById(named, "a", "c"))).toEqual(["b", "c", "a", "d"]);
    expect(ids(reorderById(named, "d", "a"))).toEqual(["d", "a", "b", "c"]);
  });

  it("не трогает список, если тащить некуда", () => {
    expect(reorderById(named, "a", "a")).toBe(named);
    expect(reorderById(named, "a", "нет такого")).toBe(named);
  });

  it("переставляет раунды, темы и клетки колоды", () => {
    const deck = createDeck("Тест", { rounds: 3, themes: 3, questions: 3, finalThemes: 0 });
    const [first, second, third] = ids(deck.rounds);
    expect(ids(reorderRounds(deck, third, first).rounds)).toEqual([
      third,
      first,
      second,
    ]);

    const round = deck.rounds[0];
    const [themeA, themeB] = ids(round.themes);
    const withTheme = reorderThemes(deck, round.id, themeB, themeA);
    expect(ids(withTheme.rounds[0].themes)[0]).toBe(themeB);
    // Остальные раунды остаются нетронутыми.
    expect(withTheme.rounds[1]).toBe(deck.rounds[1]);

    const theme = round.themes[0];
    const [q1, q2, q3] = ids(theme.questions);
    expect(
      ids(reorderQuestions(deck, round.id, theme.id, q1, q3).rounds[0].themes[0].questions),
    ).toEqual([q2, q3, q1]);
  });
});
