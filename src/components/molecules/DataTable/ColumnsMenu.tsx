import { Popover } from "radix-ui";
import { TbArrowBarToLeft, TbArrowBarToRight } from "react-icons/tb";
import { Button, Card, IconButton, Stack, Text } from "../../atoms";
import DragHandle from "../SortableList/DragHandle";
import SortableItem from "../SortableList/SortableItem";
import SortableList from "../SortableList/SortableList";
import type { DataTableColumn, PinSide } from "./DataTable";

interface ColumnsMenuProps<T> {
  /** Колонки в текущем порядке — включая скрытые. */
  columns: DataTableColumn<T>[];
  hidden: string[];
  pinned: Record<string, PinSide>;
  visibleCount: number;
  /** В карточном режиме закреплять нечего: колонок в ряд там нет. */
  pinnable: boolean;
  onToggle: (key: string, shown: boolean) => void;
  onPin: (key: string, side: "left" | "right") => void;
  onReorder: (fromKey: string, toKey: string) => void;
  onReset: () => void;
}

interface ColumnRowProps {
  label: string;
  shown: boolean;
  lockedShown: boolean;
  pin: PinSide;
  pinnable: boolean;
  onToggle: (shown: boolean) => void;
  onPin: (side: "left" | "right") => void;
}

const ColumnRow = ({ label, shown, lockedShown, pin, pinnable, onToggle, onPin }: ColumnRowProps) => (
  <Stack direction="row" gap="2xs" align="center">
    <DragHandle what="колонку" />
    <label className="flex min-w-0 flex-1 items-center gap-xs text-sm">
      <input type="checkbox" checked={shown} disabled={lockedShown} onChange={(event) => onToggle(event.target.checked)} />
      <span className="truncate">{label}</span>
    </label>
    {pinnable && <IconButton
      size="sm"
      label={`${label}: ${pin === "left" ? "открепить" : "закрепить слева"}`}
      className={pin === "left" ? "border-primary text-primary" : "text-muted-foreground"}
      onClick={() => onPin("left")}
    >
      <TbArrowBarToLeft aria-hidden />
    </IconButton>}
    {pinnable && <IconButton
      size="sm"
      label={`${label}: ${pin === "right" ? "открепить" : "закрепить справа"}`}
      className={pin === "right" ? "border-primary text-primary" : "text-muted-foreground"}
      onClick={() => onPin("right")}
    >
      <TbArrowBarToRight aria-hidden />
    </IconButton>}
  </Stack>
);

/**
 * Показ, порядок и закрепление колонок. Порядок меняется тем же dnd-kit, что и
 * остальные списки проекта, — HTML5-перетаскивание, стоявшее здесь раньше, на
 * тач-экране не работало вовсе, а клавиатуре не давалось и на десктопе.
 * Закрытие по Escape, клику вне и возврат фокуса на кнопку — от Radix.
 */
export function ColumnsMenu<T>({
  columns, hidden, pinned, visibleCount, pinnable, onToggle, onPin, onReorder, onReset,
}: ColumnsMenuProps<T>) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button size="sm" variant="neutral">Колонки {visibleCount}/{columns.length}</Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-30" aria-label="Показ и порядок колонок">
          <Card padding="sm" content="sm" className="max-h-[60vh] w-[340px] max-w-[calc(100vw-2rem)] overflow-y-auto shadow-xl scroll-panel">
            <Stack gap="xs">
              <Text size="sm" weight={700}>Показ и порядок колонок</Text>
              <SortableList items={columns.map((column) => column.key)} gap="2xs" onReorder={onReorder}>
                {columns.map((column) => (
                  <SortableItem key={column.key} id={column.key}>
                    <ColumnRow
                      label={column.label}
                      shown={!hidden.includes(column.key)}
                      lockedShown={column.hideable === false}
                      pin={pinned[column.key] ?? "none"}
                      pinnable={pinnable}
                      onToggle={(shown) => onToggle(column.key, shown)}
                      onPin={(side) => onPin(column.key, side)}
                    />
                  </SortableItem>
                ))}
              </SortableList>
              <Button size="sm" variant="ghost" onClick={onReset}>Сбросить колонки</Button>
            </Stack>
          </Card>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
