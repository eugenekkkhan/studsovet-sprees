import type {
  BiddingCommand,
  BiddingState,
  GameCoreState,
  StoredGameState,
} from '../types';
import { byScoreAscending, teamById, teamName } from './selectors';
import { addLog, commit, toCore } from './state';

/** Первая ставка открывшего клетку: пасовать он не имеет права. */
export const openingBid = (
  questionId: string,
  openerTeamId: string,
  nominal: number,
): BiddingState => ({
  questionId,
  nominal,
  openerTeamId,
  turnTeamId: null,
  highestBid: nominal,
  highestTeamId: openerTeamId,
  allIn: false,
  passedTeamIds: [],
});

/**
 * Слово получает команда с наименьшей суммой из тех, кто ещё может перебить
 * текущую ставку. Пас окончателен, поэтому пасовавшие в отбор не попадают.
 */
const nextBidderId = (state: GameCoreState, bidding: BiddingState) => {
  const eligible = state.teams
    .filter(
      (team) =>
        team.id !== bidding.highestTeamId &&
        !bidding.passedTeamIds.includes(team.id) &&
        team.score > bidding.highestBid,
    )
    .map((team) => team.id);
  return byScoreAscending(state, eligible)[0] ?? null;
};

/** Торги закончились — вопрос уходит назначившему высшую цену. */
const settleBidding = (state: GameCoreState, bidding: BiddingState) => {
  const active = state.activeQuestion;
  if (!active) return state;
  const winnerId = bidding.highestTeamId ?? bidding.openerTeamId;
  return addLog(
    {
      ...state,
      phase: 'question',
      bidding: null,
      activeQuestion: { ...active, price: bidding.highestBid, soloTeamId: winnerId },
    },
    `Аукцион за ${bidding.highestBid} выиграла команда «${teamName(state, winnerId)}». Тема: ${active.themeName}.`,
    'info',
  );
};

export const advanceBidding = (state: GameCoreState, bidding: BiddingState) => {
  const turnTeamId = nextBidderId(state, bidding);
  if (!turnTeamId) return settleBidding(state, bidding);
  return { ...state, bidding: { ...bidding, turnTeamId } };
};

export const applyBiddingCommand = (
  state: StoredGameState,
  command: BiddingCommand,
): StoredGameState | null => {
  const core = toCore(state);
  const bidding = core.bidding;
  if (core.phase !== 'bidding' || !bidding) return null;
  if (bidding.turnTeamId !== command.teamId) return null;
  const team = teamById(core, command.teamId);
  if (!team) return null;

  if (command.action === 'pass') {
    const next: BiddingState = {
      ...bidding,
      passedTeamIds: [...bidding.passedTeamIds, team.id],
      turnTeamId: null,
    };
    return commit(
      state,
      advanceBidding(
        addLog({ ...core, bidding: next }, `«${team.name}» — пас.`),
        next,
      ),
    );
  }

  const amount =
    command.action === 'all-in' ? team.score : Math.round(command.amount);
  const allIn = command.action === 'all-in' || amount >= team.score;
  if (
    !Number.isFinite(amount) ||
    amount <= bidding.highestBid ||
    amount > team.score ||
    // Ва-банк перебивается только бо́льшим ва-банком.
    (bidding.allIn && !allIn) ||
    (!allIn && amount % core.settings.bidStep !== 0)
  ) {
    return null;
  }

  const next: BiddingState = {
    ...bidding,
    highestBid: amount,
    highestTeamId: team.id,
    allIn,
    turnTeamId: null,
  };
  return commit(
    state,
    advanceBidding(
      addLog(
        { ...core, bidding: next },
        allIn
          ? `«${team.name}» идёт ва-банк: ${amount}.`
          : `«${team.name}» ставит ${amount}.`,
        'warning',
      ),
      next,
    ),
  );
};
