import { ActivityService, streakFromDates } from './activity.service';

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

describe('activity reactions', () => {
  it('применяет отрицательную дельту через update, не вставляя отрицательное значение', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ author_user_id: '20' }] })
      .mockResolvedValueOnce({ rows: [{ reaction_count: 1 }] })
      .mockResolvedValue({ rows: [], rowCount: 1 });
    const database = {
      enabled: true,
      transaction: (work: (client: { query: typeof query }) => Promise<void>) => work({ query }),
    };
    const service = new ActivityService(database as never);

    await service.recordReaction(10, 30, 1_000, { id: 40 }, 0);

    const given = query.mock.calls[3];
    const received = query.mock.calls[4];
    expect(given[0]).toContain('GREATEST(0, $3)');
    expect(given[0]).toContain('activity_daily.reactions_given + $3');
    expect(given[1][2]).toBe(-1);
    expect(received[0]).toContain('activity_daily.reactions_received + $3');
    expect(received[1][2]).toBe(-1);
  });
});
