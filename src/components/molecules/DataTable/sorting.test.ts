import { describe, expect, it } from "vitest";
import { sortOptionsOf, sortRows } from "./sorting";
import type { DataTableColumn } from "./DataTable";

interface Row { name: string; score?: number | null }

const columns: DataTableColumn<Row>[] = [
  { key: "name", label: "Имя", render: (row) => row.name, sortAccessor: (row) => row.name },
  { key: "score", label: "Баллы", render: (row) => row.score, sortAccessor: (row) => row.score ?? null },
  { key: "actions", label: "Действия", render: () => null },
];

const names = (rows: Row[]) => rows.map((row) => row.name);

describe("сортировка по описаниям колонок", () => {
  it("предлагает в фильтрах ровно те колонки, у которых есть sortAccessor", () => {
    expect(sortOptionsOf(columns)).toEqual([
      { key: "name", label: "Имя" },
      { key: "score", label: "Баллы" },
    ]);
  });

  it("применяет критерии по очереди", () => {
    const rows: Row[] = [
      { name: "Вера", score: 5 }, { name: "Аня", score: 9 }, { name: "Борис", score: 5 },
    ];

    expect(names(sortRows(rows, columns, [{ key: "score", direction: "desc" }, { key: "name", direction: "asc" }])))
      .toEqual(["Аня", "Борис", "Вера"]);
  });

  it("держит пустые значения внизу в обе стороны", () => {
    const rows: Row[] = [{ name: "Аня", score: null }, { name: "Борис", score: 1 }, { name: "Вера", score: 9 }];

    expect(names(sortRows(rows, columns, [{ key: "score", direction: "asc" }]))).toEqual(["Борис", "Вера", "Аня"]);
    expect(names(sortRows(rows, columns, [{ key: "score", direction: "desc" }]))).toEqual(["Вера", "Борис", "Аня"]);
  });

  it("разводит равные строки через tiebreak", () => {
    const rows: Row[] = [{ name: "Вера", score: 5 }, { name: "Аня", score: 5 }];

    expect(names(sortRows(rows, columns, [{ key: "score", direction: "asc" }], (row) => row.name)))
      .toEqual(["Аня", "Вера"]);
  });

  it("игнорирует критерий по колонке, которая сортироваться не умеет", () => {
    const rows: Row[] = [{ name: "Вера" }, { name: "Аня" }];

    expect(names(sortRows(rows, columns, [{ key: "actions", direction: "asc" }]))).toEqual(["Вера", "Аня"]);
  });

  it("сравнивает числа как числа, а не как строки", () => {
    const rows: Row[] = [{ name: "a", score: 100 }, { name: "b", score: 9 }];

    expect(names(sortRows(rows, columns, [{ key: "score", direction: "asc" }]))).toEqual(["b", "a"]);
  });

  it("не трогает исходный массив", () => {
    const rows: Row[] = [{ name: "Вера", score: 1 }, { name: "Аня", score: 2 }];
    sortRows(rows, columns, [{ key: "name", direction: "asc" }]);

    expect(names(rows)).toEqual(["Вера", "Аня"]);
  });
});
