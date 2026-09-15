import { useEffect, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Stack } from "../../atoms";
import type { Space } from "../../../styles/tokens";

export type SortableLayout = "vertical" | "row" | "grid";

interface SortableListProps {
  /** Идентификаторы в текущем порядке. */
  items: string[];
  onReorder: (fromId: string, toId: string) => void;
  gap?: Space;
  /**
   * Столбец, ряд или сетка. Ряд и сетка переносят элементы на новую строку,
   * поэтому считают перестановку по прямоугольникам: горизонтальная стратегия
   * dnd-kit исходит из того, что весь список лежит в одну линию, и после
   * переноса отдаёт соседей из другой строки.
   */
  layout?: SortableLayout;
  /** Классы контейнера — сетке нужно задать колонки снаружи. */
  className?: string;
  children: ReactNode;
}

// Курсор уезжает с ручки, как только строка поехала, поэтому «схваченный»
// курсор держим на body всю длительность перетаскивания.
const setDragCursor = (dragging: boolean) => {
  document.body.style.cursor = dragging ? "grabbing" : "";
};

/** Список с перетаскиванием: элементы — SortableItem. */
const SortableList = ({
  items,
  onReorder,
  gap = "sm",
  layout = "vertical",
  className,
  children,
}: SortableListProps) => {
  // Порог в 6px обязателен: без него dnd-kit съедает pointerdown и кнопки
  // внутри карточек перестают нажиматься.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => () => setDragCursor(false), []);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDragCursor(false);
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => setDragCursor(true)}
      onDragCancel={() => setDragCursor(false)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items}
        strategy={layout === "vertical" ? verticalListSortingStrategy : rectSortingStrategy}
      >
        {layout === "grid" ? (
          <div className={className}>{children}</div>
        ) : (
          <Stack
            direction={layout === "row" ? "row" : "column"}
            align={layout === "row" ? "center" : undefined}
            wrap={layout === "row"}
            gap={gap}
            block={layout === "vertical"}
            className={className}
          >
            {children}
          </Stack>
        )}
      </SortableContext>
    </DndContext>
  );
};

export type { SortableListProps };
export default SortableList;
