import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TableFilters } from "./TableFilters";
import type { DataTableColumn } from "./DataTable";
import type { FilterValues } from "./filtering";

interface Row { name: string; faculty: string | null; score: number | null }

const columns: DataTableColumn<Row>[] = [
  { key: "name", label: "Имя", render: (row) => row.name },
  { key: "faculty", label: "Факультет", render: (row) => row.faculty, filter: { kind: "select", get: (row) => row.faculty, options: [{ value: "cs", label: "ФКН" }] } },
  { key: "score", label: "Баллы", render: (row) => row.score, filter: { kind: "range", get: (row) => row.score } },
];

// Оба фильтра со значением — значит оба открыты и попадают в сетку.
const values: FilterValues = {
  faculty: { kind: "select", value: "cs" },
  score: { kind: "range", min: 10, max: null },
};

const renderPanel = (order: string[]) => render(
  <TableFilters
    columns={columns}
    values={values}
    onChange={vi.fn()}
    search=""
    onSearch={vi.fn()}
    searchPlaceholder="Поиск"
    shown={1}
    total={2}
    collapsed={false}
    onCollapsed={vi.fn()}
    sortRow={null}
    onReset={vi.fn()}
    order={order}
    onOrder={vi.fn()}
    views={[]}
    onSaveView={vi.fn()}
    onApplyView={vi.fn()}
    onRemoveView={vi.fn()}
  />,
);

/** Подписи полей отбора в том порядке, в каком они стоят в разметке. */
const labelOrder = () => screen
  .getAllByRole("button", { name: /^Перетащить фильтр/ })
  .map((button) => button.getAttribute("aria-label"));

describe("панель отбора", () => {
  it("даёт каждому открытому полю ручку перетаскивания", () => {
    renderPanel([]);

    expect(labelOrder()).toEqual([
      "Перетащить фильтр «Факультет»",
      "Перетащить фильтр «Баллы»",
    ]);
  });

  it("раскладывает поля по сохранённому порядку, а не по порядку колонок", () => {
    renderPanel(["score", "faculty"]);

    expect(labelOrder()).toEqual([
      "Перетащить фильтр «Баллы»",
      "Перетащить фильтр «Факультет»",
    ]);
  });

  it("переживает порядок, в котором записано лишнее", () => {
    renderPanel(["выпиленная колонка", "score"]);

    expect(labelOrder()).toEqual([
      "Перетащить фильтр «Баллы»",
      "Перетащить фильтр «Факультет»",
    ]);
  });
});
