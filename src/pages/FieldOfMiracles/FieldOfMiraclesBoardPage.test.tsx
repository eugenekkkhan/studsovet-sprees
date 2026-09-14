import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicFieldGameState } from "../../types/fieldOfMiracles";

interface RoomView {
  game: PublicFieldGameState | null;
  status: string;
  error: string | null;
}

const room = vi.hoisted(() => ({ current: null as unknown as RoomView }));

vi.mock("../../hooks/useFieldRoom", () => ({
  useFieldRoom: () => room.current,
}));

const { default: FieldOfMiraclesBoardPage } = await import(
  "./FieldOfMiraclesBoardPage"
);

// «МОСКВА»: открыты только О и А, остальное зал видеть не должен.
const state = (): PublicFieldGameState =>
  ({
    teams: [
      { id: "t1", name: "Альфа", color: "#2563eb", points: 700, roundPoints: 200 },
      { id: "t2", name: "Бета", color: "#dc2626", points: 300, roundPoints: 0 },
    ],
    activeTeamId: "t1",
    phase: "awaiting-letter",
    round: 2,
    puzzle: {
      category: "Города",
      clue: "Столица России",
      maskedAnswer: [null, "О", null, null, null, "А"],
      guessedLetters: ["О", "А"],
    },
    currentSectorId: "sector-2",
    winnerTeamId: null,
    correctGuessStreak: 1,
    statusMessage: "Называйте букву",
    statusTone: "info",
    history: [],
    spin: null,
    revision: 5,
    serverNow: Date.now(),
    connectedTeamIds: ["t1"],
  }) as PublicFieldGameState;

const renderBoard = () =>
  render(
    <MemoryRouter initialEntries={["/field-of-miracles/board?room=ABCDEF"]}>
      <FieldOfMiraclesBoardPage />
    </MemoryRouter>,
  );

describe("табло «Поля чудес» для зала", () => {
  beforeEach(() => {
    room.current = { game: state(), status: "connected", error: null };
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it("не показывает загаданное слово целиком", () => {
    renderBoard();
    // Ответ сервер и не присылает — в публичном состоянии его нет вовсе.
    expect(screen.queryByText("МОСКВА")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/Закрытая позиция/)).toHaveLength(4);
    expect(screen.getByLabelText("Открытая буква О")).toBeInTheDocument();
    expect(screen.getByLabelText("Открытая буква А")).toBeInTheDocument();
  });

  it("показывает тему, подсказку и статус", () => {
    renderBoard();
    expect(screen.getByText("Города")).toBeInTheDocument();
    expect(screen.getByText("Столица России")).toBeInTheDocument();
    expect(screen.getByText("Называйте букву")).toBeInTheDocument();
    expect(screen.getByText("Раунд 2")).toBeInTheDocument();
  });

  it("показывает счёт и чей сейчас ход", () => {
    renderBoard();
    expect(screen.getByText("700")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByText("ход")).toBeInTheDocument();
    expect(screen.getByText("+200 в раунде")).toBeInTheDocument();
  });

  it("до начала раунда сообщает, что ведущий готовится", () => {
    room.current = {
      game: { ...state(), puzzle: null, round: 0 },
      status: "connected",
      error: null,
    };
    renderBoard();
    expect(screen.getByText("Ведущий готовит раунд.")).toBeInTheDocument();
  });

  it("без комнаты спрашивает код, а не падает", () => {
    room.current = { game: null, status: "connected", error: null };
    render(
      <MemoryRouter initialEntries={["/field-of-miracles/board"]}>
        <FieldOfMiraclesBoardPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Табло «Поля чудес»")).toBeInTheDocument();
  });
});
