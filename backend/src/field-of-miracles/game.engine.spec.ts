import {
  applyCommand,
  beginAuthoritativeSpin,
  createInitialGameState,
  settleAuthoritativeSpin,
} from './game.engine';
import type { SpinResult } from './types';

describe('field game engine', () => {
  it('accepts only the first letter command after a points spin', () => {
    const initial = createInitialGameState([
      {
        id: 'team-1',
        name: 'Команда',
        color: '#123456',
        points: 0,
        roundPoints: 0,
        joinKey: 'TEAMKEY234',
      },
    ]);
    const round = applyCommand(
      initial,
      { type: 'START_ROUND', category: '', clue: '', answer: 'МАМА' },
      () => ({ id: 'unused', joinKey: 'UNUSED2345' }),
    )!;
    const spin: SpinResult = {
      id: 'spin-1',
      seed: '00'.repeat(32),
      algorithm: 'sha256-v1',
      sectorId: 'sector-1',
      sectorIndex: 1,
      landingAngle: 25,
      startedAt: 1,
      durationMs: 4200,
      status: 'spinning',
    };
    const spinning = beginAuthoritativeSpin(round, spin)!;
    const awaitingLetter = settleAuthoritativeSpin(spinning, spin.id)!;
    expect(awaitingLetter.phase).toBe('awaiting-letter');

    const accepted = applyCommand(
      awaitingLetter,
      { type: 'GUESS_LETTER', letter: 'А' },
      () => ({ id: 'unused', joinKey: 'UNUSED2345' }),
    )!;
    expect(accepted.teams[0].points).toBe(1000);
    expect(accepted.phase).toBe('ready');
    expect(
      applyCommand(
        accepted,
        { type: 'GUESS_LETTER', letter: 'М' },
        () => ({ id: 'unused', joinKey: 'UNUSED2345' }),
      ),
    ).toBeNull();
  });
});
