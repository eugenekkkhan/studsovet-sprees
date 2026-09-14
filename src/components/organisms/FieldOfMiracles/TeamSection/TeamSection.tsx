import { Badge } from "../../../atoms";
import { TeamCard } from "../../../molecules";
import TeamAdminCard from "../../Teams/TeamAdminCard/TeamAdminCard";
import TeamsSection from "../../Teams/TeamsSection/TeamsSection";
import { useGameContext } from "../../../../hooks/useGameContext";
import type { Team } from "../../../../types/fieldOfMiracles";

const roundNote = (team: Team) =>
  team.roundPoints > 0 ? `+${team.roundPoints} в раунде` : undefined;

/** Команды «Поля чудес»: счёт, ключи капитанов и правка состава. */
const TeamSection = () => {
  const {
    game,
    teams,
    activeTeam,
    joinUrl,
    addTeam,
    removeTeam,
    updateTeam,
    setPoints,
  } = useGameContext();
  const canManage = game.phase === "setup" || game.phase === "round-complete";

  return (
    <TeamsSection
      teams={teams}
      keyOf={(team) => team.id}
      canAdd={canManage}
      addHint="Каждой команде выдаётся личный ключ: по нему капитан входит с телефона."
      onAdd={addTeam}
      renderTeam={(team, collapsed) => {
        const active = activeTeam?.id === team.id;
        const shared = {
          name: team.name,
          color: team.color,
          score: team.points,
          badges: active ? <Badge tone="success">Ходит</Badge> : null,
          note: roundNote(team),
          online: game.connectedTeamIds.includes(team.id),
          highlighted: active,
        };

        return collapsed ? (
          <TeamCard {...shared} size="md" />
        ) : (
          <TeamAdminCard
            {...shared}
            joinKey={team.joinKey}
            inviteUrl={
              joinUrl && team.joinKey
                ? `${joinUrl}&key=${encodeURIComponent(team.joinKey)}`
                : null
            }
            removeDisabled={!canManage}
            onSave={(name, color) => updateTeam(team.id, name, color)}
            onScore={(points) => setPoints(team.id, points)}
            onRemove={() => removeTeam(team.id)}
          />
        );
      }}
    />
  );
};

export default TeamSection;
