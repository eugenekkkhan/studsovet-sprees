import type {
  BiddingState,
  GameCoreState,
  GameSettings,
  StoredGameState,
  Team,
  TeamCommand,
} from '../types';
import { advanceBidding } from './bidding';
import { commit, toCore, type EngineContext } from './state';

const MAX_TEAMS = 12;
const DEFAULT_TEAM_COLOR = '#2563eb';
/** Потолок ручной правки счёта: дальше начинает разъезжаться вёрстка табло. */
const MAX_SCORE = 1_000_000;

const isHexColor = (value: string) => /^#[\da-f]{6}$/i.test(value);

const sameName = (left: string, right: string) =>
  left.toLocaleLowerCase('ru-RU') === right.toLocaleLowerCase('ru-RU');

const withoutKey = <T>(source: Record<string, T>, key: string) =>
  Object.fromEntries(Object.entries(source).filter(([id]) => id !== key));

/**
 * Убирает команду отовсюду, где движок держит ссылку на неё. Без этого
 * удаление посреди вопроса оставляет висящий id, и судейство упирается
 * в несуществующую команду, а ведущий не может ни засчитать, ни снять.
 */
const forgetTeam = (core: GameCoreState, teamId: string): GameCoreState => {
  const teams = core.teams.filter((team) => team.id !== teamId);
  const fallbackId = teams[0]?.id ?? null;
  const alive = (id: string | null) =>
    id !== null && teams.some((team) => team.id === id);

  const active = core.activeQuestion;
  const base: GameCoreState = {
    ...core,
    teams,
    pickerTeamId: core.pickerTeamId === teamId ? fallbackId : core.pickerTeamId,
    // Клетка остаётся сыгранной, но победитель больше не существует.
    questionOutcomes: Object.fromEntries(
      Object.entries(core.questionOutcomes).map(([questionId, winnerId]) => [
        questionId,
        winnerId === teamId ? null : winnerId,
      ]),
    ),
    activeQuestion: active
      ? {
          ...active,
          openerTeamId:
            active.openerTeamId === teamId ? fallbackId : active.openerTeamId,
          // Игравший в одиночку выбыл — вопрос снова общий, решает ведущий.
          soloTeamId: active.soloTeamId === teamId ? null : active.soloTeamId,
          buzzedTeamId: active.buzzedTeamId === teamId ? null : active.buzzedTeamId,
          buzzOpen: active.buzzedTeamId === teamId ? false : active.buzzOpen,
          lockedTeamIds: active.lockedTeamIds.filter((id) => id !== teamId),
          falseStartUntil: withoutKey(active.falseStartUntil, teamId),
        }
      : null,
    final: core.final
      ? {
          ...core.final,
          participantIds: core.final.participantIds.filter((id) => id !== teamId),
          bets: withoutKey(core.final.bets, teamId),
          answers: withoutKey(core.final.answers, teamId),
          revealedTeamIds: core.final.revealedTeamIds.filter((id) => id !== teamId),
          judgedTeamIds: core.final.judgedTeamIds.filter((id) => id !== teamId),
          turnTeamId:
            core.final.turnTeamId === teamId ? null : core.final.turnTeamId,
        }
      : null,
  };

  // Ответивший выбыл — судить некого, возвращаем ведущего к чтению вопроса.
  const withPhase: GameCoreState =
    base.phase === 'answer' && !alive(base.activeQuestion?.buzzedTeamId ?? null)
      ? { ...base, phase: 'question' }
      : base;

  if (!core.bidding) return withPhase;

  const wasLeader = core.bidding.highestTeamId === teamId;
  const bidding: BiddingState = {
    ...core.bidding,
    // Ушедший лидер уносит свою ставку — цена возвращается к номиналу.
    highestBid: wasLeader ? core.bidding.nominal : core.bidding.highestBid,
    highestTeamId: wasLeader ? null : core.bidding.highestTeamId,
    allIn: wasLeader ? false : core.bidding.allIn,
    passedTeamIds: core.bidding.passedTeamIds.filter((id) => id !== teamId),
    turnTeamId: null,
  };

  // Ни лидера, ни открывшего — присуждать аукцион некому, снимаем вопрос.
  if (!alive(bidding.highestTeamId) && !alive(bidding.openerTeamId)) {
    return { ...withPhase, phase: 'board', activeQuestion: null, bidding: null };
  }
  return advanceBidding({ ...withPhase, bidding }, bidding);
};

/** Состав команд, ручная правка счёта и настройки правил. */
export const applyTeamCommand = (
  state: StoredGameState,
  command: TeamCommand,
  context: EngineContext,
): StoredGameState | null => {
  const core = toCore(state);

  switch (command.type) {
    case 'ADD_TEAM': {
      const name = command.name.trim().slice(0, 60);
      if (
        !name ||
        core.teams.length >= MAX_TEAMS ||
        core.teams.some((team) => sameName(team.name, name))
      ) {
        return null;
      }
      const team: Team = {
        ...context.createTeamIdentity(),
        name,
        color: isHexColor(command.color) ? command.color : DEFAULT_TEAM_COLOR,
        score: 0,
      };
      return commit(state, {
        ...core,
        teams: [...core.teams, team],
        pickerTeamId: core.pickerTeamId ?? team.id,
      });
    }

    case 'REMOVE_TEAM': {
      if (!core.teams.some((team) => team.id === command.teamId)) return null;
      return commit(state, forgetTeam(core, command.teamId));
    }

    case 'UPDATE_TEAM': {
      const name = command.name.trim().slice(0, 60);
      if (
        !name ||
        !core.teams.some((team) => team.id === command.teamId) ||
        core.teams.some(
          (team) => team.id !== command.teamId && sameName(team.name, name),
        )
      ) {
        return null;
      }
      return commit(state, {
        ...core,
        teams: core.teams.map((team) =>
          team.id === command.teamId
            ? {
                ...team,
                name,
                color: isHexColor(command.color) ? command.color : team.color,
              }
            : team,
        ),
      });
    }

    case 'SET_TEAM_SCORE': {
      if (
        !Number.isFinite(command.score) ||
        !core.teams.some((team) => team.id === command.teamId)
      ) {
        return null;
      }
      const score = Math.max(
        -MAX_SCORE,
        Math.min(MAX_SCORE, Math.round(command.score)),
      );
      return commit(state, {
        ...core,
        teams: core.teams.map((team) =>
          team.id === command.teamId ? { ...team, score } : team,
        ),
      });
    }

    case 'SET_SETTINGS': {
      const patch = command.settings ?? {};
      const settings: GameSettings = {
        penalty:
          typeof patch.penalty === 'boolean' ? patch.penalty : core.settings.penalty,
        falseStartLockMs: Number.isFinite(patch.falseStartLockMs)
          ? Math.min(10000, Math.max(0, Math.round(Number(patch.falseStartLockMs))))
          : core.settings.falseStartLockMs,
        bidStep: Number.isFinite(patch.bidStep)
          ? Math.min(1000, Math.max(1, Math.round(Number(patch.bidStep))))
          : core.settings.bidStep,
      };
      return commit(state, { ...core, settings });
    }

    default:
      return null;
  }
};
