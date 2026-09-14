import { describe, expect, it } from "vitest";
import { activeFilters, applyFilters, describeFilter, matchesSearch, normalize } from "./filtering";
import type { DataTableColumn } from "./DataTable";

interface Row { name: string; faculty: string | null; score: number | null; born: string | null; member: boolean }

const row = (name: string, faculty: string | null, score: number | null, born: string | null, member = true): Row =>
  ({ name, faculty, score, born, member });

const columns: DataTableColumn<Row>[] = [
  { key: "name", label: "Имя", render: (r) => r.name, searchAccessor: (r) => r.name },
  { key: "faculty", label: "Факультет", render: (r) => r.faculty, filter: { kind: "multiselect", get: (r) => r.faculty ? [r.faculty] : [], options: [{ value: "cs", label: "ФКН" }, { value: "math", label: "Матфак" }] } },
  { key: "score", label: "Баллы", render: (r) => r.score, filter: { kind: "range", get: (r) => r.score } },
  { key: "born", label: "Рождение", render: (r) => r.born, filter: { kind: "dateRange", get: (r) => r.born } },
  { key: "member", label: "Чат", render: (r) => r.member, filter: { kind: "boolean", get: (r) => r.member, yes: "Состоит", no: "Не состоит" } },
];

const rows = [
  row("Аня", "cs", 10, "2004-03-01"),
  row("Борис", "math", 50, "2001-09-15"),
  row("Вера", null, null, null, false),
];

const names = (result: Row[]) => result.map((item) => item.name);

describe("отбор по описаниям колонок", () => {
  it("внутри поля складывает по «или», между полями — по «и»", () => {
    expect(names(applyFilters(rows, columns, {
      faculty: { kind: "multiselect", values: ["cs", "math"] },
    }))).toEqual(["Аня", "Борис"]);

    expect(names(applyFilters(rows, columns, {
      faculty: { kind: "multiselect", values: ["cs", "math"] },
      score: { kind: "range", min: 20, max: null },
    }))).toEqual(["Борис"]);
  });

  it("отсекает строки без значения там, где фильтр задан", () => {
    expect(names(applyFilters(rows, columns, { score: { kind: "range", min: null, max: 100 } })))
      .toEqual(["Аня", "Борис"]);
  });

  it("берёт диапазон дат включительно с обоих краёв", () => {
    expect(names(applyFilters(rows, columns, { born: { kind: "dateRange", from: "2004-03-01", to: "2004-03-01" } })))
      .toEqual(["Аня"]);
  });

  it("различает «да» и «нет» у логического фильтра", () => {
    expect(names(applyFilters(rows, columns, { member: { kind: "boolean", value: "no" } }))).toEqual(["Вера"]);
  });

  it("пустой фильтр не считается активным и ничего не отсекает", () => {
    const values = { faculty: { kind: "multiselect" as const, values: [] }, score: { kind: "range" as const, min: null, max: null } };

    expect(activeFilters(values)).toBe(0);
    expect(names(applyFilters(rows, columns, values))).toEqual(["Аня", "Борис", "Вера"]);
  });

  it("подписывает активный фильтр по-человечески", () => {
    expect(describeFilter(columns[1].filter!, { kind: "multiselect", values: ["cs"] })).toBe("ФКН");
    expect(describeFilter(columns[2].filter!, { kind: "range", min: 10, max: null })).toBe("от 10");
    expect(describeFilter(columns[4].filter!, { kind: "boolean", value: "no" })).toBe("Не состоит");
  });
});

describe("поиск", () => {
  it("не различает ё и е и не спотыкается о собаку", () => {
    expect(normalize("@Алёша")).toBe("алеша");
  });

  it("находит слова в любом порядке", () => {
    const people = [row("Петров Иван", null, null, null)];

    expect(matchesSearch(people[0], columns, "иван петров")).toBe(true);
    expect(matchesSearch(people[0], columns, "иван сидоров")).toBe(false);
  });

  it("пустой запрос пропускает всё", () => {
    expect(matchesSearch(rows[0], columns, "   ")).toBe(true);
  });
});
