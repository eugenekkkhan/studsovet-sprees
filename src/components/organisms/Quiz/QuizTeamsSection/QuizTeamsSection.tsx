import { Badge, Button } from "../../../atoms";
import { TeamCard } from "../../../molecules";
import TeamAdminCard from "../../Teams/TeamAdminCard/TeamAdminCard";
import TeamsSection from "../../Teams/TeamsSection/TeamsSection";
import { useQuizGame } from "../../../../hooks/useQuizGame";
import type { Team } from "../../../../types/quiz";

/**
 * Команды «Своей игры»: счёт, ключи капитанов и правка состава — там же, где
 * идёт игра. Свёрнутая секция превращается в обычное табло.
 */
const QuizTeamsSection = () => {
  const { game, send, captainUrl } = useQuizGame();
  const active = game.activeQuestion;
  const answeringTeamId =
    game.phase === "answer"
      ? active?.buzzedTeamId
      : game.phase === "question"
        ? active?.soloTeamId
        : null;
  // «Кота» отдают сопернику: во время передачи кнопка на карточке заменяет
  // ручную смену хода.
  const transferring = game.phase === "transfer";

  const cardProps = (team: Team) => {
    const locked = active?.lockedTeamIds.includes(team.id) ?? false;
    const answering = answeringTeamId === team.id;

    return {
      name: team.name,
      color: team.color,
      score: team.score,
      signed: true,
      dimmed: locked,
      highlighted: answering,
      badges: (
        <>
          {game.pickerTeamId === team.id && <Badge tone="primary">Выбирает</Badge>}
          {answering && <Badge tone="success">Отвечает</Badge>}
          {locked && <Badge tone="neutral">Попытка использована</Badge>}
        </>
      ),
    };
  };

  return (
    <TeamsSection
      teams={game.teams}
      keyOf={(team) => team.id}
      addHint="Каждой команде выдаётся личный ключ: по нему капитан входит с телефона и жмёт на кнопку."
      onAdd={(name, color) => send({ type: "ADD_TEAM", name, color })}
      renderTeam={(team, collapsed) =>
        collapsed ? (
          <TeamCard {...cardProps(team)} size="md" />
        ) : (
          <TeamAdminCard
            {...cardProps(team)}
            joinKey={team.joinKey}
            inviteUrl={team.joinKey ? captainUrl(team.joinKey) : null}
            actions={
              transferring ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={team.id === active?.openerTeamId}
                  onClick={() => send({ type: "ASSIGN_SECRET", teamId: team.id })}
                >
                  Отдать «Кота»
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={game.pickerTeamId === team.id}
                  onClick={() => send({ type: "SET_PICKER", teamId: team.id })}
                >
                  Передать ход
                </Button>
              )
            }
            onSave={(name, color) =>
              send({ type: "UPDATE_TEAM", teamId: team.id, name, color })
            }
            onScore={(score) =>
              send({ type: "SET_TEAM_SCORE", teamId: team.id, score })
            }
            onRemove={() => send({ type: "REMOVE_TEAM", teamId: team.id })}
          />
        )
      }
    />
  );
};

export default QuizTeamsSection;
