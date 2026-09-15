import { IoReorderThreeOutline } from "react-icons/io5";
import { IconButton } from "../../atoms";
import { useDragHandleContext } from "./dragHandleContext";

interface DragHandleProps {
  /** Винительный падеж: «раунд», «тему», «критерий сортировки». */
  what: string;
}

/**
 * Ручка перетаскивания. Вне SortableItem не рендерится совсем: там ей нечего
 * тащить, а неработающая кнопка хуже отсутствующей.
 */
const DragHandle = ({ what }: DragHandleProps) => {
  const handle = useDragHandleContext();
  if (!handle) return null;

  return (
    <IconButton
      size="sm"
      label={`Перетащить ${what}`}
      style={{ cursor: handle.isDragging ? "grabbing" : "grab" }}
      {...handle.attributes}
      {...handle.listeners}
    >
      <IoReorderThreeOutline aria-hidden />
    </IconButton>
  );
};

export type { DragHandleProps };
export default DragHandle;
