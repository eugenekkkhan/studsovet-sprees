import type {
  FinalCommand,
  FinalState,
  GameCoreState,
  StoredGameState,
} from '../types';
import { byScoreAscending, changeScore, teamById, teamName } from './selectors';
import { addLog, commit, toCore } from './state';

const MAX_FINAL_ANSWER = 300;

const themeNameById = (state: GameCoreState, themeId: string | null) =>
  state.final?.themes.find((theme) => theme.id === themeId)?.name ?? '—';

/** Темы убирают по очереди, начиная с аутсайдера. */
const nextRemover = (state: GameCoreState, final: FinalState) => {
  const order = byScoreAscending(state, final.participantIds);
  if (order.length === 0) return null;
  const current = final.turnTeamId ? order.indexOf(final.turnTeamId) : -1;
  return order[(current + 1) % order.length];
};

const startBets = (state: GameCoreState, final: FinalState) => {
  const playingThemeId =
    final.themes.find((theme) => !final.removedThemeIds.includes(theme.id))?.id ??
    null;
  return addLog(
    {
      ...state,
      phase: 'final-bets',
      final: { ...final, playingThemeId, turnTeamId: null },
    },
    `Финальная тема: «${themeNameById(state, playingThemeId)}». Команды делают ставки.`,
    'info',
  );
};

const announceResult = (state: GameCoreState) => {
  const ranked = [...state.teams].sort((left, right) => right.score - left.score);
  const winner = ranked[0] ?? null;
  const leaders = ranked.filter((team) => team.score === winner?.score);
  return addLog(
    { ...state, phase: 'game-over' },
    leaders.length > 1
      ? `Ничья: ${leaders.map((team) => `«${team.name}»`).join(', ')} — ${winner?.score ?? 0}. Нужна перестрелка.`
      : `Победа! «${winner?.name ?? '—'}» — ${winner?.score ?? 0}.`,
    'success',
  );
};

