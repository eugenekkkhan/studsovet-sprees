import { roundPrices } from '../deck';
import { currentRound, finalQuestion } from '../engine';
import type {
  GameSession,
  HostGameState,
  PublicActiveQuestion,
  PublicBoard,
  PublicFinalState,
  PublicGameState,
  StoredGameState,
} from '../types';

/**
 * Проекция ведущего: полное состояние плюс доступность отмены.
 * `serverNow` нужен клиенту, чтобы считать блокировку фальстарта по часам
 * сервера, а не телефона: расхождение в пару секунд ломает отсчёт.
 */
export const toHostState = (session: GameSession): HostGameState => {
  const { undoStack, revision, ...game } = session.game;
  return {
    ...game,
    undoAvailable: undoStack.length > 0,
    revision,
    serverNow: Date.now(),
  };
};

const toBoard = (game: StoredGameState): PublicBoard | null => {
  const round = currentRound(game);
  if (!round) return null;
  const played = new Set(game.playedQuestionIds);

  return {
    roundId: round.id,
    roundName: round.name,
    roundIndex: game.roundIndex,
    roundCount: game.deck?.rounds.length ?? 0,
    prices: roundPrices(round),
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

const toActiveQuestion = (game: StoredGameState): PublicActiveQuestion | null => {
  const active = game.activeQuestion;
  if (!active) return null;
  // Пока «Кота» не передали, тема и цена ещё не объявлены; на торгах текст молчит.
  const secretHidden = game.phase === 'transfer';
  const textHidden = game.phase === 'transfer' || game.phase === 'bidding';

  return {
    questionId: active.questionId,
    themeName: secretHidden ? 'Кот в мешке' : active.themeName,
    type: active.type,
    price: secretHidden ? 0 : active.price,
    text: textHidden ? '' : active.text,
    media: textHidden ? null : active.media,
    answer: active.answerRevealed ? active.answer : null,
    answerMedia: active.answerRevealed ? active.answerMedia : null,
    openerTeamId: active.openerTeamId,
    soloTeamId: active.soloTeamId,
    buzzOpen: active.buzzOpen,
    buzzedTeamId: active.buzzedTeamId,
    lockedTeamIds: active.lockedTeamIds,
    falseStartUntil: active.falseStartUntil,
    answerRevealed: active.answerRevealed,
  };
};

const toFinal = (game: StoredGameState): PublicFinalState | null => {
  const final = game.final;
  if (!final) return null;
  const question = finalQuestion(game);
  const afterAnswers = game.phase === 'final-reveal' || game.phase === 'game-over';
  const questionVisible = game.phase === 'final-answers' || afterAnswers;
  const revealed = new Set(final.revealedTeamIds);
  const onlyRevealed = <T>(source: Record<string, T>) =>
    Object.fromEntries(
      Object.entries(source).filter(([teamId]) => revealed.has(teamId)),
    );

  return {
    themes: final.themes,
    removedThemeIds: final.removedThemeIds,
    playingThemeId: final.playingThemeId,
    playingThemeName: question?.name ?? null,
    turnTeamId: final.turnTeamId,
    participantIds: final.participantIds,
    question: questionVisible ? (question?.text ?? null) : null,
    media: questionVisible ? (question?.media ?? null) : null,
    answer: afterAnswers ? (question?.answer ?? null) : null,
    answerMedia: afterAnswers ? (question?.answerMedia ?? null) : null,
    betPlacedTeamIds: Object.keys(final.bets),
    answerPlacedTeamIds: Object.keys(final.answers),
    revealedTeamIds: final.revealedTeamIds,
    judgedTeamIds: final.judgedTeamIds,
    bets: onlyRevealed(final.bets),
    answers: onlyRevealed(final.answers),
  };
};

/** Проекция для табло и капитанов: без ответов и без нераскрытых клеток. */
export const toPublicState = (session: GameSession): PublicGameState => {
  const game = session.game;
  return {
    deckName: game.deck?.name ?? null,
    // Ключи капитанов остаются только в проекции ведущего.
    teams: game.teams.map((team) => ({
      id: team.id,
      name: team.name,
      color: team.color,
      score: team.score,
    })),
    phase: game.phase,
    board: toBoard(game),
    pickerTeamId: game.pickerTeamId,
    activeQuestion: toActiveQuestion(game),
    bidding: game.bidding,
    final: toFinal(game),
    settings: game.settings,
    statusMessage: game.statusMessage,
    statusTone: game.statusTone,
    history: game.history,
    revision: game.revision,
    serverNow: Date.now(),
  };
};
