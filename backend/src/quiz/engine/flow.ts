import { normalizeDeck } from '../deck';
import type { FlowCommand, StoredGameState } from '../types';
import { byScoreAscending, teamById, teamName } from './selectors';
import { addLog, commit, toCore, undo } from './state';

const BLOCKED_WHILE_PLAYING = ['question', 'answer', 'bidding', 'transfer'] as const;

/** Колода, начало и конец раунда, сброс игры, отмена последнего шага. */
export const applyFlowCommand = (
  state: StoredGameState,
  command: FlowCommand,
): StoredGameState | null => {
  const core = toCore(state);

  switch (command.type) {
    case 'LOAD_DECK': {
      const deck = normalizeDeck(command.deck);
      if (!deck) return null;
      return commit(
        state,
        addLog(
          {
            ...core,
            deck,
            phase: 'lobby',
            roundIndex: -1,
            playedQuestionIds: [],
            questionOutcomes: {},
            activeQuestion: null,
            bidding: null,
            final: null,
          },
          `Колода «${deck.name}» загружена: раундов — ${deck.rounds.length}, финальных тем — ${deck.finalThemes.length}.`,
          'success',
        ),
      );
    }

    case 'START_ROUND': {
      const target = core.deck?.rounds[command.roundIndex];
      if (
        !target ||
        core.teams.length === 0 ||
        BLOCKED_WHILE_PLAYING.some((phase) => phase === core.phase)
      ) {
        return null;
      }
      // Первый раунд начинает выбранная ведущим команда, дальше — аутсайдер.
      const first =
        command.roundIndex === 0
          ? (teamById(core, core.pickerTeamId)?.id ?? core.teams[0].id)
          : byScoreAscending(
              core,
              core.teams.map((team) => team.id),
            )[0];
      return commit(
        state,
        addLog(
          {
            ...core,
            phase: 'board',
            roundIndex: command.roundIndex,
            playedQuestionIds: [],
            questionOutcomes: {},
            activeQuestion: null,
            bidding: null,
            final: null,
            pickerTeamId: first,
          },
          `${target.name}. Выбирает команда «${teamName(core, first)}».`,
          'info',
        ),
      );
    }

    case 'SET_PICKER': {
      if (!core.teams.some((team) => team.id === command.teamId)) return null;
      return commit(
        state,
        addLog(
          { ...core, pickerTeamId: command.teamId },
          `Выбирает команда «${teamName(core, command.teamId)}».`,
        ),
      );
    }

    case 'END_ROUND': {
      if (core.phase === 'lobby' || core.phase === 'game-over') return null;
      return commit(
        state,
        addLog(
          {
            ...core,
            phase: 'round-over',
            activeQuestion: null,
            bidding: null,
            // Прерванный финал не должен продолжать проецироваться на табло.
            final: null,
          },
          'Раунд завершён ведущим.',
          'warning',
        ),
      );
    }

    case 'NEW_GAME': {
      return commit(
        state,
        addLog(
          {
            ...core,
            teams: core.teams.map((team) => ({ ...team, score: 0 })),
            phase: 'lobby',
            roundIndex: -1,
            playedQuestionIds: [],
            questionOutcomes: {},
            activeQuestion: null,
            bidding: null,
            final: null,
            pickerTeamId: core.teams[0]?.id ?? null,
          },
          'Новая игра: счёт обнулён, табло очищено.',
          'info',
        ),
      );
    }

    case 'UNDO':
      return undo(state);

    default:
      return null;
  }
};
