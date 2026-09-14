import type { HostCommand, StoredGameState } from '../types';
import { applyBiddingCommand } from './bidding';
import { applyFinalCommand } from './final';
import { applyFlowCommand } from './flow';
import { applyJudgeCommand } from './judge';
import { applyQuestionCommand } from './question';
import { applyTeamCommand } from './teams';
import type { EngineContext } from './state';

export { createInitialGameState, DEFAULT_SETTINGS } from './state';
export type { EngineContext } from './state';
export { currentRound, finalQuestion } from './selectors';

/** Чистый переход состояния. Кому он разрешён, решает сервис. */
export const applyCommand = (
  state: StoredGameState,
  command: HostCommand,
  context: EngineContext,
): StoredGameState | null => {
  switch (command.type) {
    case 'ADD_TEAM':
    case 'REMOVE_TEAM':
    case 'UPDATE_TEAM':
    case 'SET_TEAM_SCORE':
    case 'SET_SETTINGS':
      return applyTeamCommand(state, command, context);

    case 'LOAD_DECK':
    case 'START_ROUND':
    case 'SET_PICKER':
    case 'END_ROUND':
    case 'NEW_GAME':
    case 'UNDO':
      return applyFlowCommand(state, command);

    case 'PICK_QUESTION':
    case 'ASSIGN_SECRET':
    case 'SET_BUZZ':
    case 'BUZZ':
      return applyQuestionCommand(state, command, context);

    case 'JUDGE':
    case 'NO_ANSWER':
    case 'CLOSE_QUESTION':
      return applyJudgeCommand(state, command);

    case 'PLACE_BID':
      return applyBiddingCommand(state, command);

    case 'START_FINAL':
    case 'FINAL_REMOVE_THEME':
    case 'FINAL_BET':
    case 'FINAL_ANSWER':
    case 'FINAL_LOCK_ANSWERS':
    case 'FINAL_REVEAL_NEXT':
    case 'FINAL_JUDGE':
      return applyFinalCommand(state, command);

    default:
      return null;
  }
};
