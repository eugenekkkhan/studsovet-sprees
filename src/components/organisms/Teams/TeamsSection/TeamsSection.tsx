import { Fragment, useState, type ReactNode } from "react";
import { Button, Card, EmptyState, Heading, Stack } from "../../../atoms";
import AddTeamCard from "../AddTeamCard/AddTeamCard";
import TeamsGrid from "../TeamsGrid/TeamsGrid";
import { cardRadius } from "../../../../styles/tokens";

// The team grid runs to the bottom edge, so the cards in it are what this
// section's corners have to match. Everything above the grid is centred and
// never reaches a corner.
const TEAM_CARD_RADIUS = cardRadius("md", "md");

interface TeamsSectionProps<T> {
  teams: T[];
  keyOf: (team: T) => string;
  /** Карточка команды: развёрнутая с правкой или свёрнутая со счётом. */
  renderTeam: (team: T, collapsed: boolean) => ReactNode;
  /** Состав правят не всегда — посреди раунда добавлять некуда. */
  canAdd?: boolean;
  addHint?: ReactNode;
  onAdd: (name: string, color: string) => void;
}

/**
 * Секция команд — одна и та же в обеих играх: заголовок, сворачивание,
 * сетка карточек и добавление в её конце. Что нарисовано в карточке, решает
 * игра; всё вокруг карточек — здесь.
 */
const TeamsSection = <T,>({
  teams,
  keyOf,
  renderTeam,
  canAdd = true,
  addHint,
  onAdd,
}: TeamsSectionProps<T>) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Card padding="md" content={TEAM_CARD_RADIUS}>
      <Stack gap="sm">
        <Stack direction="row" gap="sm" align="center" justify="center" wrap>
          <Heading level={2}>Команды</Heading>
          <Button variant="ghost" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? "Развернуть" : "Свернуть"}
          </Button>
        </Stack>

        {teams.length === 0 && (collapsed || !canAdd) && (
          <EmptyState paddingY="md">Команд пока нет.</EmptyState>
        )}

        <TeamsGrid>
          {teams.map((team) => (
            <Fragment key={keyOf(team)}>{renderTeam(team, collapsed)}</Fragment>
          ))}

          {!collapsed && canAdd && (
            <AddTeamCard teamCount={teams.length} hint={addHint} onAdd={onAdd} />
          )}
        </TeamsGrid>
      </Stack>
    </Card>
  );
};

export type { TeamsSectionProps };
export default TeamsSection;
