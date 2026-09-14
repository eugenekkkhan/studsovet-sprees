import { useEffect } from "react";
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
import { Button, Heading, Stack, Text } from "../../../atoms";
import EntityRow from "../EntityRow/EntityRow";
import { effectiveWeight, type DrawMode, type Entity } from "../../../../types/roulette";

interface EntityListProps {
  entities: Entity[];
  drawMode: DrawMode;
  totalWeight: number;
  disabled: boolean;
  onRig: (id: string) => void;
  onRemove: (id: string) => void;
  onWeight: (id: string, weight: number) => void;
  onColor: (id: string, color: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  onRestoreAll: () => void;
  onClear: () => void;
}

/** Editable list of wheel entries: order, copies, colour — and a hidden rig. */
const EntityList = ({
  entities,
  drawMode,
  totalWeight,
  disabled,
  onRig,
  onRemove,
  onWeight,
  onColor,
  onReorder,
  onRestoreAll,
  onClear,
}: EntityListProps) => {
  // The distance constraint is load-bearing: without it dnd-kit swallows the
  // pointerdown and both the Alt-click rig and the delete button stop working.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => () => setDragCursor(false), []);

  const drawnOut = entities.filter(
    (entity) => effectiveWeight(entity, drawMode) === 0,
  ).length;

  // The pointer leaves the handle the moment the row starts moving, so the
  // grabbing cursor is held on the body for the length of the drag.
  const setDragCursor = (dragging: boolean) => {
    document.body.style.cursor = dragging ? "grabbing" : "";
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDragCursor(false);
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  };

  return (
    <Stack gap="sm" block align="flex-start">
      <Stack direction="row" gap="sm" align="center" wrap>
        <Heading level={2}>Список</Heading>
        <Text as="span" size="xs" tone="muted">
          {drawnOut > 0
            ? `Разыграно ${drawnOut} из ${entities.length}`
            : `${entities.length} в игре`}
        </Text>
      </Stack>

      <Stack direction="row" gap="sm" wrap>
        <Button
          variant="ghost"
          disabled={drawnOut === 0}
          onClick={onRestoreAll}
        >
          Вернуть всех
        </Button>
        <Button
          variant="danger"
          disabled={entities.length === 0}
          onClick={onClear}
        >
          Очистить всё
        </Button>
      </Stack>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={() => setDragCursor(true)}
        onDragCancel={() => setDragCursor(false)}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={entities.map((entity) => entity.id)}
          strategy={verticalListSortingStrategy}
        >
          <Stack gap="2xs" block>
            {entities.map((entity) => (
              <EntityRow
                key={entity.id}
                entity={entity}
                drawMode={drawMode}
                share={
                  totalWeight > 0
                    ? effectiveWeight(entity, drawMode) / totalWeight
                    : 0
                }
                disabled={disabled}
                onRig={onRig}
                onRemove={onRemove}
                onWeight={onWeight}
                onColor={onColor}
              />
            ))}
          </Stack>
        </SortableContext>
      </DndContext>
    </Stack>
  );
};

export type { EntityListProps };
export default EntityList;
