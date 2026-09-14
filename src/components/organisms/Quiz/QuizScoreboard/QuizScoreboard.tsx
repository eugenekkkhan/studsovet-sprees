import { Badge, Button, EmptyState, Stack } from "../../../atoms";
import { TeamCard, type TeamCardSize } from "../../../molecules";
import type { Team } from "../../../../types/quiz";

interface QuizScoreboardProps {
  teams: Team[];
  pickerTeamId?: string | null;
  /** Команда, которая сейчас отвечает или играет кота/аукцион. */
  answeringTeamId?: string | null;
  lockedTeamIds?: string[];
  /** Своя команда на экране капитана. */
  ownTeamId?: string | null;
  /** Кнопка выбора команды: передача «Кота», ручная смена ходa. */
  onSelect?: (teamId: string) => void;
  selectLabel?: string;
  selectableTeamIds?: string[];
  /** `lg` — для зала: карточка крупнее и счёт тянется за шириной экрана. */
  size?: TeamCardSize;
}

/** Счёт команд с пометками, кто выбирает и кто отвечает. */
const QuizScoreboard = ({
  teams,
  pickerTeamId = null,
  answeringTeamId = null,
  lockedTeamIds = [],
  ownTeamId = null,
  onSelect,
  selectLabel = "Выбрать",
  selectableTeamIds,
  size = "sm",
}: QuizScoreboardProps) => {
  if (teams.length === 0) {
    return <EmptyState paddingY="lg">Команд пока нет.</EmptyState>;
  }

  return (
    <Stack direction="row" gap="sm" wrap role="list" className="items-stretch">
      {teams.map((team) => {
        const locked = lockedTeamIds.includes(team.id);
        const answering = answeringTeamId === team.id;
        const selectable =
          Boolean(onSelect) &&
          (selectableTeamIds ? selectableTeamIds.includes(team.id) : true);

        return (
          <TeamCard
            key={team.id}
            role="listitem"
            name={team.name}
            color={team.color}
            score={team.score}
            size={size}
            signed
            own={ownTeamId === team.id}
            dimmed={locked}
            highlighted={answering}
            className="flex-1"
            badges={
              <>
                {pickerTeamId === team.id && <Badge tone="primary">Выбирает</Badge>}
                {answering && <Badge tone="success">Отвечает</Badge>}
                {locked && <Badge tone="neutral">Попытка использована</Badge>}
              </>
            }
          >
            {selectable && (
              <Stack direction="row" justify="center">
                <Button size="sm" variant="neutral" onClick={() => onSelect?.(team.id)}>
                  {selectLabel}
                </Button>
              </Stack>
            )}
          </TeamCard>
        );
      })}
    </Stack>
  );
};

export type { QuizScoreboardProps };
export default QuizScoreboard;
