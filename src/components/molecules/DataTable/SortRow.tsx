import { TbArrowNarrowLeft, TbArrowNarrowRight, TbSortAscending, TbSortDescending, TbX } from "react-icons/tb";
import { Button, IconButton, Select, Stack, Text } from "../../atoms";
import DragHandle from "../SortableList/DragHandle";
import SortableItem from "../SortableList/SortableItem";
import SortableList from "../SortableList/SortableList";
import { reorderBy } from "../../../utils/reorder";
import type { DataTableColumn } from "./DataTable";
import { sortOptionsOf, type SortCriterion } from "./sorting";

interface SortRowProps<T> {
  columns: DataTableColumn<T>[];
  sort: SortCriterion[];
  onSort: (sort: SortCriterion[]) => void;
}

const swap = (sort: SortCriterion[], index: number, offset: -1 | 1) => {
  const target = index + offset;
  if (target < 0 || target >= sort.length) return sort;
  const next = [...sort];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/**
 * Управление сортировкой списком критериев. Заголовок таблицы — быстрый путь
 * для одной колонки; здесь видно всю очередь и её можно переставить, чего
 * раньше нельзя было сделать иначе как удалив и добавив критерии заново.
 *
 * Очередь перетаскивается, но стрелки остаются: с клавиатуры и на узком
 * экране они короче, а перетаскивание одной рукой на телефоне — лотерея.
 */
export function SortRow<T>({ columns, sort, onSort }: SortRowProps<T>) {
  const options = sortOptionsOf(columns);
  const available = options.filter((option) => !sort.some((item) => item.key === option.key));
  const labelOf = (key: string) => options.find((option) => option.key === key)?.label ?? key;

  return (
    <Stack direction="row" align="center" gap="xs" wrap>
      <Text size="sm" tone="muted">Сортировка:</Text>
      {sort.length === 0 && <Text size="sm" tone="muted">не задана</Text>}
      {sort.length > 0 && (
        <SortableList
          layout="row"
          gap="xs"
          items={sort.map((criterion) => criterion.key)}
          onReorder={(fromId, toId) => onSort(reorderBy(sort, (item) => item.key, fromId, toId))}
        >
          {sort.map((criterion, index) => (
            <SortableItem key={criterion.key} id={criterion.key} fill={false}>
              <Stack direction="row" align="center" gap="2xs">
                {index > 0 && <TbArrowNarrowRight className="text-muted-foreground" aria-hidden />}
                <DragHandle what={`критерий «${labelOf(criterion.key)}»`} />
                <IconButton size="sm" label={`«${labelOf(criterion.key)}»: раньше в очереди`} disabled={index === 0} onClick={() => onSort(swap(sort, index, -1))}>
                  <TbArrowNarrowLeft aria-hidden />
                </IconButton>
                <Button size="sm" variant="neutral" onClick={() => onSort(sort.map((item) =>
                  item.key === criterion.key ? { ...item, direction: item.direction === "asc" ? "desc" : "asc" } : item))}>
                  {labelOf(criterion.key)} {criterion.direction === "asc" ? <TbSortAscending aria-hidden /> : <TbSortDescending aria-hidden />}
                </Button>
                <IconButton size="sm" label={`«${labelOf(criterion.key)}»: позже в очереди`} disabled={index === sort.length - 1} onClick={() => onSort(swap(sort, index, 1))}>
                  <TbArrowNarrowRight aria-hidden />
                </IconButton>
                <IconButton size="sm" label={`Убрать сортировку «${labelOf(criterion.key)}»`} onClick={() => onSort(sort.filter((item) => item.key !== criterion.key))}>
                  <TbX aria-hidden />
                </IconButton>
              </Stack>
            </SortableItem>
          ))}
        </SortableList>
      )}
      {available.length > 0 && <Select className="w-auto min-w-[170px]" value="" aria-label="Добавить сортировку" onChange={(event) =>
        event.target.value && onSort([...sort, { key: event.target.value, direction: "asc" }])}>
        <option value="">+ сортировка</option>
        {available.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
      </Select>}
    </Stack>
  );
}
