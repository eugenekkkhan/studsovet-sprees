import { describe, expect, it } from "vitest";
import { FORTUNE_SECTORS } from "../constants/fortuneSectors";
import type { Sector, Team } from "../types/fieldOfMiracles";
import {
  createInitialGameState,
  fieldOfMiraclesReducer,
  STREAK_BONUS,
  type FieldGameAction,
} from "./fieldOfMiraclesReducer";

const teams: Team[] = [
  {
    id: "alpha",
    name: "Альфа",
    points: 0,
    roundPoints: 0,
    color: "#2563eb",
  },
  {
    id: "beta",
    name: "Бета",
    points: 0,
    roundPoints: 0,
    color: "#75b666",
  },
];

const sector = (type: Sector["type"], value?: number) => {
  const result = FORTUNE_SECTORS.find(
    (item) => item.type === type && (value === undefined || item.value === value),
  );
  if (!result) {
    throw new Error(`Missing ${type} sector`);
  }
  return result;
};

const run = (actions: FieldGameAction[], answer = "МАМА") =>
  actions.reduce(
    fieldOfMiraclesReducer,
    fieldOfMiraclesReducer(createInitialGameState(teams), {
      type: "START_ROUND",
      category: "Тест",
      clue: "Подсказка",
      answer,
    }),
  );

const spin = (target: Sector): FieldGameAction[] => [
  { type: "BEGIN_SPIN" },
  { type: "LAND_ON_SECTOR", sectorId: target.id },
];

describe("fieldOfMiraclesReducer", () => {
  it("renames a team and changes its colour without breaking the active turn", () => {
    const state = fieldOfMiraclesReducer(createInitialGameState(teams), {
      type: "UPDATE_TEAM",
      teamId: "alpha",
      name: "  Новая Альфа  ",
      color: "#ff00ff",
    });

    expect(state.teams[0]).toMatchObject({
      id: "alpha",
      name: "Новая Альфа",
      color: "#ff00ff",
    });
    expect(state.activeTeamId).toBe("alpha");
  });

  it("awards the sector value for every occurrence and keeps the turn", () => {
    const state = run([
      ...spin(sector("points", 500)),
      { type: "GUESS_LETTER", letter: "м" },
    ]);

    expect(state.teams[0]).toMatchObject({ points: 1000, roundPoints: 1000 });
    expect(state.activeTeamId).toBe("alpha");
    expect(state.phase).toBe("ready");
    expect(state.puzzle?.guessedLetters).toEqual(["М"]);
  });

  it("marks a missing letter and passes the turn", () => {
    const state = run([
      ...spin(sector("points", 500)),
      { type: "GUESS_LETTER", letter: "я" },
    ]);

    expect(state.activeTeamId).toBe("beta");
    expect(state.puzzle?.guessedLetters).toContain("Я");
    expect(state.teams[0].points).toBe(0);
  });

  it("removes only current-round points on Bankrupt", () => {
    const state = run([
      ...spin(sector("points", 500)),
      { type: "GUESS_LETTER", letter: "м" },
      ...spin(sector("bankrupt")),
    ]);

    expect(state.teams[0]).toMatchObject({ points: 0, roundPoints: 0 });
    expect(state.activeTeamId).toBe("beta");
  });

  it("multiplies the current round score on the double sector", () => {
    const state = run(
      [
        ...spin(sector("points", 500)),
        { type: "GUESS_LETTER", letter: "к" },
        ...spin(sector("double")),
        { type: "GUESS_LETTER", letter: "о" },
      ],
      "КОТ",
    );

    expect(state.teams[0]).toMatchObject({ points: 1000, roundPoints: 1000 });
    expect(state.activeTeamId).toBe("alpha");
  });

  it("finishes the round when Plus reveals the final distinct letter", () => {
    const state = run(
      [
        ...spin(sector("points", 100)),
        { type: "GUESS_LETTER", letter: "а" },
        ...spin(sector("plus")),
        { type: "CHOOSE_POSITION", index: 1 },
      ],
      "АБ",
    );

    expect(state.phase).toBe("round-complete");
    expect(state.winnerTeamId).toBe("alpha");
    expect(state.puzzle?.guessedLetters).toEqual(["А", "Б"]);
  });

  it("adds the configured bonus after three correct guesses", () => {
    const state = run(
      [
        ...spin(sector("points", 100)),
        { type: "GUESS_LETTER", letter: "а" },
        ...spin(sector("points", 100)),
        { type: "GUESS_LETTER", letter: "б" },
        ...spin(sector("points", 100)),
        { type: "GUESS_LETTER", letter: "в" },
      ],
      "АБВГ",
    );

    expect(state.teams[0].points).toBe(300 + STREAK_BONUS);
    expect(state.correctGuessStreak).toBe(0);
  });

  it("uses the friendly solve rule: a wrong word passes the turn", () => {
    const state = run([{ type: "ATTEMPT_SOLVE", answer: "ПАПА" }]);

    expect(state.phase).toBe("ready");
    expect(state.activeTeamId).toBe("beta");
  });

  it("undoes a resolved guess without losing the pending sector", () => {
    const state = run([
      ...spin(sector("points", 500)),
      { type: "GUESS_LETTER", letter: "я" },
      { type: "UNDO" },
    ]);

    expect(state.phase).toBe("awaiting-letter");
    expect(state.activeTeamId).toBe("alpha");
    expect(state.puzzle?.guessedLetters).not.toContain("Я");
    expect(state.currentSectorId).toBe(sector("points", 500).id);
  });
});
