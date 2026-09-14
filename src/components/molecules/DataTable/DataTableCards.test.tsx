import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataTable, type DataTableColumn } from "./DataTable";

/**
 * Узкий экран таблицу не рисует: в мини-приложении Telegram она означала бы
 * горизонтальную прокрутку внутри вертикальной.
 */

interface Row { id: number; name: string; score: number; note: string; extra: string }

const columns: DataTableColumn<Row>[] = [
  { key: "name", label: "Имя", render: (row) => row.name },
  { key: "score", label: "Баллы", render: (row) => row.score },
  { key: "note", label: "Заметка", render: (row) => row.note },
  { key: "extra", label: "Прочее", render: (row) => row.extra },
];

const rows: Row[] = [{ id: 1, name: "Аня", score: 9, note: "сводка", extra: "подробность" }];

const narrowScreen = (narrow: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: narrow, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

const table = () => (
  <DataTable name="cards" label="Тестовая таблица" rows={rows} columns={columns} rowKey={(row) => row.id} sort={[]} onSort={() => {}} />
);

beforeEach(() => localStorage.clear());
afterEach(() => { Reflect.deleteProperty(window, "matchMedia"); });

describe("узкий экран", () => {
  it("вместо таблицы показывает карточки", () => {
    narrowScreen(true);
    render(table());

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("listitem")).toBeInTheDocument();
  });

  it("выводит роли из порядка колонок: первая — заголовок, следующие — сводка, прочие под раскрытием", async () => {
    const user = userEvent.setup();
    narrowScreen(true);
    render(table());

    expect(screen.getByText("Аня")).toBeInTheDocument();
    expect(screen.getByText("сводка")).toBeInTheDocument();
    expect(screen.queryByText("подробность")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Ещё 1/ }));

    expect(screen.getByText("подробность")).toBeInTheDocument();
  });

  it("не прячет закрепление колонок, пока экран широкий", () => {
    narrowScreen(false);
    render(table());

    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
