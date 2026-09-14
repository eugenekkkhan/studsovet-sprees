import { countQuestions } from '../deck';
import type { DeckRound, GameCoreState, Team } from '../types';

export const teamById = (state: GameCoreState, teamId: string | null) =>
  state.teams.find((team) => team.id === teamId) ?? null;

export const teamName = (state: GameCoreState, teamId: string | null) =>
  teamById(state, teamId)?.name ?? '—';

export const changeScore = (
  state: GameCoreState,
  teamId: string,
  amount: number,
): GameCoreState => ({
  ...state,
  teams: state.teams.map((team) =>
    team.id === teamId ? { ...team, score: team.score + amount } : team,
  ),
});

export const currentRound = (state: GameCoreState): DeckRound | null =>
  state.deck?.rounds[state.roundIndex] ?? null;

export const remainingQuestions = (state: GameCoreState) => {
  const round = currentRound(state);
  if (!round) return 0;
  const played = new Set(state.playedQuestionIds);
  const opened = round.themes
    .flatMap((theme) => theme.questions)
    .filter((question) => played.has(question.id)).length;
  return countQuestions(round) - opened;
};

/** Порядок хода в правилах везде один — от меньшей суммы к большей. */
export const byScoreAscending = (state: GameCoreState, teamIds: string[]) =>
  teamIds
    .map((id) => teamById(state, id))
    .filter((team): team is Team => team !== null)
    .sort(
      (left, right) =>
        left.score - right.score || left.name.localeCompare(right.name, 'ru'),
    )
    .map((team) => team.id);

/** Финальный вопрос выбранной темы — нужен и движку, и проекции. */
export const finalQuestion = (state: GameCoreState) => {
  const themeId = state.final?.playingThemeId;
  if (!themeId) return null;
  return state.deck?.finalThemes.find((theme) => theme.id === themeId) ?? null;
};
