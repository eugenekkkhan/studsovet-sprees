import { createLimiter } from './rate-limit';

describe('скользящее окно лимитера', () => {
  const START = 1_700_000_000_000;
  let clock: jest.SpyInstance<number, []>;

  beforeEach(() => {
    clock = jest.spyOn(Date, 'now').mockReturnValue(START);
  });

  afterEach(() => {
    clock.mockRestore();
  });

  it('пропускает разрешённое число обращений и отбивает лишнее', () => {
    const limiter = createLimiter({ points: 3, windowMs: 1000 });
    expect([limiter.hit('a'), limiter.hit('a'), limiter.hit('a')]).toEqual([
      true,
      true,
      true,
    ]);
    expect(limiter.hit('a')).toBe(false);
  });

  it('после окна счёт начинается заново', () => {
    const limiter = createLimiter({ points: 2, windowMs: 1000 });
    limiter.hit('a');
    limiter.hit('a');
    expect(limiter.hit('a')).toBe(false);

    clock.mockReturnValue(START + 1001);
    expect(limiter.hit('a')).toBe(true);
  });

  it('окно скользит, а не сбрасывается разом', () => {
    const limiter = createLimiter({ points: 2, windowMs: 1000 });
    limiter.hit('a');
    clock.mockReturnValue(START + 600);
    limiter.hit('a');
    expect(limiter.hit('a')).toBe(false);

    // Прошла первая отметка, но не вторая — место освободилось ровно одно.
    clock.mockReturnValue(START + 1001);
    expect(limiter.hit('a')).toBe(true);
    expect(limiter.hit('a')).toBe(false);
  });

  it('ключи не мешают друг другу', () => {
    const limiter = createLimiter({ points: 1, windowMs: 1000 });
    expect(limiter.hit('a')).toBe(true);
    expect(limiter.hit('b')).toBe(true);
    expect(limiter.hit('a')).toBe(false);
  });

  it('забытый ключ начинает с нуля', () => {
    const limiter = createLimiter({ points: 1, windowMs: 1000 });
    limiter.hit('a');
    expect(limiter.hit('a')).toBe(false);
    limiter.forget('a');
    expect(limiter.hit('a')).toBe(true);
    expect(limiter.size).toBe(1);
  });
});
