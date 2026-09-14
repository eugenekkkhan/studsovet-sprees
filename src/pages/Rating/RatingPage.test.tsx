import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReliabilityProfile } from "../../api/eventsApi";

const profiles: ReliabilityProfile[] = [
  { userId: 1, name: "Аня Смирнова", username: "anya", reliability: 90, recoveryProgress: 3, faculty: "cs", rating: 100, activity: { messages: 10, reactionsGiven: 4, reactionsReceived: 7, currentStreak: 9 } },
  { userId: 2, name: "Борис Петров", username: "boris", reliability: 40, recoveryProgress: 1, faculty: "math", rating: 20, activity: { messages: 3, reactionsGiven: 1, reactionsReceived: 2, currentStreak: 0 } },
];

vi.mock("../../api/eventsApi", () => ({ fetchReliability: () => Promise.resolve({ profiles }) }));

const RatingPage = (await import("./RatingPage")).default;

const open = () => render(<MemoryRouter><RatingPage /></MemoryRouter>);

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/rating");
});

describe("страница рейтинга", () => {
  it("рисует таблицу и раздаёт места по всему рейтингу", async () => {
    open();

    expect(await screen.findByRole("table", { name: "Рейтинг участников" })).toBeInTheDocument();
    expect(screen.getByText("Аня Смирнова")).toBeInTheDocument();
    expect(screen.getByText("Найдено 2 из 2")).toBeInTheDocument();
  });

  it("сортирует по колонке, которой раньше сортировки не было", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: /Реакции поставил/ }));

    await waitFor(() => expect(screen.getByRole("columnheader", { name: /Реакции поставил/ })).toHaveAttribute("aria-sort", "ascending"));
  });

  it("отбирает диапазоном и показывает чип активного фильтра", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("table");

    await user.type(screen.getByLabelText("Рейтинг: от"), "50");

    await waitFor(() => expect(screen.getByText("Найдено 1 из 2")).toBeInTheDocument());
    expect(screen.getByText("Рейтинг: от 50")).toBeInTheDocument();
    expect(screen.queryByText("Борис Петров")).not.toBeInTheDocument();
  });

  it("ищет без оглядки на ё, собаку и порядок слов", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("table");

    await user.type(screen.getByLabelText("Поиск по имени или Telegram"), "петров борис");

    await waitFor(() => expect(screen.getByText("Найдено 1 из 2")).toBeInTheDocument());
  });
});
