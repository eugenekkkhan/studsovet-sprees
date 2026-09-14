import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { TbArrowsSort, TbChevronLeft, TbChevronRight, TbChevronsLeft, TbChevronsRight, TbSortAscending, TbSortDescending } from "react-icons/tb";
import { Button, Card, IconButton, Select, Stack, Text } from "../../atoms";
import { sortRows, type SortCriterion, type SortValue } from "./sorting";
import { ColumnsMenu } from "./ColumnsMenu";
import { DataTableCards } from "./DataTableCards";
import { GAP, pageWindow } from "./pagination";
import { escapeCsv } from "./csv";
import type { ColumnFilter } from "./filtering";
import { useMediaQuery } from "../../../hooks/useMediaQuery";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  csv?: (row: T) => string | number | null | undefined;
  /**
   * Значение, по которому колонка сортируется. Оно же делает её сортируемой:
   * заголовок, список в фильтрах и сам порядок строк берутся отсюда, так что
   * второго места, где про сортировку надо помнить, нет.
   */
  sortAccessor?: (row: T) => SortValue;
  /** Описание отбора по этой колонке: контрол и предикат строятся из него. */
  filter?: ColumnFilter<T>;
  /** Текст колонки, по которому ищет общая строка поиска. */
  searchAccessor?: (row: T) => string | null | undefined;
  hideable?: boolean;
  align?: "left" | "center" | "right";
  /** Число: прижимается вправо, чтобы разряды читались столбиком. */
  numeric?: boolean;
  width?: number;
  /**
   * Роль колонки в карточке на узком экране. Без указания выводится из
   * порядка: первая — заголовок, следующие две — сводка, прочие прячутся
   * под раскрытие.
   */
  mobile?: "primary" | "summary" | "detail";
}

interface DataTableProps<T> {
  name: string;
  /**
   * Отфильтрованные строки: сортирует и разбивает на страницы уже таблица.
   * Должны быть мемоизированы — смена ссылки возвращает на первую страницу.
   */
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string | number;
  sort: SortCriterion[];
  onSort: (sort: SortCriterion[]) => void;
  /** Чем разводить строки, которые все критерии сочли равными. */
  tiebreak?: (row: T) => SortValue;
  /** Название таблицы для скринридера: у решётки ячеек своего имени нет. */
  label: string;
  emptyText?: string;
  /** Сброс отбора прямо из пустого результата — единственное осмысленное там действие. */
  onResetFilters?: () => void;
}

export type PinSide = "left" | "right" | "none";
export type Density = "compact" | "cozy";

// Растёт при изменении формы сохраняемого объекта: настройки со старой формой
// проще отбросить, чем разбирать. Переименование колонок этим не лечится —
// там меняется `name` таблицы или помогает «Сбросить колонки».
const STATE_VERSION = 1;

interface SavedTableState {
  version?: number;
  density?: Density;
  hidden?: string[];
  pageSize?: number | "all";
  widths?: Record<string, number>;
  order?: string[];
  pinned?: Record<string, PinSide>;
}

const readSavedState = (key: string): SavedTableState => {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "{}") as SavedTableState;
    return saved.version === STATE_VERSION ? saved : {};
  } catch { return {}; }
};

/** Перестановка ключа на место другого — та же семантика, что у dnd-kit. */
const reorderKeys = (keys: string[], fromKey: string, toKey: string) => {
  const next = [...keys];
  const from = next.indexOf(fromKey);
  const to = next.indexOf(toKey);
  if (from < 0 || to < 0) return keys;
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
};

/** Сдвиг на соседа — клавиатурный дублёр перетаскивания. */
const moveKey = (keys: string[], key: string, offset: -1 | 1) => {
  const from = keys.indexOf(key);
  const to = from + offset;
  return from < 0 || to < 0 || to >= keys.length ? keys : reorderKeys(keys, key, keys[to]);
};

