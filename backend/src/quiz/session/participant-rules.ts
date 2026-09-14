import type { HostCommand, ParticipantCommand, StoredGameState } from '../types';

/**
 * Капитан действует только за свою команду и только когда его очередь.
 * Возвращает текст отказа или null, если действие допустимо.
 */
export const denyParticipantCommand = (
  game: StoredGameState,
  teamId: string,
  command: ParticipantCommand,
): string | null => {
  switch (command.type) {
    case 'PICK_QUESTION':
      if (game.phase !== 'board') return 'Сейчас нельзя выбирать вопрос.';
      return game.pickerTeamId === teamId ? null : 'Выбирает другая команда.';

    case 'ASSIGN_SECRET':
      if (game.phase !== 'transfer') return 'Кот сейчас не разыгрывается.';
      return game.activeQuestion?.openerTeamId === teamId
        ? null
        : 'Кота передаёт другая команда.';

    case 'PLACE_BID':
      if (game.phase !== 'bidding') return 'Торги не идут.';
      return game.bidding?.turnTeamId === teamId ? null : 'Сейчас не ваша ставка.';

    case 'BUZZ':
      return game.phase === 'question' ? null : 'Кнопка сейчас не работает.';

    case 'FINAL_REMOVE_THEME':
      if (game.phase !== 'final-themes') return 'Темы сейчас не убирают.';
      return game.final?.turnTeamId === teamId
        ? null
        : 'Сейчас убирает другая команда.';

    case 'FINAL_BET':
      return game.phase === 'final-bets' ? null : 'Ставки сейчас не принимаются.';

    case 'FINAL_ANSWER':
      return game.phase === 'final-answers' ? null : 'Ответы сейчас не принимаются.';

    default:
      return 'Неизвестная команда.';
  }
};

/**
 * Достраивает команду капитана до команды движка. В большинстве команд `teamId`
 * означает отправителя, и его подставляет сервер; у «Кота» это, наоборот,
 * адресат передачи, поэтому пришедшее значение остаётся как есть.
 */
export const toEngineCommand = (
  command: ParticipantCommand,
  teamId: string,
): HostCommand => {
  switch (command.type) {
    case 'ASSIGN_SECRET':
    case 'PICK_QUESTION':
    case 'FINAL_REMOVE_THEME':
      return command;
    default:
      return { ...command, teamId };
  }
};
