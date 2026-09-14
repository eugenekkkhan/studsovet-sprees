import type { GameSettings } from './game';

export type HostCommand =
  | { type: 'ADD_TEAM'; name: string; color: string }
  | { type: 'REMOVE_TEAM'; teamId: string }
  | { type: 'UPDATE_TEAM'; teamId: string; name: string; color: string }
  | { type: 'SET_TEAM_SCORE'; teamId: string; score: number }
  | { type: 'SET_SETTINGS'; settings: Partial<GameSettings> }
  | { type: 'LOAD_DECK'; deck: unknown }
  | { type: 'START_ROUND'; roundIndex: number }
  | { type: 'SET_PICKER'; teamId: string }
  | { type: 'PICK_QUESTION'; questionId: string }
  | { type: 'ASSIGN_SECRET'; teamId: string }
  | {
      type: 'PLACE_BID';
      teamId: string;
      action: 'bid' | 'pass' | 'all-in';
      amount: number;
    }
  | { type: 'SET_BUZZ'; open: boolean }
  | { type: 'BUZZ'; teamId: string }
  | { type: 'JUDGE'; correct: boolean }
  | { type: 'NO_ANSWER' }
  | { type: 'CLOSE_QUESTION' }
  | { type: 'END_ROUND' }
  | { type: 'START_FINAL' }
  | { type: 'FINAL_REMOVE_THEME'; themeId: string }
  | { type: 'FINAL_BET'; teamId: string; amount: number }
  | { type: 'FINAL_ANSWER'; teamId: string; text: string }
  | { type: 'FINAL_LOCK_ANSWERS' }
  | { type: 'FINAL_REVEAL_NEXT' }
  | { type: 'FINAL_JUDGE'; teamId: string; correct: boolean }
  | { type: 'NEW_GAME' }
  | { type: 'UNDO' };

export type CommandOfType<T extends HostCommand['type']> = Extract<
  HostCommand,
  { type: T }
>;

/** Команды, обрабатываемые каждым модулем движка. */
export type TeamCommand = CommandOfType<
  'ADD_TEAM' | 'REMOVE_TEAM' | 'UPDATE_TEAM' | 'SET_TEAM_SCORE' | 'SET_SETTINGS'
>;

export type FlowCommand = CommandOfType<
  'LOAD_DECK' | 'START_ROUND' | 'SET_PICKER' | 'END_ROUND' | 'NEW_GAME' | 'UNDO'
>;

export type QuestionCommand = CommandOfType<
  'PICK_QUESTION' | 'ASSIGN_SECRET' | 'SET_BUZZ' | 'BUZZ'
>;

export type JudgeCommand = CommandOfType<'JUDGE' | 'NO_ANSWER' | 'CLOSE_QUESTION'>;

export type BiddingCommand = CommandOfType<'PLACE_BID'>;

export type FinalCommand = CommandOfType<
  | 'START_FINAL'
  | 'FINAL_REMOVE_THEME'
  | 'FINAL_BET'
  | 'FINAL_ANSWER'
  | 'FINAL_LOCK_ANSWERS'
  | 'FINAL_REVEAL_NEXT'
  | 'FINAL_JUDGE'
>;

/** Команды, которые капитан отправляет сам — всегда от имени своей команды. */
export type ParticipantCommand = CommandOfType<
  | 'PICK_QUESTION'
  | 'ASSIGN_SECRET'
  | 'PLACE_BID'
  | 'BUZZ'
  | 'FINAL_REMOVE_THEME'
  | 'FINAL_BET'
  | 'FINAL_ANSWER'
>;
