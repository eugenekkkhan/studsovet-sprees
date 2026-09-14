import type { DataTableColumn } from "./DataTable";

export interface FilterOption { value: string; label: string }

/**
 * Описание фильтра живёт на колонке — как и sortAccessor. Из него выводится
 * всё остальное: контрол, предикат, счётчик активных, сброс и запись в адрес.
 * Раньше каждый фильтр приходилось заводить в четырёх местах, и рассинхрон
 * ничем не ловился.
 */
export type ColumnFilter<T> =
  | { kind: "select"; get: (row: T) => string | null; options: FilterOption[] }
  | { kind: "multiselect"; get: (row: T) => string[]; options: FilterOption[] }
  | { kind: "range"; get: (row: T) => number | null; unit?: string }
  | { kind: "dateRange"; get: (row: T) => string | null }
  | { kind: "boolean"; get: (row: T) => boolean; yes: string; no: string };

export type FilterValue =
  | { kind: "select"; value: string }
  | { kind: "multiselect"; values: string[] }
  | { kind: "range"; min: number | null; max: number | null }
  | { kind: "dateRange"; from: string | null; to: string | null }
  | { kind: "boolean"; value: "yes" | "no" };

export type FilterValues = Record<string, FilterValue>;

/** Пустой фильтр эквивалентен отсутствующему: в счёт и в адрес он не идёт. */
export const isFilterActive = (value: FilterValue | undefined): value is FilterValue => {
  if (!value) return false;
  switch (value.kind) {
    case "select": return value.value !== "";
    case "multiselect": return value.values.length > 0;
    case "range": return value.min !== null || value.max !== null;
    case "dateRange": return Boolean(value.from) || Boolean(value.to);
    case "boolean": return true;
  }
};

export const activeFilters = (values: FilterValues) =>
  Object.values(values).filter(isFilterActive).length;

const matches = <T,>(row: T, filter: ColumnFilter<T>, value: FilterValue): boolean => {
  // Внутри одного поля значения складываются по «или», между полями — по «и».
  if (filter.kind === "select" && value.kind === "select") return filter.get(row) === value.value;
  if (filter.kind === "multiselect" && value.kind === "multiselect") {
    const own = filter.get(row);
    return value.values.some((wanted) => own.includes(wanted));
  }
  if (filter.kind === "range" && value.kind === "range") {
    const own = filter.get(row);
    if (own === null) return false;
    return (value.min === null || own >= value.min) && (value.max === null || own <= value.max);
  }
  if (filter.kind === "dateRange" && value.kind === "dateRange") {
    const own = filter.get(row);
    if (!own) return false;
    return (!value.from || own >= value.from) && (!value.to || own <= value.to);
  }
  if (filter.kind === "boolean" && value.kind === "boolean") {
    return filter.get(row) === (value.value === "yes");
  }
  return true;
};

export const applyFilters = <T,>(rows: T[], columns: DataTableColumn<T>[], values: FilterValues) => {
  const active = columns
    .map((column) => ({ filter: column.filter, value: values[column.key] }))
    .filter((entry): entry is { filter: ColumnFilter<T>; value: FilterValue } =>
      Boolean(entry.filter) && isFilterActive(entry.value));

  return active.length === 0 ? rows : rows.filter((row) =>
    active.every(({ filter, value }) => matches(row, filter, value)));
};

/**
 * Поиск прощает то, что люди путают: ё и е, ведущую собаку у юзернейма и
 * порядок слов. Каждое слово запроса должно найтись хоть в одном поле строки.
 */
export const normalize = (text: string) =>
  text.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/^@+/, "").trim();

export const matchesSearch = <T,>(row: T, columns: DataTableColumn<T>[], query: string) => {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const haystack = columns
    .map((column) => column.searchAccessor?.(row))
    .filter((value): value is string => Boolean(value))
    .map((value) => normalize(value));

  return words.every((word) => haystack.some((value) => value.includes(word)));
};

/** Человекочитаемая подпись активного фильтра — для ряда чипов. */
export const describeFilter = <T,>(filter: ColumnFilter<T>, value: FilterValue): string => {
  const labelOf = (options: FilterOption[], wanted: string) =>
    options.find((option) => option.value === wanted)?.label ?? wanted;

  if (filter.kind === "select" && value.kind === "select") return labelOf(filter.options, value.value);
  if (filter.kind === "multiselect" && value.kind === "multiselect")
    return value.values.map((item) => labelOf(filter.options, item)).join(", ");
  if (filter.kind === "range" && value.kind === "range") {
    const unit = filter.unit ? ` ${filter.unit}` : "";
    if (value.min !== null && value.max !== null) return `${value.min}–${value.max}${unit}`;
    return value.min !== null ? `от ${value.min}${unit}` : `до ${value.max}${unit}`;
  }
  if (filter.kind === "dateRange" && value.kind === "dateRange") {
    const date = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("ru-RU");
    if (value.from && value.to) return `${date(value.from)}–${date(value.to)}`;
    return value.from ? `с ${date(value.from)}` : `по ${date(value.to as string)}`;
  }
  if (filter.kind === "boolean" && value.kind === "boolean")
    return value.value === "yes" ? filter.yes : filter.no;
  return "";
};
