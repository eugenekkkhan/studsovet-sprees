import { courseMultiplier, urgencyMultiplier } from './rating.service';
import { RatingService } from './rating.service';
import type { CommunityEvent } from './types';

const eventWithLeadDays = (days: number) => ({
  createdAt: 1_000_000,
  startsAt: new Date(1_000_000 + days * 86_400_000).toISOString(),
} as CommunityEvent);

describe('формула рейтинга мероприятий', () => {
  it('не повышает обычный анонс и экспоненциально усиливает срочный', () => {
    expect(urgencyMultiplier(eventWithLeadDays(7))).toBe(1);
    expect(urgencyMultiplier(eventWithLeadDays(4))).toBeCloseTo(2);
    expect(urgencyMultiplier(eventWithLeadDays(1))).toBeCloseTo(4);
    expect(urgencyMultiplier(eventWithLeadDays(0))).toBe(4);
  });

  it('компенсирует старшим курсам нагрузку, но не выдумывает курс', () => {
    expect(courseMultiplier(null)).toBe(1);
    expect(courseMultiplier(1)).toBe(1);
    expect(courseMultiplier(4)).toBeCloseTo(1.15);
    expect(courseMultiplier(6)).toBeCloseTo(1.25);
  });

  it('начисляет legacy-событию нормализованную категорию other', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ course: null }] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const service = new RatingService(
      { enabled: true, query } as never,
      {} as never,
    );

    await service.award({
      id: '8c6d6a44-bfde-49fa-93c1-a5dbbc896bbc',
      title: 'Старое мероприятие',
      createdAt: 1_000_000,
      startsAt: new Date(1_000_000 + 8 * 86_400_000).toISOString(),
      attendance: [{ userId: 1, name: 'Участник', confirmedAt: 2_000_000 }],
    } as CommunityEvent);

    expect(query.mock.calls[1][1][3]).toBe('other');
    expect(query.mock.calls[1][1][4]).toBe(120);
  });
});
