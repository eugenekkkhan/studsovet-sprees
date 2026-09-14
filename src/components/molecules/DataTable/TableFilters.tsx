import { useState, type ReactNode } from "react";
import { TbBookmark, TbFilter, TbX } from "react-icons/tb";
import { Button, Card, IconButton, Input, Select, Stack, Text } from "../../atoms";
import type { DataTableColumn } from "./DataTable";
import type { TableView } from "../../../hooks/useTableState";
import { activeFilters, describeFilter, isFilterActive, type ColumnFilter, type FilterValue, type FilterValues } from "./filtering";

interface TableFiltersProps<T> {
  columns: DataTableColumn<T>[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  shown: number;
  total: number;
  collapsed: boolean;
  onCollapsed: (value: boolean) => void;
  /** Ряд управления сортировкой — он живёт своей жизнью и приходит снаружи. */
  sortRow: ReactNode;
  onReset: () => void;
  /** Именованные наборы отбора — они же «мои фильтры». */
  views: TableView[];
  onSaveView: (name: string) => void;
  onApplyView: (view: TableView) => void;
  onRemoveView: (name: string) => void;
}

const numberOrNull = (raw: string) => raw === "" ? null : Number(raw);

function FilterControl<T>({ label, filter, value, onChange }: {
  label: string;
  filter: ColumnFilter<T>;
  value: FilterValue | undefined;
  onChange: (next: FilterValue | undefined) => void;
}) {
  if (filter.kind === "select") {
    const current = value?.kind === "select" ? value.value : "";
    return <Select value={current} aria-label={label} onChange={(event) =>
      onChange(event.target.value ? { kind: "select", value: event.target.value } : undefined)}>
      <option value="">{label}: любой</option>
      {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </Select>;
  }

  if (filter.kind === "multiselect") {
    const current = value?.kind === "multiselect" ? value.values : [];
    return <fieldset className="min-w-0 ui-surface border border-border p-xs">
      <legend className="px-2xs text-xs text-muted-foreground">{label}</legend>
      <div className="flex max-h-[120px] flex-wrap gap-x-sm gap-y-2xs overflow-y-auto scroll-panel">
        {filter.options.map((option) => <label key={option.value} className="flex items-center gap-2xs text-sm">
          <input
            type="checkbox"
            checked={current.includes(option.value)}
            onChange={(event) => {
              const next = event.target.checked
                ? [...current, option.value]
                : current.filter((item) => item !== option.value);
              onChange(next.length ? { kind: "multiselect", values: next } : undefined);
            }}
          />
          <span className="truncate">{option.label}</span>
        </label>)}
      </div>
    </fieldset>;
  }

  if (filter.kind === "range") {
    const current = value?.kind === "range" ? value : { min: null, max: null };
    const update = (min: number | null, max: number | null) =>
      onChange(min === null && max === null ? undefined : { kind: "range", min, max });
    return <Stack direction="row" gap="2xs" align="center">
      <Input type="number" inputMode="numeric" aria-label={`${label}: от`} placeholder={`${label} от`} value={current.min ?? ""} onChange={(event) => update(numberOrNull(event.target.value), current.max)} />
      <Text tone="muted">–</Text>
      <Input type="number" inputMode="numeric" aria-label={`${label}: до`} placeholder="до" value={current.max ?? ""} onChange={(event) => update(current.min, numberOrNull(event.target.value))} />
    </Stack>;
  }

  if (filter.kind === "dateRange") {
    const current = value?.kind === "dateRange" ? value : { from: null, to: null };
    const update = (from: string | null, to: string | null) =>
      onChange(!from && !to ? undefined : { kind: "dateRange", from, to });
    return <Stack direction="row" gap="2xs" align="center">
      <Input type="date" aria-label={`${label}: с`} value={current.from ?? ""} onChange={(event) => update(event.target.value || null, current.to)} />
      <Text tone="muted">–</Text>
      <Input type="date" aria-label={`${label}: по`} value={current.to ?? ""} onChange={(event) => update(current.from, event.target.value || null)} />
    </Stack>;
  }

  const current = value?.kind === "boolean" ? value.value : "";
  return <Select value={current} aria-label={label} onChange={(event) =>
    onChange(event.target.value ? { kind: "boolean", value: event.target.value as "yes" | "no" } : undefined)}>
    <option value="">{label}: неважно</option>
    <option value="yes">{filter.yes}</option>
    <option value="no">{filter.no}</option>
  </Select>;
}

/**
 * Панель отбора: поиск, контролы из описаний колонок и ряд чипов с тем, что
 * сейчас включено. Чипы нужны именно в свёрнутом виде — до них о фильтрах
 * говорило одно число, и чтобы узнать, что отсекает половину списка, панель
 * приходилось разворачивать.
 */
export function TableFilters<T>({
  columns, values, onChange, search, onSearch, searchPlaceholder,
  shown, total, collapsed, onCollapsed, sortRow, onReset,
  views, onSaveView, onApplyView, onRemoveView,
}: TableFiltersProps<T>) {
  const [viewName, setViewName] = useState("");
  const filterable = columns.filter((column) => column.filter);
  const count = activeFilters(values) + (search.trim() ? 1 : 0);
  const set = (key: string, next: FilterValue | undefined) => {
    const copy = { ...values };
    if (next) copy[key] = next; else delete copy[key];
    onChange(copy);
  };

  return (
    <Card padding="sm">
      <Stack gap="sm">
        <Stack direction="row" align="center" justify="between" gap="sm" wrap>
          <Stack direction="row" align="center" gap="xs" wrap>
            <Text weight={700}>Фильтры</Text>
            <Text size="sm" tone="muted" className="tabular-nums">Найдено {shown} из {total}</Text>
          </Stack>
          <Stack direction="row" gap="xs">
            {count > 0 && <Button size="sm" variant="ghost" onClick={onReset}>Сбросить</Button>}
            <Button size="sm" variant="neutral" onClick={() => onCollapsed(!collapsed)}>
              <TbFilter aria-hidden /> {collapsed ? "Показать" : "Свернуть"}
            </Button>
          </Stack>
        </Stack>

        {count > 0 && <Stack direction="row" gap="2xs" align="center" wrap>
          {search.trim() && <Stack direction="row" gap="2xs" align="center" className="rounded-pill bg-surface-muted px-sm py-2xs text-sm">
            <span>Поиск: {search.trim()}</span>
            <IconButton size="sm" label="Очистить поиск" onClick={() => onSearch("")}><TbX aria-hidden /></IconButton>
          </Stack>}
          {filterable.map((column) => {
            const value = values[column.key];
            if (!isFilterActive(value)) return null;
            return <Stack key={column.key} direction="row" gap="2xs" align="center" className="rounded-pill bg-surface-muted px-sm py-2xs text-sm">
              <span className="truncate">{column.label}: {describeFilter(column.filter as ColumnFilter<T>, value)}</span>
              <IconButton size="sm" label={`Убрать фильтр «${column.label}»`} onClick={() => set(column.key, undefined)}><TbX aria-hidden /></IconButton>
            </Stack>;
          })}
        </Stack>}

        {!collapsed && <>
          <Input type="search" value={search} placeholder={searchPlaceholder} aria-label={searchPlaceholder} onChange={(event) => onSearch(event.target.value)} />
          {filterable.length > 0 && <div className="grid gap-sm md:grid-cols-2">
            {filterable.map((column) => <FilterControl
              key={column.key}
              label={column.label}
              filter={column.filter as ColumnFilter<T>}
              value={values[column.key]}
              onChange={(next) => set(column.key, next)}
            />)}
          </div>}
          {sortRow}
          <Stack direction="row" gap="2xs" align="center" wrap>
            <TbBookmark className="text-muted-foreground" aria-hidden />
            <Text size="sm" tone="muted">Наборы:</Text>
            {views.length === 0 && <Text size="sm" tone="muted">пока нет</Text>}
            {views.map((view) => <Stack key={view.name} direction="row" gap="2xs" align="center">
              <Button size="sm" variant="ghost" onClick={() => onApplyView(view)}>{view.name}</Button>
              <IconButton size="sm" label={`Удалить набор «${view.name}»`} onClick={() => onRemoveView(view.name)}><TbX aria-hidden /></IconButton>
            </Stack>)}
            <Input
              className="w-auto min-w-[160px]"
              value={viewName}
              placeholder="Назвать текущий"
              aria-label="Название набора фильтров"
              onChange={(event) => setViewName(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && viewName.trim()) { onSaveView(viewName.trim()); setViewName(""); } }}
            />
            <Button size="sm" variant="neutral" disabled={!viewName.trim() || count === 0} onClick={() => { onSaveView(viewName.trim()); setViewName(""); }}>Сохранить</Button>
          </Stack>
        </>}
      </Stack>
    </Card>
  );
}