/** Финальный раунд: отбор, вычёркивание тем, ставки, ответы и вскрытие. */
export const applyFinalCommand = (
  state: StoredGameState,
  command: FinalCommand,
): StoredGameState | null => {
  const core = toCore(state);
  const final = core.final;

  switch (command.type) {
    case 'START_FINAL': {
      const themes = core.deck?.finalThemes ?? [];
      if (themes.length === 0 || core.teams.length === 0) return null;
      if (core.phase === 'question' || core.phase === 'answer') return null;

      // В финал идут только команды с положительным счётом.
      const participantIds = core.teams
        .filter((team) => team.score > 0)
        .map((team) => team.id);
      const base: GameCoreState = { ...core, activeQuestion: null, bidding: null };

      if (participantIds.length === 0) {
        return commit(
          state,
          addLog(
            { ...base, phase: 'game-over' },
            'В финал никто не проходит: ни у одной команды нет положительного счёта.',
            'danger',
          ),
        );
      }

      const fresh: FinalState = {
        themes: themes.map((theme) => ({ id: theme.id, name: theme.name })),
        removedThemeIds: [],
        playingThemeId: null,
        turnTeamId: byScoreAscending(core, participantIds)[0] ?? null,
        participantIds,
        bets: {},
        answers: {},
        revealedTeamIds: [],
        judgedTeamIds: [],
      };

      if (themes.length === 1) {
        return commit(state, startBets({ ...base, final: fresh }, fresh));
      }
      return commit(
        state,
        addLog(
          { ...base, phase: 'final-themes', final: fresh },
          `Финал. Играют команд: ${participantIds.length}. Тему убирает «${teamName(core, fresh.turnTeamId)}».`,
          'info',
        ),
      );
    }

    case 'FINAL_REMOVE_THEME': {
      if (core.phase !== 'final-themes' || !final) return null;
      if (
        !final.themes.some((theme) => theme.id === command.themeId) ||
        final.removedThemeIds.includes(command.themeId)
      ) {
        return null;
      }
      const removedThemeIds = [...final.removedThemeIds, command.themeId];
      const removedName = themeNameById(core, command.themeId);
      const withRemoval: FinalState = { ...final, removedThemeIds };

      if (final.themes.length - removedThemeIds.length <= 1) {
        return commit(
          state,
          startBets(
            addLog({ ...core, final: withRemoval }, `Тема «${removedName}» убрана.`),
            withRemoval,
          ),
        );
      }

      const turnTeamId = nextRemover(core, withRemoval);
      return commit(
        state,
        addLog(
          { ...core, final: { ...withRemoval, turnTeamId } },
          `Тема «${removedName}» убрана. Убирает «${teamName(core, turnTeamId)}».`,
        ),
      );
    }

    case 'FINAL_BET': {
      if (core.phase !== 'final-bets' || !final) return null;
      const team = teamById(core, command.teamId);
      if (!team || !final.participantIds.includes(team.id)) return null;
      const amount = Math.round(command.amount);
      if (!Number.isFinite(amount) || amount < 1 || amount > team.score) return null;

      const bets = { ...final.bets, [team.id]: amount };
      const next: GameCoreState = { ...core, final: { ...final, bets } };
      if (!final.participantIds.every((id) => bets[id] !== undefined)) {
        return commit(state, addLog(next, `«${team.name}» сделала ставку.`), false);
      }
      return commit(
        state,
        addLog(
          { ...next, phase: 'final-answers' },
          'Ставки сделаны. Ведущий читает финальный вопрос.',
          'info',
        ),
      );
    }

    case 'FINAL_ANSWER': {
      if (core.phase !== 'final-answers' || !final) return null;
      const team = teamById(core, command.teamId);
      if (!team || !final.participantIds.includes(team.id)) return null;
      const answers = {
        ...final.answers,
        [team.id]: String(command.text ?? '')
          .trim()
          .slice(0, MAX_FINAL_ANSWER),
      };
      const next: GameCoreState = { ...core, final: { ...final, answers } };
      if (!final.participantIds.every((id) => answers[id] !== undefined)) {
        return commit(state, addLog(next, `«${team.name}» записала ответ.`), false);
      }
      return commit(
        state,
        addLog(
          { ...next, phase: 'final-reveal' },
          'Ответы записаны. Вскрываем — от меньшей суммы к большей.',
          'info',
        ),
      );
    }

    case 'FINAL_LOCK_ANSWERS': {
      if (core.phase !== 'final-answers' || !final) return null;
      return commit(
        state,
        addLog(
          { ...core, phase: 'final-reveal' },
          'Время вышло. Вскрываем ответы.',
          'warning',
        ),
      );
    }

    case 'FINAL_REVEAL_NEXT': {
      if (core.phase !== 'final-reveal' || !final) return null;
      const nextTeamId = byScoreAscending(core, final.participantIds).find(
        (id) => !final.revealedTeamIds.includes(id),
      );
      if (!nextTeamId) return null;
      return commit(
        state,
        addLog(
          {
            ...core,
            final: {
              ...final,
              revealedTeamIds: [...final.revealedTeamIds, nextTeamId],
            },
          },
          `Ответ команды «${teamName(core, nextTeamId)}»: ${final.answers[nextTeamId] || '—'}`,
        ),
      );
    }

    case 'FINAL_JUDGE': {
      if (core.phase !== 'final-reveal' || !final) return null;
      const team = teamById(core, command.teamId);
      if (
        !team ||
        !final.revealedTeamIds.includes(team.id) ||
        final.judgedTeamIds.includes(team.id)
      ) {
        return null;
      }
      const bet = final.bets[team.id] ?? 0;
      const judgedTeamIds = [...final.judgedTeamIds, team.id];
      const next: GameCoreState = {
        ...changeScore(core, team.id, command.correct ? bet : -bet),
        final: { ...final, judgedTeamIds },
      };
      const scored = addLog(
        next,
        command.correct
          ? `Верно! «${team.name}» +${bet}.`
          : `Неверно. «${team.name}» −${bet}.`,
        command.correct ? 'success' : 'danger',
      );

      const done = final.participantIds.every((id) => judgedTeamIds.includes(id));
      return commit(state, done ? announceResult(scored) : scored);
    }

    default:
      return null;
  }
};
