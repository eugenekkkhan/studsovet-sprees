import type { HostCommand, ParticipantCommand } from './types';

const text = (value: unknown, limit: number) => String(value ?? '').slice(0, limit);

const PARTICIPANT_TYPES: ReadonlyArray<ParticipantCommand['type']> = [
  'PICK_QUESTION',
  'ASSIGN_SECRET',
  'PLACE_BID',
  'BUZZ',
  'FINAL_REMOVE_THEME',
  'FINAL_BET',
  'FINAL_ANSWER',
];

/** Разбор недоверенного сообщения из сокета в команду движка. */
export const parseHostCommand = (value: unknown): HostCommand | null => {
  if (!value || typeof value !== 'object') return null;
  const command = value as Record<string, unknown>;

  switch (command.type) {
    case 'ADD_TEAM':
      return {
        type: command.type,
        name: text(command.name, 60),
        color: text(command.color, 9),
      };
    case 'UPDATE_TEAM':
      return {
        type: command.type,
        teamId: text(command.teamId, 64),
        name: text(command.name, 60),
        color: text(command.color, 9),
      };
    case 'REMOVE_TEAM':
    case 'SET_PICKER':
    case 'ASSIGN_SECRET':
    case 'BUZZ':
      return { type: command.type, teamId: text(command.teamId, 64) };
    case 'SET_TEAM_SCORE':
      return {
        type: command.type,
        teamId: text(command.teamId, 64),
        score: Number(command.score),
      };
    case 'SET_SETTINGS': {
      const patch = (command.settings ?? {}) as Record<string, unknown>;
      return {
        type: command.type,
        settings: {
          ...(typeof patch.penalty === 'boolean' ? { penalty: patch.penalty } : {}),
          ...(patch.falseStartLockMs === undefined
            ? {}
            : { falseStartLockMs: Number(patch.falseStartLockMs) }),
          ...(patch.bidStep === undefined ? {} : { bidStep: Number(patch.bidStep) }),
        },
      };
    }
    case 'LOAD_DECK':
      return { type: command.type, deck: command.deck };
    case 'START_ROUND':
      return { type: command.type, roundIndex: Number(command.roundIndex) };
    case 'PICK_QUESTION':
      return { type: command.type, questionId: text(command.questionId, 64) };
    case 'PLACE_BID':
      return {
        type: command.type,
        teamId: text(command.teamId, 64),
        action:
          command.action === 'pass' || command.action === 'all-in'
            ? command.action
            : 'bid',
        amount: Number(command.amount),
      };
    case 'SET_BUZZ':
      return { type: command.type, open: command.open === true };
    case 'JUDGE':
      return { type: command.type, correct: command.correct === true };
    case 'FINAL_REMOVE_THEME':
      return { type: command.type, themeId: text(command.themeId, 64) };
    case 'FINAL_BET':
      return {
        type: command.type,
        teamId: text(command.teamId, 64),
        amount: Number(command.amount),
      };
    case 'FINAL_ANSWER':
      return {
        type: command.type,
        teamId: text(command.teamId, 64),
        text: text(command.text, 300),
      };
    case 'FINAL_JUDGE':
      return {
        type: command.type,
        teamId: text(command.teamId, 64),
        correct: command.correct === true,
      };
    case 'NO_ANSWER':
    case 'CLOSE_QUESTION':
    case 'END_ROUND':
    case 'START_FINAL':
    case 'FINAL_LOCK_ANSWERS':
    case 'FINAL_REVEAL_NEXT':
    case 'NEW_GAME':
    case 'UNDO':
      return { type: command.type };
    default:
      return null;
  }
};

/** То же, но с отсевом всего, что капитану не положено. */
export const parseParticipantCommand = (
  value: unknown,
): ParticipantCommand | null => {
  const command = parseHostCommand(value);
  if (!command) return null;
  return PARTICIPANT_TYPES.some((type) => type === command.type)
    ? (command as ParticipantCommand)
    : null;
};