export function DataTable<T>({ name, label, rows, columns, rowKey, sort, onSort, tiebreak, emptyText = "Строк нет.", onResetFilters }: DataTableProps<T>) {
  // Телефон таблицу не показывает: тринадцать колонок там всё равно не
  // помещаются, а вложенная горизонтальная прокрутка спорит с жестами Telegram.
  const narrow = useMediaQuery("(max-width: 640px)");
  const storageKey = `sprees:table:${name}`;
  // Сохранённое читается один раз при монтировании: дальше состояние живёт в
  // useState, и разбирать JSON на каждый рендер незачем.
  const [saved] = useState<SavedTableState>(() => readSavedState(storageKey));
  const [hidden, setHidden] = useState<string[]>(() => saved.hidden ?? []);
  const [pageSize, setPageSize] = useState<number | "all">(() => saved.pageSize ?? 25);
  const [page, setPage] = useState(1);
  const [widths, setWidths] = useState<Record<string, number>>(() => saved.widths ?? {});
  const [order, setColumnOrder] = useState<string[]>(() => saved.order ?? []);
  // Первая колонка закреплена по умолчанию: без неё при прокрутке вправо
  // непонятно, чья это строка. Когда таблица помещается целиком, закрепление
  // ничего не меняет.
  const [pinned, setPinned] = useState<Record<string, PinSide>>(() => saved.pinned ?? (columns[0] ? { [columns[0].key]: "left" } : {}));
  const [density, setDensity] = useState<Density>(() => saved.density ?? "cozy");

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ version: STATE_VERSION, hidden, pageSize, widths, order, pinned, density }));
  }, [density, hidden, order, pageSize, pinned, storageKey, widths]);
  // Первая страница — по самому набору строк, а не по его длине: фильтр, не
  // изменивший количество, иначе оставлял бы пользователя на той же странице
  // уже с другими данными. Смена сортировки — тот же случай.
  // По значению, а не по ссылке: массив критериев вызывающий нередко собирает
  // прямо в JSX, и сравнение ссылок сбрасывало бы страницу на каждый рендер.
  const sortKey = sort.map((item) => `${item.key}:${item.direction}`).join(",");
  useEffect(() => setPage(1), [rows, sortKey, pageSize]);

  const ordered = [...columns].sort((left, right) => {
    const leftIndex = order.indexOf(left.key); const rightIndex = order.indexOf(right.key);
    return (leftIndex < 0 ? columns.indexOf(left) : leftIndex) - (rightIndex < 0 ? columns.indexOf(right) : rightIndex);
  });
  const available = ordered.filter((column) => !hidden.includes(column.key));
  const visible = [
    ...available.filter((column) => pinned[column.key] === "left"),
    ...available.filter((column) => !pinned[column.key] || pinned[column.key] === "none"),
    ...available.filter((column) => pinned[column.key] === "right"),
  ];
  const tableWidth = visible.reduce((total, column) => total + (widths[column.key] ?? column.width ?? 150), 0);
  const leftOffsets = new Map<string, number>(); let leftOffset = 0;
  for (const column of visible.filter((item) => pinned[item.key] === "left")) { leftOffsets.set(column.key, leftOffset); leftOffset += widths[column.key] ?? column.width ?? 150; }
  const rightOffsets = new Map<string, number>(); let rightOffset = 0;
  for (const column of [...visible].reverse().filter((item) => pinned[item.key] === "right")) { rightOffsets.set(column.key, rightOffset); rightOffset += widths[column.key] ?? column.width ?? 150; }
  // Закреплённой ячейке нужен непрозрачный фон, но выбирает его не она: строка
  // отдаёт свой через --row-bg, иначе ховер обрывался бы ровно на границе
  // закреплённых колонок. В шапке переменной нет — там остаётся surface.
  const cellPadding = density === "compact" ? "px-sm py-2xs" : "p-sm";
  const alignOf = (column: DataTableColumn<T>) => column.align ?? (column.numeric ? "right" : "left");
  const stickyStyle = (column: DataTableColumn<T>, header = false) => pinned[column.key] === "left" ? { position: "sticky" as const, left: leftOffsets.get(column.key), zIndex: header ? 22 : 5, background: "var(--row-bg, var(--color-surface))" } : pinned[column.key] === "right" ? { position: "sticky" as const, right: rightOffsets.get(column.key), zIndex: header ? 22 : 5, background: "var(--row-bg, var(--color-surface))" } : {};
  const sorted = useMemo(() => sortRows(rows, columns, sort, tiebreak), [columns, rows, sort, tiebreak]);
  const pageCount = pageSize === "all" ? 1 : Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const shown = pageSize === "all" ? sorted : sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const position = useMemo(() => new Map(sort.map((item, index) => [item.key, index + 1])), [sort]);

  // Один такт на нажатие: нет -> по возрастанию -> по убыванию -> снова нет.
  // Раньше на колонку приходилось по две кнопки, и «снять» пряталось в
  // повторном клике по уже активной стрелке.
  const cycleSort = (key: string) => {
    const existing = sort.find((item) => item.key === key);
    if (!existing) onSort([...sort, { key, direction: "asc" }]);
    else if (existing.direction === "asc") onSort(sort.map((item) => item.key === key ? { ...item, direction: "desc" as const } : item));
    else onSort(sort.filter((item) => item.key !== key));
  };
  const directionOf = (key: string) => sort.find((item) => item.key === key)?.direction;

  const exportCsv = () => {
    const csvColumns = visible.filter((column) => column.csv);
    const body = [csvColumns.map((column) => escapeCsv(column.label)).join(";"), ...sorted.map((row) =>
      csvColumns.map((column) => escapeCsv(column.csv?.(row))).join(";"),
    )].join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", body], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}.csv`;
    // Ссылка должна побывать в документе, а Blob — пережить щелчок: отзыв
    // сразу после click() успевал отменить ещё не начавшееся скачивание.
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const setWidth = (key: string, width: number) => setWidths((current) => ({ ...current, [key]: Math.max(80, width) }));

  // Pointer, а не mouse: на тач-экране mousedown не приходит вовсе, и ширину
  // колонки нельзя было поменять ни пальцем, ни стилусом.
  const startResize = (key: string, event: ReactPointerEvent<HTMLElement>) => {
    const startX = event.clientX;
    const startWidth = event.currentTarget.parentElement?.getBoundingClientRect().width ?? 150;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const move = (moved: PointerEvent) => setWidth(key, startWidth + moved.clientX - startX);
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  };

  return <Stack gap="sm">
    <Card padding="sm">
      <Stack direction="row" gap="xs" align="center" justify="end" wrap>
        <ColumnsMenu
          columns={ordered}
          hidden={hidden}
          pinned={pinned}
          visibleCount={visible.length}
          pinnable={!narrow}
          onToggle={(key, shown) => {
            setHidden((current) => shown ? current.filter((item) => item !== key) : [...current, key]);
            // Скрытая колонка не должна продолжать задавать порядок строк.
            if (!shown) onSort(sort.filter((item) => item.key !== key));
          }}
          onPin={(key, side) => setPinned((current) => ({ ...current, [key]: current[key] === side ? "none" : side }))}
          onMove={(key, offset) => setColumnOrder(moveKey(ordered.map((column) => column.key), key, offset))}
          onReorder={(fromKey, toKey) => setColumnOrder(reorderKeys(ordered.map((column) => column.key), fromKey, toKey))}
          onReset={() => { setHidden([]); setWidths({}); setColumnOrder([]); setPinned({}); }}
        />
        <Select className="w-auto min-w-[150px]" value={density} aria-label="Плотность строк" onChange={(event) => setDensity(event.target.value as Density)}>
          <option value="cozy">Обычно</option><option value="compact">Компактно</option>
        </Select>
        <Select className="w-auto min-w-[150px]" value={pageSize} aria-label="Количество строк" onChange={(event) => setPageSize(event.target.value === "all" ? "all" : Number(event.target.value))}>
          <option value={25}>25 строк</option><option value={50}>50 строк</option><option value={100}>100 строк</option><option value="all">Все строки</option>
        </Select>
        <Button size="sm" variant="neutral" title="Выгрузить видимые колонки в CSV" onClick={exportCsv}>CSV</Button>
      </Stack>
    </Card>
    <Card padding="none" className="overflow-hidden">
      <div className={narrow ? "" : "max-h-[70vh] overflow-auto"}>
        {/* border-separate, а не collapse: при collapse рамка принадлежит
            таблице, а не ячейке, и нижняя граница липкой шапки уезжает вместе
            со скроллом. Поэтому границы живут на самих ячейках. */}
        {narrow ? <div className="p-xs"><DataTableCards rows={shown} columns={visible} rowKey={rowKey} /></div> : <table aria-label={label} className="w-full table-fixed border-separate border-spacing-0 text-left tabular-nums" style={{ minWidth: tableWidth }}>
          <colgroup>{visible.map((column) => <col key={column.key} style={{ width: widths[column.key] ?? column.width ?? 150 }} />)}</colgroup>
          <thead className="group/head sticky top-0 z-10 bg-surface"><tr className="text-muted-foreground">
            {visible.map((column) => <th key={column.key} className={`relative border-b border-border bg-surface ${cellPadding}`} aria-sort={directionOf(column.key) === "asc" ? "ascending" : directionOf(column.key) === "desc" ? "descending" : column.sortAccessor ? "none" : undefined} style={{ textAlign: alignOf(column), ...stickyStyle(column, true) }}>
              {column.sortAccessor ? <button type="button" className="inline-flex min-h-[24px] cursor-pointer items-center gap-1 rounded-pill hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none" aria-label={`${column.label}: ${directionOf(column.key) === "asc" ? "сейчас по возрастанию, нажатие переключит на убывание" : directionOf(column.key) === "desc" ? "сейчас по убыванию, нажатие снимет сортировку" : "сортировать по возрастанию"}`} onClick={() => cycleSort(column.key)}>
                <span>{column.label}</span>
                {directionOf(column.key) === "asc" ? <TbSortAscending className="text-primary" aria-hidden /> : directionOf(column.key) === "desc" ? <TbSortDescending className="text-primary" aria-hidden /> : <TbArrowsSort className="text-muted-foreground opacity-0 transition-opacity group-hover/head:opacity-100" aria-hidden />}
                {position.has(column.key) && sort.length > 1 && <sup className="text-primary">{position.get(column.key)}</sup>}
              </button> : <span className="inline-flex min-h-[24px] items-center">{column.label}</span>}
              {/* Разделитель, а не кнопка: нажимать его нечем, зато стрелками
                  ширина меняется — единственный способ сделать это с клавиатуры. */}
              <span
                role="separator"
                aria-orientation="vertical"
                aria-label={`Ширина колонки «${column.label}»`}
                tabIndex={0}
                className="absolute inset-y-0 -right-3 w-6 cursor-col-resize touch-none border-r-2 border-transparent bg-clip-content px-3 hover:border-primary focus-visible:border-primary focus-visible:outline-none"
                onPointerDown={(event) => startResize(column.key, event)}
                onKeyDown={(event) => {
                  const step = event.key === "ArrowLeft" ? -16 : event.key === "ArrowRight" ? 16 : 0;
                  if (!step) return;
                  event.preventDefault();
                  setWidth(column.key, (widths[column.key] ?? column.width ?? 150) + step);
                }}
              />
            </th>)}
          </tr></thead>
          <tbody>{shown.map((row) => <tr key={rowKey(row)} className="group bg-(--row-bg) [--row-bg:var(--color-surface)] hover:[--row-bg:var(--color-surface-hover)]">
            {visible.map((column) => <td key={column.key} className={`border-b border-border align-top group-last:border-0 ${cellPadding}`} style={{ textAlign: alignOf(column), ...stickyStyle(column) }}>{column.render(row)}</td>)}
          </tr>)}</tbody>
        </table>}
        {shown.length === 0 && <Stack gap="sm" align="center" className="p-xl text-center text-muted-foreground">
          <Text tone="muted">{emptyText}</Text>
          {onResetFilters && <Button size="sm" variant="ghost" onClick={onResetFilters}>Сбросить отбор</Button>}
        </Stack>}
      </div>
      {sorted.length > 0 && <Stack direction="row" gap="sm" align="center" justify="between" wrap className="border-t border-border p-sm">
        {/* Диапазон, а не только номер страницы: «Показано N из M» в фильтрах
            говорит про отбор, а сколько из них на экране — видно только тут. */}
        <Text size="sm" tone="muted" className="tabular-nums">
          {pageSize === "all" ? `Все ${sorted.length}` : `${(safePage - 1) * pageSize + 1}\u2013${Math.min(safePage * pageSize, sorted.length)} из ${sorted.length}`}
        </Text>
        {pageCount > 1 && <Stack direction="row" gap="2xs" align="center" wrap>
          <IconButton size="sm" label="Первая страница" disabled={safePage <= 1} onClick={() => setPage(1)}><TbChevronsLeft aria-hidden /></IconButton>
          <IconButton size="sm" label="Предыдущая страница" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}><TbChevronLeft aria-hidden /></IconButton>
          {pageWindow(safePage, pageCount).map((entry, index) => entry === GAP
            ? <Text key={`gap-${index}`} size="sm" tone="muted" aria-hidden>…</Text>
            : <Button key={entry} size="sm" variant={entry === safePage ? "primary" : "ghost"} aria-label={`Страница ${entry}`} aria-current={entry === safePage ? "page" : undefined} className="min-w-(--control-height-sm) tabular-nums" onClick={() => setPage(entry)}>{entry}</Button>)}
          <IconButton size="sm" label="Следующая страница" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}><TbChevronRight aria-hidden /></IconButton>
          <IconButton size="sm" label="Последняя страница" disabled={safePage >= pageCount} onClick={() => setPage(pageCount)}><TbChevronsRight aria-hidden /></IconButton>
        </Stack>}
      </Stack>}
    </Card>
  </Stack>;
}
