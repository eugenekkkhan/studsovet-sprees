import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataTable, type DataTableColumn } from "./DataTable";

/**
 * Два поведения, которые таблица теряла молча: страница, оставшаяся от
 * прошлого фильтра, и разбор сохранённых настроек на каждый рендер. Оба
 * невидимы глазом, поэтому и держатся тестом.
 */

interface Row {
  id: number;
  name: string;
}

const columns: DataTableColumn<Row>[] = [
  { key: "name", label: "Имя", render: (row) => row.name },
];

// 30 строк при странице в 25 дают ровно две страницы — и вторую, с которой
// таблица обязана уйти, когда набор сменился.
const rowsOf = (prefix: string) =>
  Array.from({ length: 30 }, (_, index) => ({ id: index, name: `${prefix} ${index}` }));

const table = (rows: Row[], props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) => (
  <DataTable
    name="test" label="Тестовая таблица"
    rows={rows}
    columns={columns}
    rowKey={(row) => row.id}
    sort={[]}
    onSort={() => {}}
    {...props}
  />
);

/** Активная страница помечена aria-current, а не подписью в подвале. */
const currentPage = () =>
  screen.getByRole("button", { current: "page" }).textContent;

const goNext = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Следующая страница" }));

beforeEach(() => localStorage.clear());

describe("страницы таблицы", () => {
  it("возвращает на первую, когда набор строк сменился, не изменив длины", async () => {
    const user = userEvent.setup();
    const { rerender } = render(table(rowsOf("старый")));

    await goNext(user);
    expect(currentPage()).toBe("2");

    rerender(table(rowsOf("новый")));

    expect(currentPage()).toBe("1");
    expect(screen.getByText("новый 0")).toBeInTheDocument();
  });

  it("держит страницу, пока набор строк тот же", async () => {
    const user = userEvent.setup();
    const rows = rowsOf("тот же");
    const { rerender } = render(table(rows));

    await goNext(user);
    rerender(table(rows));

    expect(currentPage()).toBe("2");
  });
});

describe("сохранённые настройки колонок", () => {
  it("читаются один раз при монтировании, а не на каждый рендер", () => {
    localStorage.setItem("sprees:table:test", JSON.stringify({ version: 1, pageSize: 50 }));
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const reads = () =>
      getItem.mock.calls.filter(([key]) => key === "sprees:table:test").length;

    const { rerender } = render(table(rowsOf("строка")));
    expect(reads()).toBe(1);

    rerender(table(rowsOf("строка")));
    rerender(table(rowsOf("строка")));

    expect(reads()).toBe(1);
    getItem.mockRestore();
  });
});

describe("меню колонок", () => {
  it("закрывается по Escape", async () => {
    const user = userEvent.setup();
    render(table(rowsOf("строка")));

    await user.click(screen.getByRole("button", { name: /Колонки/ }));
    expect(await screen.findByText("Показ и порядок колонок")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByText("Показ и порядок колонок")).not.toBeInTheDocument();
  });

  it("снимает сортировку с колонки, которую скрыли", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(table(rowsOf("строка"), { sort: [{ key: "name", direction: "asc" }], onSort }));

    await user.click(screen.getByRole("button", { name: /Колонки/ }));
    await user.click(await screen.findByRole("checkbox", { name: "Имя" }));

    expect(onSort).toHaveBeenCalledWith([]);
  });
});

describe("оформление таблицы", () => {
  it("представляется скринридеру по имени", () => {
    render(table(rowsOf("строка")));

    expect(screen.getByRole("table", { name: "Тестовая таблица" })).toBeInTheDocument();
  });

  it("запоминает выбранную плотность", async () => {
    const user = userEvent.setup();
    const { unmount } = render(table(rowsOf("строка")));

    await user.selectOptions(screen.getByLabelText("Плотность строк"), "compact");
    unmount();
    render(table(rowsOf("строка")));

    expect(screen.getByLabelText("Плотность строк")).toHaveValue("compact");
  });

  it("закрепляет первую колонку, пока пользователь не решил иначе", () => {
    render(table(rowsOf("строка")));

    expect(screen.getAllByRole("columnheader")[0]).toHaveStyle({ position: "sticky" });
  });
});
