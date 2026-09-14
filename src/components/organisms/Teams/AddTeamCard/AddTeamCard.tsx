import { useState, type ReactNode } from "react";
import { Button, Card, ColorInput, Input, Stack, Text } from "../../../atoms";
import { TEAM_COLORS } from "../../../../constants/teamColors";

interface AddTeamCardProps {
  /** Сколько команд уже есть — по нему берётся следующий цвет палитры. */
  teamCount: number;
  hint?: ReactNode;
  disabled?: boolean;
  onAdd: (name: string, color: string) => void;
}

const paletteColor = (index: number) =>
  TEAM_COLORS[index % TEAM_COLORS.length];

/**
 * Добавление команды прямо в сетке — там же, где появится карточка.
 * Пунктирная рамка отличает её от настоящих команд, размер тот же.
 */
const AddTeamCard = ({
  teamCount,
  hint,
  disabled = false,
  onAdd,
}: AddTeamCardProps) => {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(() => paletteColor(teamCount));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || disabled) return;
    onAdd(trimmed, color);
    setName("");
    setColor(paletteColor(teamCount + 1));
  };

  return (
    <Card
      padding="md"
      content="md"
      className="border-dashed border-border-strong bg-transparent"
    >
      <Stack gap="sm" align="center" className="h-full">
        <Text weight={600}>Добавить команду</Text>

        <form className="w-full" onSubmit={submit}>
          <Stack gap="sm">
            <Stack direction="row" gap="xs" align="center">
              <ColorInput
                value={color}
                aria-label="Цвет новой команды"
                disabled={disabled}
                onChange={(event) => setColor(event.target.value)}
              />
              <Input
                value={name}
                placeholder="Название команды"
                className="min-w-0 flex-1"
                disabled={disabled}
                onChange={(event) => setName(event.target.value)}
              />
            </Stack>
            <Button type="submit" block disabled={disabled || !name.trim()}>
              Добавить
            </Button>
          </Stack>
        </form>

        {hint && (
          <Text as="p" size="xs" tone="muted" align="center">
            {hint}
          </Text>
        )}
      </Stack>
    </Card>
  );
};

export type { AddTeamCardProps };
export default AddTeamCard;
