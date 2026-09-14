import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// DATA_DIR читается на загрузке модуля env — задаём до первого require.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'quiz-rooms-'));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { QuizService } = require('./quiz.service') as typeof import('./quiz.service');
type QuizService = InstanceType<typeof QuizService>;
import type { Team } from './types';

const HOUR = 60 * 60 * 1000;
const START = 1_700_000_000_000;

describe('QuizService: владение комнатой и уборка', () => {
  let service: QuizService;

  beforeEach(() => {
    service = new QuizService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('возвращает владельцу ту же комнату, а не плодит новые', () => {
    const first = service.createSession(42);
    const second = service.createSession(42);
    expect(first).not.toBeNull();
    expect(second?.code).toBe(first?.code);
    expect(service.roomCount).toBe(1);
  });

  it('другому пользователю достаётся своя комната и чужой токен ведущего не выдаётся', () => {
    const mine = service.createSession(42);
    const theirs = service.createSession(43);
    expect(theirs?.code).not.toBe(mine?.code);
    expect(theirs?.hostToken).not.toBe(mine?.hostToken);
    expect(theirs?.hostJoinKey).not.toBe(mine?.hostJoinKey);
    expect(service.roomCount).toBe(2);
  });

  it('без владельца каждый вызов открывает отдельную комнату', () => {
    // Режим разработки: привязывать анонимные комнаты не к чему.
    const first = service.createSession(null);
    const second = service.createSession(null);
    expect(second?.code).not.toBe(first?.code);
  });

  it('чужой токен ведущего не подходит к комнате', () => {
    const mine = service.createSession(42);
    const theirs = service.createSession(43);
    expect(service.getHostState(mine!.code, theirs!.hostToken)).toBeNull();
    expect(service.getHostState(mine!.code, mine!.hostToken)).not.toBeNull();
  });

  it('уборка выносит простоявшую комнату и не трогает живую', () => {
    // Часы под контролем: иначе «живую» комнату не отличить от брошенной —
    // обе были бы тронуты в один и тот же реальный момент.
    const clock = jest.spyOn(Date, 'now');
    clock.mockReturnValue(START);

    const idle = service.createSession(42);
    const busy = service.createSession(43);
    expect(service.roomCount).toBe(2);

    // Спустя шесть часов ведущий второй комнаты снова заходит в неё.
    clock.mockReturnValue(START + 6 * HOUR);
    service.getHostState(busy!.code, busy!.hostToken);

    // Ещё минута: первой комнатой не пользовались шесть часов и минуту.
    clock.mockReturnValue(START + 6 * HOUR + 60_000);
    service.sweep();

    expect(service.getPublicState(idle!.code)).toBeNull();
    expect(service.getPublicState(busy!.code)).not.toBeNull();
    clock.mockRestore();
  });

  it('после уборки владелец открывает новую комнату, а не упирается в удалённую', () => {
    const first = service.createSession(42);
    service.sweep(Date.now() + 6 * HOUR + 60_000);
    const second = service.createSession(42);
    expect(second).not.toBeNull();
    expect(second?.code).not.toBe(first?.code);
    expect(service.roomCount).toBe(1);
  });

  it('переносит команды прошлой комнаты, приводя счёт из строки', () => {
    const teams = [
      { name: 'Первые', score: '500' },
      { name: 'Вторые', score: 300 },
    ] as unknown as Array<Partial<Team>>;
    const created = service.createSession(42, teams);
    expect(created?.state.teams.map((team) => team.score)).toEqual([500, 300]);
    // Ключи капитанов выдаются сразу, не по первому чтению состояния.
    expect(created?.state.teams.every((team) => team.joinKey.length === 10)).toBe(true);
  });

  it('чтение состояния не двигает ревизию', () => {
    const created = service.createSession(42);
    const before = created!.state.revision;
    service.getPublicState(created!.code);
    service.getPublicState(created!.code);
    service.getHostStateForConnectedHost(created!.code);
    expect(service.getPublicState(created!.code)?.revision).toBe(before);
  });

  it('отбивает слишком тяжёлую колоду вместо разрыва сокета', () => {
    const created = service.createSession(42);
    const heavy = { name: 'Тяжёлая', rounds: [], finalThemes: [], filler: 'x'.repeat(3 * 1024 * 1024) };
    const result = service.runHostCommand(created!.code, { type: 'LOAD_DECK', deck: heavy });
    expect(result.changed).toBe(false);
    expect(result.error).toMatch(/тяжёлая/i);
  });
});

describe('QuizService: снимок комнаты переживает перезапуск', () => {
  it('после рестарта комната поднимается с прежним кодом и счётом', () => {
    const first = new QuizService();
    first.onModuleInit();
    const created = first.createSession(77, [
      { name: 'Альфа' },
      { name: 'Бета' },
    ] as Array<Partial<Team>>);
    const teamId = created!.state.teams[0].id;
    first.runHostCommand(created!.code, { type: 'SET_TEAM_SCORE', teamId, score: 700 });
    // Останов сервера дописывает отложенные снимки.
    first.onModuleDestroy();

    const second = new QuizService();
    second.onModuleInit();
    const restored = second.getHostState(created!.code, created!.hostToken);
    second.onModuleDestroy();

    expect(restored).not.toBeNull();
    // Код прежний — розданные капитанам ссылки и QR остаются рабочими.
    expect(restored!.teams.find((team) => team.id === teamId)?.score).toBe(700);
    // Ключи капитанов те же: иначе после рестарта пришлось бы раздавать заново.
    expect(restored!.teams.map((team) => team.joinKey)).toEqual(
      created!.state.teams.map((team) => team.joinKey),
    );
    expect(restored!.undoAvailable).toBe(false);
  });

  it('владелец после рестарта получает свою комнату, а не новую', () => {
    const first = new QuizService();
    first.onModuleInit();
    const created = first.createSession(88);
    first.onModuleDestroy();

    const second = new QuizService();
    second.onModuleInit();
    const again = second.createSession(88);
    second.onModuleDestroy();

    expect(again?.code).toBe(created?.code);
  });

  it('просроченные комнаты после рестарта не поднимаются', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(START);
    const first = new QuizService();
    first.onModuleInit();
    const created = first.createSession(99);
    first.onModuleDestroy();

    clock.mockReturnValue(START + 7 * HOUR);
    const second = new QuizService();
    second.onModuleInit();
    const restored = second.getPublicState(created!.code);
    second.onModuleDestroy();
    clock.mockRestore();

    expect(restored).toBeNull();
  });
});
