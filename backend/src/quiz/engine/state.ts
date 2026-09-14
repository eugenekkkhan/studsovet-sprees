import type {
  Deck,
  GameCoreState,
  GameMessageTone,
  GameSettings,
  StoredGameState,
  Team,
} from '../types';

const MAX_UNDO_STEPS = 40;
const MAX_HISTORY_ENTRIES = 80;

export const DEFAULT_SETTINGS: GameSettings = {
  penalty: true,
  falseStartLockMs: 2000,
  bidStep: 100,
};

/** Всё, что нужно чистому редьюсеру из внешнего мира. */
export interface EngineContext {
  createTeamIdentity: () => Pick<Team, 'id' | 'joinKey'>;
  now: number;
}

export const createInitialGameState = (
  teams: Team[] = [],
  deck: Deck | null = null,
): StoredGameState => ({
  deck,
  teams,
  phase: 'lobby',
  roundIndex: -1,
  playedQuestionIds: [],
  questionOutcomes: {},
  pickerTeamId: teams[0]?.id ?? null,
  activeQuestion: null,
  bidding: null,
  final: null,
  settings: { ...DEFAULT_SETTINGS },
  statusMessage: 'Загрузите колоду, добавьте команды и начните первый раунд.',
  statusTone: 'info',
  history: [],
  undoStack: [],
  revision: 0,
});

export const toCore = (state: StoredGameState): GameCoreState => ({
  deck: state.deck,
  teams: state.teams,
  phase: state.phase,
  roundIndex: state.roundIndex,
  playedQuestionIds: state.playedQuestionIds,
  questionOutcomes: state.questionOutcomes,
  pickerTeamId: state.pickerTeamId,
  activeQuestion: state.activeQuestion,
  bidding: state.bidding,
  final: state.final,
  settings: state.settings,
  statusMessage: state.statusMessage,
  statusTone: state.statusTone,
  history: state.history,
});

/**
 * Записывает новое состояние. `checkpoint` управляет точкой отката: мелкие
 * шаги вроде нажатия кнопки в стек отмены не попадают.
 */
export const commit = (
  state: StoredGameState,
  core: GameCoreState,
  checkpoint = true,
): StoredGameState => ({
  ...core,
  undoStack: checkpoint
    ? [...state.undoStack, toCore(state)].slice(-MAX_UNDO_STEPS)
    : state.undoStack,
  revision: state.revision + 1,
});

export const undo = (state: StoredGameState): StoredGameState | null => {
  const previous = state.undoStack[state.undoStack.length - 1];
  if (!previous) return null;
  return {
    ...previous,
    undoStack: state.undoStack.slice(0, -1),
    revision: state.revision + 1,
  };
};

export const addLog = (
  state: GameCoreState,
  message: string,
  tone: GameMessageTone = 'info',
): GameCoreState => {
  const lastId = state.history[state.history.length - 1]?.id ?? 0;
  return {
    ...state,
    statusMessage: message,
    statusTone: tone,
    history: [...state.history, { id: lastId + 1, message, tone }].slice(
      -MAX_HISTORY_ENTRIES,
    ),
  };
};
