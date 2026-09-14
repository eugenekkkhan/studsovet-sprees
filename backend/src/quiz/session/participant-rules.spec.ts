import { createInitialGameState } from '../engine';
import type { StoredGameState, Team } from '../types';
import { denyParticipantCommand, toEngineCommand } from './participant-rules';

const team = (id: string): Team => ({
  id,
  name: `Команда ${id}`,
  color: '#2563eb',
  score: 0,
  joinKey: 'KEY1234567',
});

const stateOn = (patch: Partial<StoredGameState>): StoredGameState => ({
  ...createInitialGameState([team('a'), team('b')]),
  ...patch,
});

describe('права капитана', () => {
  it('не даёт выбирать вопрос вне своей очереди', () => {
    const game = stateOn({ phase: 'board', pickerTeamId: 'a' });
    expect(
      denyParticipantCommand(game, 'b', { type: 'PICK_QUESTION', questionId: 'q' }),
    ).toBe('Выбирает другая команда.');
    expect(
      denyParticipantCommand(game, 'a', { type: 'PICK_QUESTION', questionId: 'q' }),
    ).toBeNull();
  });

  it('передавать «Кота» разрешает только открывшей команде', () => {
    const game = stateOn({
      phase: 'transfer',
      activeQuestion: { openerTeamId: 'a' } as StoredGameState['activeQuestion'],
    });
    expect(
      denyParticipantCommand(game, 'b', { type: 'ASSIGN_SECRET', teamId: 'a' }),
    ).toBe('Кота передаёт другая команда.');
    expect(
      denyParticipantCommand(game, 'a', { type: 'ASSIGN_SECRET', teamId: 'b' }),
    ).toBeNull();
  });

  it('подставляет отправителя, но не трогает адресата «Кота»', () => {
    // teamId у ASSIGN_SECRET — это соперник, которому отдают вопрос.
    expect(toEngineCommand({ type: 'ASSIGN_SECRET', teamId: 'b' }, 'a')).toEqual({
      type: 'ASSIGN_SECRET',
      teamId: 'b',
    });
    expect(toEngineCommand({ type: 'BUZZ', teamId: 'подделка' }, 'a')).toEqual({
      type: 'BUZZ',
      teamId: 'a',
    });
    expect(
      toEngineCommand({ type: 'FINAL_BET', teamId: 'подделка', amount: 5 }, 'a'),
    ).toEqual({ type: 'FINAL_BET', teamId: 'a', amount: 5 });
  });
});
