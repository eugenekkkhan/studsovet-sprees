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
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Stack } from "../../atoms";
import type { Space } from "../../../styles/tokens";

interface SortableListProps {
  /** Идентификаторы в текущем порядке. */
  items: string[];
  onReorder: (fromId: string, toId: string) => void;
  gap?: Space;
  children: ReactNode;
}

// Курсор уезжает с ручки, как только строка поехала, поэтому «схваченный»
// курсор держим на body всю длительность перетаскивания.
const setDragCursor = (dragging: boolean) => {
  document.body.style.cursor = dragging ? "grabbing" : "";
};

/** Вертикальный список с перетаскиванием: элементы — SortableItem. */
const SortableList = ({ items, onReorder, gap = "sm", children }: SortableListProps) => {
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
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <Stack gap={gap} block>
          {children}
        </Stack>
      </SortableContext>
    </DndContext>
  );
};

export type { SortableListProps };
export default SortableList;
