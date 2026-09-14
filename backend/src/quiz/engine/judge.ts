import type {
  GameCoreState,
  GameMessageTone,
  JudgeCommand,
  StoredGameState,
} from '../types';
import { changeScore, remainingQuestions, teamById, teamName } from './selectors';
import { addLog, commit, toCore } from './state';

/**
 * Раскрывает ответ и назначает следующего выбирающего. Ход остаётся за
 * игравшим «Кота» или аукцион независимо от исхода, а на обычном вопросе
 * переходит к ответившему верно.
 */
const finishQuestion = (
  state: GameCoreState,
  winnerTeamId: string | null,
  message: string,
  tone: GameMessageTone,
): GameCoreState => {
  const active = state.activeQuestion;
  if (!active) return state;
  return addLog(
    {
      ...state,
      phase: 'reveal',
      pickerTeamId: active.soloTeamId ?? winnerTeamId ?? state.pickerTeamId,
      questionOutcomes: {
        ...state.questionOutcomes,
        [active.questionId]: winnerTeamId,
      },
      activeQuestion: {
        ...active,
        buzzOpen: false,
        buzzedTeamId: null,
        answerRevealed: true,
      },
    },
    message,
    tone,
  );
};

/** Судейство ответа, снятие вопроса и возврат на табло. */
export const applyJudgeCommand = (
  state: StoredGameState,
  command: JudgeCommand,
): StoredGameState | null => {
  const core = toCore(state);
  const active = core.activeQuestion;

  switch (command.type) {
    case 'JUDGE': {
      if (!active) return null;
      // Обычный вопрос судят по нажавшему кнопку, кота и аукцион — по игравшему.
      const targetId =
        core.phase === 'answer'
          ? active.buzzedTeamId
          : core.phase === 'question'
            ? active.soloTeamId
            : null;
      const target = teamById(core, targetId);
      // Команду удалили посреди вопроса: судить некого, но и застрять нельзя.
      if (!target) {
        if (core.phase !== 'answer' && core.phase !== 'question') return null;
        return commit(
          state,
          finishQuestion(
            core,
            null,
            'Отвечавшей команды больше нет. Вопрос снимается.',
            'warning',
          ),
        );
      }

      if (command.correct) {
        return commit(
          state,
          finishQuestion(
            changeScore(core, target.id, active.price),
            target.id,
            `Верно! «${target.name}» +${active.price}.`,
            'success',
          ),
        );
      }

      const penalized =
        core.settings.penalty && active.type !== 'norisk'
          ? changeScore(core, target.id, -active.price)
          : core;
      const penaltyNote =
        core.settings.penalty && active.type !== 'norisk' ? ` −${active.price}` : '';
      const lockedTeamIds = [...active.lockedTeamIds, target.id];
      const withAttempt: GameCoreState = {
        ...penalized,
        activeQuestion: { ...active, lockedTeamIds },
      };

      if (active.soloTeamId) {
        return commit(
          state,
          finishQuestion(
            withAttempt,
            null,
            `Неверно. «${target.name}»${penaltyNote}.`,
            'danger',
          ),
        );
      }

      const everyoneTried = core.teams.every((team) =>
        lockedTeamIds.includes(team.id),
      );
      if (everyoneTried) {
        return commit(
          state,
          finishQuestion(
            withAttempt,
            null,
            `Неверно. «${target.name}»${penaltyNote}. Больше отвечать некому.`,
            'danger',
          ),
        );
      }

      return commit(
        state,
        addLog(
          {
            ...withAttempt,
            phase: 'question',
            activeQuestion: {
              ...active,
              lockedTeamIds,
              buzzedTeamId: null,
              buzzOpen: true,
            },
          },
          `Неверно. «${target.name}»${penaltyNote}. Кнопки снова открыты.`,
          'danger',
        ),
      );
    }

    case 'NO_ANSWER': {
      if (!active || (core.phase !== 'question' && core.phase !== 'answer')) {
        return null;
      }
      return commit(
        state,
        finishQuestion(core, null, 'Ответа нет. Вопрос снимается.', 'warning'),
      );
    }

    case 'CLOSE_QUESTION': {
      if (core.phase !== 'reveal') return null;
      const cleared: GameCoreState = { ...core, activeQuestion: null, bidding: null };
      if (remainingQuestions(cleared) > 0) {
        return commit(
          state,
          addLog(
            { ...cleared, phase: 'board' },
            `Выбирает команда «${teamName(core, core.pickerTeamId)}».`,
          ),
        );
      }
      const isLastRound = core.roundIndex >= (core.deck?.rounds.length ?? 0) - 1;
      return commit(
        state,
        addLog(
          { ...cleared, phase: 'round-over' },
          isLastRound
            ? 'Раунд сыгран. Можно переходить к финалу.'
            : 'Раунд сыгран. Можно начинать следующий.',
          'success',
        ),
      );
    }

    default:
      return null;
  }
};
