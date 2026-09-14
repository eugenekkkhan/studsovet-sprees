import { createContext, useContext } from "react";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

export interface DragHandleValue {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
  isDragging: boolean;
}

/**
 * Ручка живёт не в самом элементе, а где-то в его разметке: так строка раунда,
 * тема и клетка складывают её в свой ряд управления, а не в навязанное место.
 */
export const DragHandleContext = createContext<DragHandleValue | null>(null);

export const useDragHandleContext = () => useContext(DragHandleContext);
