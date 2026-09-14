import { findQuestion } from '../deck';
import type {
  ActiveQuestion,
  DeckQuestion,
  DeckRound,
  DeckTheme,
  GameCoreState,
  QuestionCommand,
  StoredGameState,
} from '../types';
import { advanceBidding, openingBid } from './bidding';
import { currentRound, teamById, teamName } from './selectors';
import { addLog, commit, toCore, type EngineContext } from './state';

/** «Кот в мешке» может нести собственные тему и цену. */
const buildActiveQuestion = (
  round: DeckRound,
  theme: DeckTheme,
  question: DeckQuestion,
  openerTeamId: string,
): ActiveQuestion => ({
  roundId: round.id,
  themeId: theme.id,
  questionId: question.id,
  themeName:
    question.type === 'secret' && question.secretTheme
      ? question.secretTheme
      : theme.name,
  boardThemeName: theme.name,
  type: question.type,
  price:
    question.type === 'secret' && question.secretPrice !== null
      ? question.secretPrice
      : question.price,
  text: question.text,
  answer: question.answer,
  comment: question.comment,
  media: question.media,
  answerMedia: question.answerMedia,
  openerTeamId,
  soloTeamId: null,
  buzzOpen: false,
  buzzedTeamId: null,
  lockedTeamIds: [],
  falseStartUntil: {},
  answerRevealed: false,
});

const openQuestion = (
  state: StoredGameState,
  core: GameCoreState,
  round: DeckRound,
  questionId: string,
): StoredGameState | null => {
  const found = findQuestion(round, questionId);
  if (!found) return null;
  const openerId = core.pickerTeamId ?? core.teams[0]?.id ?? null;
  if (!openerId) return null;

  const opened = buildActiveQuestion(round, found.theme, found.question, openerId);
  const base: GameCoreState = {
    ...core,
    playedQuestionIds: [...core.playedQuestionIds, questionId],
    activeQuestion: opened,
  };

  switch (found.question.type) {
    case 'secret':
      return commit(
        state,
        addLog(
          { ...base, phase: 'transfer' },
          `«${teamName(core, openerId)}» открыла «Кота в мешке» и передаёт вопрос сопернику.`,
          'warning',
        ),
      );

    case 'stake': {
      const nominal = found.question.price;
      const bidding = openingBid(questionId, openerId, nominal);
      return commit(
        state,
        advanceBidding(
          addLog(
            { ...base, phase: 'bidding', bidding },
            `Аукцион! Тема «${found.theme.name}», номинал ${nominal}. За «${teamName(core, openerId)}» — ${nominal}.`,
            'warning',
          ),
          bidding,
        ),
      );
    }

    case 'norisk':
      return commit(
        state,
        addLog(
          {
            ...base,
            phase: 'question',
            activeQuestion: { ...opened, soloTeamId: openerId },
          },
          `Вопрос без риска за ${opened.price}: играет «${teamName(core, openerId)}», штрафа нет.`,
          'info',
        ),
      );

    default:
      return commit(
        state,
        addLog(
          { ...base, phase: 'question' },
          `${found.theme.name}, ${opened.price}. Вопрос читается.`,
          'info',
        ),
      );
  }
};

/** Открытие клетки, передача «Кота» и работа кнопки. */
export const applyQuestionCommand = (
  state: StoredGameState,
  command: QuestionCommand,
  context: EngineContext,
): StoredGameState | null => {
  const core = toCore(state);
  const active = core.activeQuestion;

  switch (command.type) {
    case 'PICK_QUESTION': {
      const round = currentRound(core);
      if (core.phase !== 'board' || !round) return null;
      if (core.playedQuestionIds.includes(command.questionId)) return null;
      return openQuestion(state, core, round, command.questionId);
    }

    case 'ASSIGN_SECRET': {
      if (core.phase !== 'transfer' || !active) return null;
      const target = teamById(core, command.teamId);
      if (!target) return null;
      // Отдать «Кота» самому себе можно только когда соперников нет вовсе.
      if (target.id === active.openerTeamId && core.teams.length > 1) return null;
      return commit(
        state,
        addLog(
          {
            ...core,
            phase: 'question',
            activeQuestion: { ...active, soloTeamId: target.id },
          },
          `«Кот в мешке» достаётся команде «${target.name}». Тема: ${active.themeName}, цена ${active.price}.`,
          'info',
        ),
      );
    }

    case 'SET_BUZZ': {
      if (core.phase !== 'question' || !active || active.soloTeamId) return null;
      if (active.buzzOpen === command.open) return null;
      return commit(
        state,
        addLog(
          { ...core, activeQuestion: { ...active, buzzOpen: command.open } },
          command.open ? 'Кнопки открыты.' : 'Кнопки закрыты.',
        ),
        false,
      );
    }

    case 'BUZZ': {
      if (core.phase !== 'question' || !active || active.soloTeamId) return null;
      const team = teamById(core, command.teamId);
      if (!team || active.buzzedTeamId) return null;
      if (active.lockedTeamIds.includes(team.id)) return null;
      if ((active.falseStartUntil[team.id] ?? 0) > context.now) return null;

      if (!active.buzzOpen) {
        return commit(
          state,
          addLog(
            {
              ...core,
              activeQuestion: {
                ...active,
                falseStartUntil: {
                  ...active.falseStartUntil,
                  [team.id]: context.now + core.settings.falseStartLockMs,
                },
              },
            },
            `Фальстарт: «${team.name}» нажала до сигнала.`,
            'warning',
          ),
          false,
        );
      }

      return commit(
        state,
        addLog(
          {
            ...core,
            phase: 'answer',
            activeQuestion: { ...active, buzzedTeamId: team.id, buzzOpen: false },
          },
          `Отвечает «${team.name}».`,
          'info',
        ),
        false,
      );
    }

    default:
      return null;
  }
};
