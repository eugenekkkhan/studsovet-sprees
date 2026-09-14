import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// DATA_DIR читается на загрузке модуля env — задаём до первого require.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'field-rooms-'));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { FieldOfMiraclesService, spinFromSeed } =
  require('./field-of-miracles.service') as typeof import('./field-of-miracles.service');
type FieldOfMiraclesService = InstanceType<typeof FieldOfMiraclesService>;

describe('FieldOfMiraclesService', () => {
  it('keeps the answer out of the public projection', () => {
    const service = new FieldOfMiraclesService();
    const created = service.createSession(101, [
      { name: 'Красные', color: '#ef4444' },
    ]);
    const joinKey = created!.state.teams[0].joinKey;
    expect(created!.hostJoinKey).toHaveLength(12);
    expect(
      service.getHostStateByJoinKey(created!.code, created!.hostJoinKey),
    ).not.toBeNull();
    expect(service.getHostStateByJoinKey(created!.code, 'WRONGKEY2345')).toBeNull();
    expect(joinKey).toHaveLength(10);
    expect(service.getTeamIdByKey(created!.code, joinKey)).toBe(
      created!.state.teams[0].id,
    );

    expect(
      service.runHostCommand(created!.code, {
        type: 'START_ROUND',
        category: 'Тест',
        clue: 'Секретная подсказка',
        answer: 'КОДЕКС',
      }).changed,
    ).toBe(true);

    const publicState = service.getPublicState(created!.code);
    expect(publicState?.puzzle?.maskedAnswer).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(JSON.stringify(publicState)).not.toContain('КОДЕКС');
    expect(JSON.stringify(publicState)).not.toContain(joinKey);
    expect(JSON.stringify(publicState)).not.toContain(created!.hostJoinKey);
    expect(publicState?.teams[0]).not.toHaveProperty('joinKey');
    expect(service.getHostState(created!.code, created!.hostToken)?.puzzle?.answer).toBe(
      'КОДЕКС',
    );
  });

  it('lets only the active team start one spin at a time', () => {
    const service = new FieldOfMiraclesService();
    const created = service.createSession(102, [
      { name: 'Первые', color: '#111111' },
      { name: 'Вторые', color: '#222222' },
    ]);
    service.runHostCommand(created!.code, {
      type: 'START_ROUND',
      category: '',
      clue: '',
      answer: 'МИР',
    });
    const state = service.getPublicState(created!.code)!;
    const activeId = state.activeTeamId!;
    const otherId = state.teams.find((team) => team.id !== activeId)!.id;

    expect(service.requestSpin(created!.code, otherId).changed).toBe(false);
    const first = service.requestSpin(created!.code, activeId);
    expect(first.changed).toBe(true);
    expect(service.requestSpin(created!.code, activeId).changed).toBe(false);
    expect(service.getPublicState(created!.code)?.spin?.seed).toHaveLength(64);
  });

  it('maps a revealed seed to one stable sector and safe angle', () => {
    const seed = 'ab'.repeat(32);
    const first = spinFromSeed(seed, 123);
    const second = spinFromSeed(seed, 123);
    const sectorWidth = 360 / 18;

    expect(second.sectorId).toBe(first.sectorId);
    expect(second.sectorIndex).toBe(first.sectorIndex);
    expect(second.landingAngle).toBe(first.landingAngle);
    expect(Math.floor(first.landingAngle / sectorWidth)).toBe(first.sectorIndex);
  });
});

const HOUR = 60 * 60 * 1000;
const START = 1_700_000_000_000;

