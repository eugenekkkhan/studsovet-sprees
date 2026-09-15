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

  /**
   * Перетаскивание — не единственный путь: стрелки нужны с клавиатуры и на
   * узком экране, поэтому они обязаны пережить появление ручки.
   */
  it("оставляет стрелки рабочими", async () => {
    const onSort = vi.fn();
    render(<SortRow columns={columns} sort={sort} onSort={onSort} />);

    await userEvent.click(screen.getByRole("button", { name: "«Имя»: раньше в очереди" }));

    expect(onSort).toHaveBeenCalledWith([
      { key: "name", direction: "asc" },
      { key: "score", direction: "desc" },
    ]);
  });

  it("не предлагает двигать крайние критерии за край", () => {
    render(<SortRow columns={columns} sort={sort} onSort={vi.fn()} />);

    expect(screen.getByRole("button", { name: "«Баллы»: раньше в очереди" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "«Имя»: позже в очереди" })).toBeDisabled();
  });
});
