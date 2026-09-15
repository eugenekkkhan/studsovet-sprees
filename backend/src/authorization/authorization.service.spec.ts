import { ForbiddenException } from '@nestjs/common';
import type { SessionUser } from '../auth/types';
import type { DatabaseService } from '../database/database.service';
import { AuthorizationService } from './authorization.service';

const user = (id: number, kind: SessionUser['kind'] = 'telegram'): SessionUser => ({
  id, kind, name: 'Тест', username: '', photoUrl: '',
});

describe('AuthorizationService', () => {
  const database = {
    enabled: true,
    query: jest.fn(),
  } as unknown as DatabaseService;
  let service: AuthorizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthorizationService(database);
  });

  it('allows the local developer without a database lookup', async () => {
    await expect(service.has(user(-1, 'dev'), 'events.create')).resolves.toBe(true);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('denies a regular user when PostgreSQL is disabled', async () => {
    Object.defineProperty(database, 'enabled', { configurable: true, value: false });
    await expect(service.has(user(42), 'events.create')).resolves.toBe(false);
    await expect(service.require(user(42), 'events.create')).rejects.toBeInstanceOf(ForbiddenException);
    Object.defineProperty(database, 'enabled', { configurable: true, value: true });
  });

  it('checks active assignments in global or requested scope', async () => {
    (database.query as jest.Mock).mockResolvedValue({ rowCount: 1, rows: [{}] });
    await expect(service.has(
      user(42), 'events.update_assigned', { type: 'event', id: 'event-7' },
    )).resolves.toBe(true);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining(`ra.expires_at > now()`),
      [42, 'events.update_assigned', 'event', 'event-7'],
    );
  });

  it('keeps legacy platform administrators authorized', async () => {
    (database.query as jest.Mock).mockResolvedValue({ rowCount: 1, rows: [{}] });
    await expect(service.has(user(42), 'platform.features.manage')).resolves.toBe(true);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT 1 FROM platform_admins'),
      [42, 'platform.features.manage'],
    );
  });

  it('writes structured audit records', async () => {
    (database.query as jest.Mock).mockResolvedValue({ rowCount: 1, rows: [] });
    await service.audit(user(42), {
      action: 'feature.update', entityType: 'feature', entityId: 'events',
      before: { enabled: false }, after: { enabled: true }, reason: 'Запуск',
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_log'),
      [42, 'feature.update', 'feature', 'events', '{"enabled":false}', '{"enabled":true}', 'Запуск', null],
    );
  });
});
