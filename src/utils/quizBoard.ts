import type { HostGameState, PublicBoard } from "../types/quiz";

/**
 * Табло для пульта ведущего. Капитаны и проектор получают такую же структуру
 * с сервера, а ведущий собирает её из своей колоды.
 */
export const boardFromHostState = (game: HostGameState): PublicBoard | null => {
  const round = game.deck?.rounds[game.roundIndex];
  if (!round) return null;
  const played = new Set(game.playedQuestionIds);

  return {
    roundId: round.id,
    roundName: round.name,
    roundIndex: game.roundIndex,
    roundCount: game.deck?.rounds.length ?? 0,
    prices: Array.from(
      new Set(
        round.themes.flatMap((theme) => theme.questions.map((item) => item.price)),
      ),
    ).sort((left, right) => left - right),
    remaining: round.themes
      .flatMap((theme) => theme.questions)
      .filter((question) => !played.has(question.id)).length,
    themes: round.themes.map((theme) => ({
      id: theme.id,
      name: theme.name,
      cells: theme.questions.map((question) => ({
        questionId: question.id,
        price: question.price,
        played: played.has(question.id),
        winnerTeamId: game.questionOutcomes[question.id] ?? null,
      })),
    })),
  };
};
