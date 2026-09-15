import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DragHandleContext } from "./dragHandleContext";

interface SortableItemProps {
  id: string;
  /** Занять всю ширину: столбцу и ячейке сетки нужно, элементу ряда — нет. */
  fill?: boolean;
  children: ReactNode;
}

/** Элемент сортируемого списка: сам двигается, ручку отдаёт через контекст. */
const SortableItem = ({ id, fill = true, children }: SortableItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      // Слой перетаскивания владеет трансформом; карточка внутри остаётся обычной.
      style={{
        width: fill ? "100%" : undefined,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 1 : undefined,
        position: "relative",
      }}
    >
      <DragHandleContext.Provider value={{ attributes, listeners, isDragging }}>
        {children}
      </DragHandleContext.Provider>
    </div>
  );
};

export type { SortableItemProps };
export default SortableItem;
