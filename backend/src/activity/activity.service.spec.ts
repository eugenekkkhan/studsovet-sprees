import { streakFromDates } from './activity.service';

describe('activity streak', () => {
  it('counts a streak including today across a month boundary', () => {
    expect(streakFromDates(
      ['2026-09-01', '2026-08-31', '2026-08-30'],
      '2026-09-01',
    )).toBe(3);
  });

  it('keeps the streak during the day after the last activity', () => {
    expect(streakFromDates(
      ['2026-01-01', '2025-12-31'],
      '2026-01-02',
    )).toBe(2);
  });

  it('resets after a fully missed day', () => {
    expect(streakFromDates(['2026-01-01'], '2026-01-03')).toBe(0);
  });
});
