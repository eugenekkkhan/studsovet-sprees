import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SortRow } from "./SortRow";
import type { DataTableColumn } from "./DataTable";
import type { SortCriterion } from "./sorting";

interface Row { name: string; score: number }

const columns: DataTableColumn<Row>[] = [
  { key: "name", label: "Имя", render: (row) => row.name, sortAccessor: (row) => row.name },
  { key: "score", label: "Баллы", render: (row) => row.score, sortAccessor: (row) => row.score },
];

const sort: SortCriterion[] = [
  { key: "score", direction: "desc" },
  { key: "name", direction: "asc" },
];

describe("очередь сортировки", () => {
  it("даёт каждому критерию ручку перетаскивания", () => {
    render(<SortRow columns={columns} sort={sort} onSort={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Перетащить критерий «Баллы»" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Перетащить критерий «Имя»" })).toBeInTheDocument();
  });

  /** Порядок задаётся только перетаскиванием — кнопок-дублёров быть не должно. */
  it("не держит кнопок перемещения рядом с ручкой", () => {
    render(<SortRow columns={columns} sort={sort} onSort={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /в очереди$/ })).toBeNull();
  });

  it("оставляет переключение направления и снятие критерия", async () => {
    const onSort = vi.fn();
    render(<SortRow columns={columns} sort={sort} onSort={onSort} />);

    await userEvent.click(screen.getByRole("button", { name: "Убрать сортировку «Баллы»" }));

    expect(onSort).toHaveBeenCalledWith([{ key: "name", direction: "asc" }]);
  });
});
