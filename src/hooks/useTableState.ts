import { useCallback, useEffect, useMemo, useState } from "react";
import type { SortCriterion } from "../components/molecules/DataTable/sorting";
import type { FilterValues } from "../components/molecules/DataTable/filtering";

export interface TableView {
  name: string;
  search: string;
  filters: FilterValues;
  sort: SortCriterion[];
}

interface TableStateOptions {
  /** Префикс ключей в адресе и в localStorage: `rating`, `participants`. */
  name: string;
  defaultSort: SortCriterion[];
}

const parse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed === null ? fallback : (parsed as T);
  } catch { return fallback; }
};

const params = () => new URLSearchParams(window.location.search);

/**
 * Отбор, поиск и сортировка одной таблицы: живут в адресе, переживают
 * перезагрузку через localStorage и складываются в именованные наборы.
 *
 * Адрес — ведущий: ссылкой на отфильтрованный список можно поделиться, и
 * открывший её увидит ровно то же. localStorage подхватывает только то, чего
 * в адресе нет, — то есть обычный вход без ссылки.
 */
export const useTableState = ({ name, defaultSort }: TableStateOptions) => {
  const keys = useMemo(() => ({
    search: `${name}.q`,
    filters: `${name}.f`,
    sort: `${name}.sort`,
    saved: `sprees:${name}:state`,
    views: `sprees:${name}:views`,
    collapsed: `sprees:${name}:collapsed`,
  }), [name]);

  const [search, setSearch] = useState(() =>
    params().get(keys.search) ?? parse(localStorage.getItem(keys.saved), { search: "" }).search ?? "");
  const [filters, setFilters] = useState<FilterValues>(() =>
    parse(params().get(keys.filters), parse(localStorage.getItem(keys.saved), { filters: {} as FilterValues }).filters ?? {}));
  const [sort, setSort] = useState<SortCriterion[]>(() => {
    const fromUrl = parse<SortCriterion[] | null>(params().get(keys.sort), null);
    if (Array.isArray(fromUrl)) return fromUrl;
    const saved = parse(localStorage.getItem(keys.saved), { sort: null as SortCriterion[] | null }).sort;
    return Array.isArray(saved) ? saved : defaultSort;
  });
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(keys.collapsed) === "1");
  const [views, setViews] = useState<TableView[]>(() => parse(localStorage.getItem(keys.views), [] as TableView[]));

  useEffect(() => {
    localStorage.setItem(keys.saved, JSON.stringify({ search, filters, sort }));
    localStorage.setItem(keys.collapsed, collapsed ? "1" : "0");

    const next = params();
    const set = (key: string, value: string, empty: boolean) => empty ? next.delete(key) : next.set(key, value);
    set(keys.search, search, !search.trim());
    set(keys.filters, JSON.stringify(filters), Object.keys(filters).length === 0);
    set(keys.sort, JSON.stringify(sort), sort.length === 0);
    const query = next.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [collapsed, filters, keys, search, sort]);

  useEffect(() => { localStorage.setItem(keys.views, JSON.stringify(views)); }, [keys.views, views]);

  const reset = useCallback(() => {
    setSearch("");
    setFilters({});
    setSort(defaultSort);
  }, [defaultSort]);

  const saveView = useCallback((viewName: string) => setViews((current) => [
    ...current.filter((view) => view.name !== viewName),
    { name: viewName, search, filters, sort },
  ]), [filters, search, sort]);

  const applyView = useCallback((view: TableView) => {
    setSearch(view.search);
    setFilters(view.filters);
    setSort(view.sort);
  }, []);

  const removeView = useCallback((viewName: string) =>
    setViews((current) => current.filter((view) => view.name !== viewName)), []);

  return {
    search, setSearch,
    filters, setFilters,
    sort, setSort,
    collapsed, setCollapsed,
    views, saveView, applyView, removeView,
    reset,
  };
};
