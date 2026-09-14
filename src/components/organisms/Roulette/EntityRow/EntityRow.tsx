import { useState } from "react";
import { IoReorderThreeOutline, IoTrashBinOutline } from "react-icons/io5";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Card,
  ColorDot,
  ColorInput,
  IconButton,
  Stack,
  Text,
} from "../../../atoms";
import { ColorSwatchPicker, WeightStepper } from "../../../molecules";
import { ENTITY_COLORS } from "../../../../constants/entityPalette";
import {
  effectiveWeight,
  type DrawMode,
  type Entity,
} from "../../../../types/roulette";

interface EntityRowProps {
  entity: Entity;
  drawMode: DrawMode;
  share: number;
  disabled: boolean;
  onRig: (id: string) => void;
  onRemove: (id: string) => void;
  onWeight: (id: string, weight: number) => void;
  onColor: (id: string, color: string) => void;
}

const EntityRow = ({
  entity,
  drawMode,
  share,
  disabled,
  onRig,
  onRemove,
  onWeight,
  onColor,
}: EntityRowProps) => {
  const [pickingColor, setPickingColor] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entity.id, disabled });

  const drawnOut = effectiveWeight(entity, drawMode) === 0;

  return (
    /* The drag layer owns the transform; the Card stays a plain atom. */
    <div
      ref={setNodeRef}
      style={{
        width: "100%",
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : drawnOut ? 0.45 : 1,
      }}
    >
      <Card
        padding="xs"
        // sm icon buttons hold both ends of the row: 8px padding + their 14px
        // radius. On the collapsed row that is exactly a pill; once the colour
        // picker opens and the row grows, it stays the same corner.
        content="sm"
        // Plain clicks do nothing here. Alt is the whole gesture.
        onClick={(event) => {
          if (event.altKey && !disabled && !drawnOut) {
            onRig(entity.id);
          }
        }}
      >
        <Stack gap="2xs">
          <Stack direction="row" gap="sm" align="center">
            <IconButton
              size="sm"
              label="Переставить"
              style={{
                cursor: disabled
                  ? "not-allowed"
                  : isDragging
                    ? "grabbing"
                    : "grab",
              }}
              {...attributes}
              {...listeners}
            >
              <IoReorderThreeOutline />
            </IconButton>

            <ColorDot
              color={entity.color}
              size={18}
              label={`Цвет: ${entity.title}`}
              onClick={() => setPickingColor((open) => !open)}
            />

            <Text
              as="span"
              weight={600}
              style={{
                flex: 1,
                textAlign: "left",
                textDecoration: drawnOut ? "line-through" : undefined,
              }}
            >
              {entity.title}
            </Text>

            <WeightStepper
              value={entity.weight}
              share={share}
              disabled={disabled}
              onChange={(weight) => onWeight(entity.id, weight)}
            />

            <IconButton
              size="sm"
              tone="danger"
              label="Удалить"
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                onRemove(entity.id);
              }}
            >
              <IoTrashBinOutline />
            </IconButton>
          </Stack>

          {/* Opening the picker is a deliberate click, not a state flicker, so
            conditional rendering is right here. */}
          {pickingColor && (
            <Stack direction="row" gap="sm" align="center" wrap>
              <ColorSwatchPicker
                colors={ENTITY_COLORS}
                value={entity.color}
                size={22}
                onChange={(color) => onColor(entity.id, color)}
              />
              <ColorInput
                bare
                value={entity.color}
                onChange={(event) => onColor(entity.id, event.target.value)}
                style={{ width: "56px", height: "28px" }}
              />
            </Stack>
          )}
        </Stack>
      </Card>
    </div>
  );
};

export type { EntityRowProps };
export default EntityRow;
