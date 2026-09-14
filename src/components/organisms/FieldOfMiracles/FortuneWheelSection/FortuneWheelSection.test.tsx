import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { noteServerTime, resetServerClock } from "../../../../api/serverClock";
import type { FieldGameViewState } from "../../../../types/fieldOfMiracles";

const gameContext = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("../../../../hooks/useGameContext", () => ({
  useGameContext: () => gameContext.current,
}));

const { default: FortuneWheelSection } = await import("./FortuneWheelSection");

const SERVER_NOW = 1_700_000_000_000;
const DURATION_MS = 4200;

const spinningState = (): Partial<FieldGameViewState> => ({
  phase: "spinning",
  teams: [],
  serverNow: SERVER_NOW,
  spin: {
    id: "spin-1",
    seed: "0".repeat(64),
    algorithm: "sha256-v1",
    sectorId: "sector-2",
    sectorIndex: 2,
    landingAngle: 55.27,
    startedAt: SERVER_NOW,
    durationMs: DURATION_MS,
    status: "spinning",
  },
});

/** Длительность перехода, которую колесо реально выставило вращающейся группе. */
const transitionMs = (container: HTMLElement) => {
  const group = container.querySelector("g[style*='transition']");
  const match = /transform (\d+)ms/.exec(group?.getAttribute("style") ?? "");
  return match ? Number(match[1]) : 0;
};

const renderSpinning = () => {
  gameContext.current = {
    game: spinningState(),
    activeTeam: null,
    beginSpin: vi.fn(),
  };
  return render(<FortuneWheelSection />);
};

describe("барабан считает вращение по часам сервера", () => {
  beforeEach(() => {
    resetServerClock();
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("при совпадающих часах крутится всю длительность", () => {
    vi.spyOn(Date, "now").mockReturnValue(SERVER_NOW);
    noteServerTime(SERVER_NOW);
    const { container } = renderSpinning();
    expect(transitionMs(container)).toBe(DURATION_MS);
  });

  it("часы устройства, убежавшие на минуту вперёд, не съедают вращение", () => {
    // Именно так барабан и «ломался»: остаток обнулялся, и вместо вращения
    // колесо мгновенно перескакивало на итоговый сектор.
    vi.spyOn(Date, "now").mockReturnValue(SERVER_NOW + 60_000);
    noteServerTime(SERVER_NOW);
    const { container } = renderSpinning();
    expect(transitionMs(container)).toBe(DURATION_MS);
  });

  it("отстающие часы тоже не растягивают вращение", () => {
    vi.spyOn(Date, "now").mockReturnValue(SERVER_NOW - 60_000);
    noteServerTime(SERVER_NOW);
    const { container } = renderSpinning();
    expect(transitionMs(container)).toBe(DURATION_MS);
  });
});
