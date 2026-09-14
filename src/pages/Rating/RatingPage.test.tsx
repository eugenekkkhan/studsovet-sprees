import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReliabilityProfile } from "../../api/eventsApi";

const { fetchReliabilityMock } = vi.hoisted(() => ({
  fetchReliabilityMock: vi.fn(),
}));

const profiles: ReliabilityProfile[] = [
  { userId: 1, name: "Аня Смирнова", username: "anya", reliability: 90, recoveryProgress: 3, faculty: "cs", rating: 100, activity: { messages: 10, reactionsGiven: 4, reactionsReceived: 7, currentStreak: 9 } },
  { userId: 2, name: "Борис Петров", username: "boris", reliability: 40, recoveryProgress: 1, faculty: "math", rating: 20, activity: { messages: 3, reactionsGiven: 1, reactionsReceived: 2, currentStreak: 0 } },
];

vi.mock("../../api/eventsApi", () => ({ fetchReliability: fetchReliabilityMock }));

const RatingPage = (await import("./RatingPage")).default;

const open = () => render(<MemoryRouter><RatingPage /></MemoryRouter>);

beforeEach(() => {
  fetchReliabilityMock.mockReset();
  fetchReliabilityMock.mockResolvedValue({ profiles });
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

  it("не выкладывает фильтры сразу: их добавляют по одному", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("table");

    expect(screen.queryByLabelText("Рейтинг: от")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Фильтр$/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Рейтинг" }));

    expect(await screen.findByLabelText("Рейтинг: от")).toBeInTheDocument();
    // Добавленный фильтр ещё пуст и потому ничего не отсекает.
    expect(screen.getByText("Найдено 2 из 2")).toBeInTheDocument();
  });

  it("отбирает диапазоном и убирается вместе со своим контролом", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: /Фильтр$/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Рейтинг" }));
    await user.type(await screen.findByLabelText("Рейтинг: от"), "50");

    await waitFor(() => expect(screen.getByText("Найдено 1 из 2")).toBeInTheDocument());
    expect(screen.queryByText("Борис Петров")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Убрать фильтр «Рейтинг»" }));

    await waitFor(() => expect(screen.getByText("Найдено 2 из 2")).toBeInTheDocument());
    expect(screen.queryByLabelText("Рейтинг: от")).not.toBeInTheDocument();
  });

  it("показывает чип активного отбора, когда панель свёрнута", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: /Фильтр$/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Рейтинг" }));
    await user.type(await screen.findByLabelText("Рейтинг: от"), "50");
    await user.click(screen.getByRole("button", { name: "Свернуть" }));

    expect(screen.getByText("Рейтинг: от 50")).toBeInTheDocument();
  });

  it("ищет без оглядки на ё, собаку и порядок слов", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("table");

    await user.type(screen.getByLabelText("Поиск по имени или Telegram"), "петров борис");

    await waitFor(() => expect(screen.getByText("Найдено 1 из 2")).toBeInTheDocument());
  });

  it("актуализирует данные при возвращении в окно", async () => {
    open();
    await screen.findByRole("table");

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(fetchReliabilityMock).toHaveBeenCalledTimes(2));
  });
});