describe('FieldOfMiraclesService: владение комнатой, уборка и снимок', () => {
  let service: FieldOfMiraclesService;

  beforeEach(() => {
    service = new FieldOfMiraclesService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('возвращает владельцу ту же комнату, а не плодит новые', () => {
    const first = service.createSession(201);
    const second = service.createSession(201);
    expect(second?.code).toBe(first?.code);
    expect(service.roomCount).toBe(1);
  });

  it('другому пользователю достаётся своя комната и чужой токен не выдаётся', () => {
    const mine = service.createSession(201);
    const theirs = service.createSession(202);
    expect(theirs?.code).not.toBe(mine?.code);
    expect(theirs?.hostToken).not.toBe(mine?.hostToken);
    // Регрессия на прежнюю дыру: комната принадлежала строке из localStorage,
    // и, повторив чужую, можно было получить чужие права ведущего.
    expect(service.getHostState(mine!.code, theirs!.hostToken)).toBeNull();
    expect(service.getHostState(mine!.code, mine!.hostToken)).not.toBeNull();
  });

  it('без владельца каждый вызов открывает отдельную комнату', () => {
    const first = service.createSession(null);
    const second = service.createSession(null);
    expect(second?.code).not.toBe(first?.code);
  });

  it('уборка выносит простоявшую комнату и не трогает живую', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(START);
    const idle = service.createSession(203);
    const busy = service.createSession(204);

    clock.mockReturnValue(START + 6 * HOUR);
    service.getHostState(busy!.code, busy!.hostToken);

    clock.mockReturnValue(START + 6 * HOUR + 60_000);
    service.sweep();

    expect(service.getPublicState(idle!.code)).toBeNull();
    expect(service.getPublicState(busy!.code)).not.toBeNull();
    clock.mockRestore();
  });

  it('после рестарта комната поднимается с прежним кодом, словом и ключами', () => {
    const first = new FieldOfMiraclesService();
    first.onModuleInit();
    const created = first.createSession(205, [{ name: 'Альфа', color: '#2563eb' }]);
    first.runHostCommand(created!.code, {
      type: 'START_ROUND',
      category: 'Города',
      clue: 'Столица',
      answer: 'МОСКВА',
    });
    first.onModuleDestroy();

    const second = new FieldOfMiraclesService();
    second.onModuleInit();
    const restored = second.getHostState(created!.code, created!.hostToken);
    second.onModuleDestroy();

    expect(restored).not.toBeNull();
    expect(restored!.puzzle?.answer).toBe('МОСКВА');
    // Ключи те же — розданные капитанам ссылки остаются рабочими.
    expect(restored!.teams.map((team) => team.joinKey)).toEqual(
      created!.state.teams.map((team) => team.joinKey),
    );
    expect(restored!.undoAvailable).toBe(false);
  });

  it('владелец после рестарта получает свою комнату, а не новую', () => {
    const first = new FieldOfMiraclesService();
    first.onModuleInit();
    const created = first.createSession(206);
    first.onModuleDestroy();

    const second = new FieldOfMiraclesService();
    second.onModuleInit();
    const again = second.createSession(206);
    second.onModuleDestroy();

    expect(again?.code).toBe(created?.code);
  });

  it('просроченные комнаты после рестарта не поднимаются', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(START);
    const first = new FieldOfMiraclesService();
    first.onModuleInit();
    const created = first.createSession(207);
    first.onModuleDestroy();

    clock.mockReturnValue(START + 7 * HOUR);
    const second = new FieldOfMiraclesService();
    second.onModuleInit();
    const restored = second.getPublicState(created!.code);
    second.onModuleDestroy();
    clock.mockRestore();

    expect(restored).toBeNull();
  });
});

describe('FieldOfMiraclesService: место капитана и переподключение', () => {
  const GRACE_MS = 90 * 1000;
  let service: FieldOfMiraclesService;
  let code: string;
  let teamId: string;

  beforeEach(() => {
    service = new FieldOfMiraclesService();
    const created = service.createSession(301, [{ name: 'Альфа', color: '#2563eb' }]);
    code = created!.code;
    teamId = created!.state.teams[0].id;
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('первый занявший место садится за команду', () => {
    expect(service.claimSlot(code, teamId, 'player-1', 'socket-1')).toEqual({ ok: true });
    expect(service.connectedTeamIds(code)).toEqual([teamId]);
    expect(service.getPublicState(code)?.connectedTeamIds).toEqual([teamId]);
  });

  it('второе устройство на занятое место не пускают', () => {
    service.claimSlot(code, teamId, 'player-1', 'socket-1');
    const other = service.claimSlot(code, teamId, 'player-2', 'socket-2');
    expect(other.ok).toBe(false);
  });

  it('обрыв связи гасит присутствие, но место остаётся за прежним устройством', () => {
    service.claimSlot(code, teamId, 'player-1', 'socket-1', START);
    service.releaseSlot('socket-1', START);

    expect(service.connectedTeamIds(code)).toEqual([]);
    // Чужому внутри паузы отказ с понятным сроком.
    const stranger = service.claimSlot(code, teamId, 'player-2', 'socket-2', START + 1000);
    expect(stranger.ok).toBe(false);
    expect(stranger.ok === false && stranger.error).toMatch(/держится/);
  });

  it('прежний капитан возвращается на своё место внутри паузы', () => {
    service.claimSlot(code, teamId, 'player-1', 'socket-1', START);
    service.releaseSlot('socket-1', START);
    // Новый сокет, тот же человек: телефон переподключился.
    expect(
      service.claimSlot(code, teamId, 'player-1', 'socket-9', START + 30_000),
    ).toEqual({ ok: true });
    expect(service.connectedTeamIds(code)).toEqual([teamId]);
  });

  it('после паузы место достаётся любому', () => {
    service.claimSlot(code, teamId, 'player-1', 'socket-1', START);
    service.releaseSlot('socket-1', START);
    expect(
      service.claimSlot(code, teamId, 'player-2', 'socket-2', START + GRACE_MS + 1),
    ).toEqual({ ok: true });
  });

  it('уборка снимает истёкшую бронь и называет комнату для рассылки', () => {
    service.claimSlot(code, teamId, 'player-1', 'socket-1', START);
    service.releaseSlot('socket-1', START);

    expect(service.sweepOccupants(START + GRACE_MS - 1)).toEqual([]);
    expect(service.sweepOccupants(START + GRACE_MS + 1)).toEqual([code]);
    // Бронь снята — второй проход комнату уже не называет.
    expect(service.sweepOccupants(START + GRACE_MS + 2)).toEqual([]);
  });
});
