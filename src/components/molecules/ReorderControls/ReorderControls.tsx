import {
  IoArrowDownOutline,
  IoArrowUpOutline,
  IoReorderThreeOutline,
} from "react-icons/io5";
import { IconButton, Stack } from "../../atoms";
import { useDragHandleContext } from "../SortableList/dragHandle";

interface ReorderControlsProps {
  /** Родительный падеж: «раунд», «тему», «клетку». */
  what: string;
  onUp: () => void;
  onDown: () => void;
  disabledUp?: boolean;
  disabledDown?: boolean;
  /** Внутри <summary> клик по кнопке иначе схлопнет блок. */
  keepOpen?: boolean;
}

/**
 * Один и тот же ряд управления порядком для раундов, тем и клеток:
 * ручка перетаскивания плюс две стрелки для тех, кому мышью неудобно.
 */
const ReorderControls = ({
  what,
  onUp,
  onDown,
  disabledUp = false,
  disabledDown = false,
  keepOpen = false,
}: ReorderControlsProps) => {
  const handle = useDragHandleContext();

  return (
    <Stack
      direction="row"
      gap="2xs"
      align="center"
      onClick={keepOpen ? (event) => event.preventDefault() : undefined}
    >
      {handle && (
        <IconButton
          size="sm"
          label={`Перетащить ${what}`}
          style={{ cursor: handle.isDragging ? "grabbing" : "grab" }}
          {...handle.attributes}
          {...handle.listeners}
        >
          <IoReorderThreeOutline aria-hidden />
        </IconButton>
      )}
      <IconButton
        size="sm"
        label={`Поднять ${what} выше`}
        disabled={disabledUp}
        onClick={onUp}
      >
        <IoArrowUpOutline aria-hidden />
      </IconButton>
      <IconButton
        size="sm"
        label={`Опустить ${what} ниже`}
        disabled={disabledDown}
        onClick={onDown}
      >
        <IoArrowDownOutline aria-hidden />
      </IconButton>
    </Stack>
  );
};

export type { ReorderControlsProps };
export default ReorderControls;
