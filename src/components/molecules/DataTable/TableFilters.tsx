import { useState, type ReactNode } from "react";
import { DropdownMenu } from "radix-ui";
import { TbBookmark, TbFilter, TbPlus, TbX } from "react-icons/tb";
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
      <option value="">любой</option>
      {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </Select>;
  }

  if (filter.kind === "multiselect") {
    const current = value?.kind === "multiselect" ? value.values : [];
    return <div className="ui-surface flex max-h-[128px] flex-wrap gap-x-sm gap-y-2xs overflow-y-auto border border-border p-xs scroll-panel">
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
    </div>;
  }

  if (filter.kind === "range") {
    const current = value?.kind === "range" ? value : { min: null, max: null };
    const update = (min: number | null, max: number | null) =>
      onChange(min === null && max === null ? undefined : { kind: "range", min, max });
    return <Stack direction="row" gap="2xs" align="center">
      <Input type="number" inputMode="numeric" aria-label={`${label}: от`} placeholder="от" value={current.min ?? ""} onChange={(event) => update(numberOrNull(event.target.value), current.max)} />
      <Text tone="muted">–</Text>
      <Input type="number" inputMode="numeric" aria-label={`${label}: до`} placeholder="до" value={current.max ?? ""} onChange={(event) => update(current.min, numberOrNull(event.target.value))} />
      {filter.unit && <Text size="sm" tone="muted" className="whitespace-nowrap">{filter.unit}</Text>}
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
    <option value="">неважно</option>
    <option value="yes">{filter.yes}</option>
    <option value="no">{filter.no}</option>
  </Select>;
}

/**
 * Панель отбора. Фильтры добавляются по одному из меню, а не выкладываются
 * все сразу: полтора десятка контролов, из которых нужен один, — это стена,
 * сквозь которую не видно самой таблицы.
 *
 * Свёрнутая панель показывает ряд чипов: до них о том, что отсекает половину
 * списка, говорило одно число.
 */
export function TableFilters<T>({
  columns, values, onChange, search, onSearch, searchPlaceholder,
  shown, total, collapsed, onCollapsed, sortRow, onReset,
  views, onSaveView, onApplyView, onRemoveView,
}: TableFiltersProps<T>) {
  const [viewName, setViewName] = useState("");
  // Добавленный фильтр остаётся на экране, даже пока пустой; фильтр со
  // значением показывается сам — иначе пришедший по ссылке отбор был бы скрыт.
  const [added, setAdded] = useState<string[]>([]);

  const filterable = columns.filter((column) => column.filter);
  const isOpen = (key: string) => added.includes(key) || isFilterActive(values[key]);
  const open = filterable.filter((column) => isOpen(column.key));
  const closed = filterable.filter((column) => !isOpen(column.key));
  const count = activeFilters(values) + (search.trim() ? 1 : 0);

  const set = (key: string, next: FilterValue | undefined) => {
    const copy = { ...values };
    if (next) copy[key] = next; else delete copy[key];
    onChange(copy);
  };

  const drop = (key: string) => {
    setAdded((current) => current.filter((item) => item !== key));
    set(key, undefined);
  };

  const reset = () => {
    setAdded([]);
    onReset();
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
            {count > 0 && <Button size="sm" variant="ghost" onClick={reset}>Сбросить</Button>}
            <Button size="sm" variant="neutral" onClick={() => onCollapsed(!collapsed)}>
              <TbFilter aria-hidden /> {collapsed ? `Показать${count ? ` · ${count}` : ""}` : "Свернуть"}
            </Button>
          </Stack>
        </Stack>

        {/* В развёрнутом виде то же самое видно по самим контролам. */}
        {collapsed && count > 0 && <Stack direction="row" gap="2xs" align="center" wrap>
          {search.trim() && <Stack direction="row" gap="2xs" align="center" className="ui-surface bg-surface-muted py-2xs pr-2xs pl-sm text-sm">
            <span>Поиск: {search.trim()}</span>
            <IconButton size="sm" label="Очистить поиск" onClick={() => onSearch("")}><TbX aria-hidden /></IconButton>
          </Stack>}
          {filterable.map((column) => {
            const value = values[column.key];
            if (!isFilterActive(value)) return null;
            return <Stack key={column.key} direction="row" gap="2xs" align="center" className="ui-surface bg-surface-muted py-2xs pr-2xs pl-sm text-sm">
              <span className="truncate">{column.label}: {describeFilter(column.filter as ColumnFilter<T>, value)}</span>
              <IconButton size="sm" label={`Убрать фильтр «${column.label}»`} onClick={() => drop(column.key)}><TbX aria-hidden /></IconButton>
            </Stack>;
          })}
        </Stack>}

        {!collapsed && <>
          <Input type="search" value={search} placeholder={searchPlaceholder} aria-label={searchPlaceholder} onChange={(event) => onSearch(event.target.value)} />

          {open.length > 0 && <div className="grid gap-sm md:grid-cols-2">
            {open.map((column) => <Stack key={column.key} gap="2xs">
              <Stack direction="row" align="center" justify="between" gap="2xs">
                <Text size="sm" tone="muted">{column.label}</Text>
                <IconButton size="sm" label={`Убрать фильтр «${column.label}»`} onClick={() => drop(column.key)}><TbX aria-hidden /></IconButton>
              </Stack>
              <FilterControl
                label={column.label}
                filter={column.filter as ColumnFilter<T>}
                value={values[column.key]}
                onChange={(next) => set(column.key, next)}
              />
            </Stack>)}
          </div>}

          {closed.length > 0 && <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button size="sm" variant="dashed"><TbPlus aria-hidden /> Фильтр</Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="start" sideOffset={8} className="z-30">
                <Card padding="xs" content="sm" className="max-h-[50vh] w-[260px] overflow-y-auto shadow-xl scroll-panel">
                  <Stack gap="2xs">
                    {closed.map((column) => <DropdownMenu.Item key={column.key} asChild onSelect={() => setAdded((current) => [...current, column.key])}>
                      <Button size="sm" variant="ghost" block className="justify-start">{column.label}</Button>
                    </DropdownMenu.Item>)}
                  </Stack>
                </Card>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>}

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
