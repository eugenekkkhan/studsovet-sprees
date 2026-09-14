import type { DataTableColumn } from "./DataTable";

export interface SortCriterion {
  key: string;
  direction: "asc" | "desc";
}

export type SortValue = string | number | null | undefined;

// Один коллатор на все сравнения: localeCompare на каждую пару строк заметно
// дороже, а сортируем мы сотнями строк по несколько критериев сразу.
const collator = new Intl.Collator("ru");

const isEmpty = (value: SortValue) => value === null || value === undefined || value === "";

/** Колонки, которые умеют сортироваться, — в том же порядке, что и в таблице. */
export const sortOptionsOf = <T,>(columns: DataTableColumn<T>[]) =>
  columns.filter((column) => column.sortAccessor).map(({ key, label }) => ({ key, label }));

/**
 * Сортировка по описаниям самих колонок: список критериев применяется по
 * очереди, а `tiebreak` разводит строки, которые все критерии сочли равными.
 *
 * Пустое значение всегда уходит вниз, в какую бы сторону ни сортировали:
 * «нет данных» — не результат, и всплывать наверх при развороте порядка оно
 * не должно.
 */
export const sortRows = <T,>(
  rows: T[],
  columns: DataTableColumn<T>[],
  sort: SortCriterion[],
  tiebreak?: (row: T) => SortValue,
) => {
  const accessorOf = (key: string) => columns.find((column) => column.key === key)?.sortAccessor;
  const criteria = sort
    .map((criterion) => ({ get: accessorOf(criterion.key), direction: criterion.direction }))
    .filter((criterion): criterion is { get: (row: T) => SortValue; direction: "asc" | "desc" } =>
      Boolean(criterion.get));

  if (criteria.length === 0 && !tiebreak) return rows;

  const compare = (left: SortValue, right: SortValue) =>
    typeof left === "number" && typeof right === "number"
      ? left - right
      : collator.compare(String(left), String(right));

  return [...rows].sort((left, right) => {
    for (const { get, direction } of criteria) {
      const [first, second] = [get(left), get(right)];
      if (isEmpty(first) || isEmpty(second)) {
        if (isEmpty(first) && isEmpty(second)) continue;
        return isEmpty(first) ? 1 : -1;
      }
      const compared = compare(first, second);
      if (compared) return direction === "asc" ? compared : -compared;
    }
    return tiebreak ? compare(tiebreak(left), tiebreak(right)) : 0;
  });
};
