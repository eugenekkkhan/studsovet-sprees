import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { SessionUser } from '../auth/types';
import { DatabaseService } from '../database/database.service';
import { env } from '../env';
import { AuthorizationService } from '../authorization/authorization.service';
import { FieldOfMiraclesService } from '../field-of-miracles/field-of-miracles.service';
import { QuizService } from '../quiz/quiz.service';

export const featureKeys = [
  'events', 'rating', 'participants', 'roulette', 'fieldOfMiracles', 'quiz',
] as const;
export type FeatureKey = (typeof featureKeys)[number];
export type FeatureFlags = Record<FeatureKey, boolean>;
const scopeTypes = ['global', 'chat', 'event', 'event_tag', 'game', 'self'] as const;

const defaults = (): FeatureFlags => Object.fromEntries(
  featureKeys.map((key) => [key, true]),
) as FeatureFlags;

@Injectable()
export class AdminService {
  constructor(
    private readonly database: DatabaseService,
    private readonly quiz: QuizService,
    private readonly field: FieldOfMiraclesService,
    private readonly authorization: AuthorizationService,
  ) {}

  isRoot(user: SessionUser) {
    return this.authorization.isRoot(user);
  }

  async isAdmin(user: SessionUser) {
    return this.authorization.isAdmin(user);
  }

  async requireAdmin(user: SessionUser) {
    await this.authorization.require(
      user, 'platform.settings.read', undefined, 'Раздел доступен только администраторам.',
    );
  }

  async flags(): Promise<FeatureFlags> {
    if (!this.database.enabled) return defaults();
    const result = await this.database.query<{ value: Partial<FeatureFlags> }>(
      `SELECT value FROM platform_settings WHERE setting_key = 'feature_flags'`,
    );
    return { ...defaults(), ...(result.rows[0]?.value ?? {}) };
  }

  async config(user: SessionUser) {
    return { features: await this.flags(), isAdmin: await this.isAdmin(user) };
  }

  async dashboard(user: SessionUser) {
    await this.requireAdmin(user);
    const [admins, participants, creationBans] = await Promise.all([
      this.database.query<{ user_id: string; name: string; username: string }>(
        `SELECT p.user_id, p.name, p.username FROM platform_admins a
         JOIN participants p ON p.user_id = a.user_id ORDER BY p.name`,
      ),
      this.database.query<{ user_id: string; name: string; username: string }>(
        `SELECT user_id, name, username FROM participants
         WHERE user_id > 0 ORDER BY name`,
      ),
      this.database.query<{ user_id: string }>(
        'SELECT user_id FROM session_creation_bans ORDER BY blocked_at DESC',
      ),
    ]);
    const roots = env.adminIds.map((id) => {
      const person = participants.rows.find((item) => Number(item.user_id) === id);
      return { userId: id, name: person?.name ?? `id${id}`, username: person?.username ?? '', root: true };
    });
    const delegated = admins.rows
      .filter((item) => !env.adminIds.includes(Number(item.user_id)))
      .map((item) => ({ userId: Number(item.user_id), name: item.name, username: item.username, root: false }));
    const people = new Map(participants.rows.map((person) => [Number(person.user_id), person]));
    const describeSession = (
      game: 'quiz' | 'fieldOfMiracles',
      session: ReturnType<QuizService['listSessions']>[number],
    ) => {
      const owner = session.ownerUserId === null ? undefined : people.get(session.ownerUserId);
      return {
        ...session,
        game,
        ownerName: owner?.name ?? (session.ownerUserId === null ? 'Без владельца' : `id${session.ownerUserId}`),
        ownerUsername: owner?.username ?? '',
      };
    };
    return {
      features: await this.flags(),
      admins: [...roots, ...delegated],
      candidates: participants.rows.map((item) => ({
        userId: Number(item.user_id), name: item.name, username: item.username,
      })),
      blockedCreatorIds: creationBans.rows.map((item) => Number(item.user_id)),
      sessions: [
        ...this.quiz.listSessions().map((session) => describeSession('quiz', session)),
        ...this.field.listSessions().map((session) => describeSession('fieldOfMiracles', session)),
      ].sort((left, right) => right.lastActivityAt - left.lastActivityAt),
    };
  }

  async terminateSession(user: SessionUser, game: string, code: string) {
    await this.authorization.require(user, 'games.sessions.terminate');
    const removed = game === 'quiz'
      ? this.quiz.removeSession(code)
      : game === 'fieldOfMiracles'
        ? this.field.removeSession(code)
        : false;
    if (!removed) throw new NotFoundException('Игровая сессия не найдена.');
    await this.authorization.audit(user, {
      action: 'game_session.terminate', entityType: 'game_session', entityId: `${game}:${code}`,
    });
    return { ok: true };
  }

  async setCreationBlocked(user: SessionUser, userId: number, blocked: boolean) {
    await this.authorization.require(user, 'games.creation_bans.manage');
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new ForbiddenException('Некорректный пользователь.');
    }
    if (this.isRoot({ id: userId, kind: 'telegram', name: '', username: '', photoUrl: '' })) {
      throw new ForbiddenException('Корневому администратору нельзя запретить создание комнат.');
    }
    if (blocked) {
      await this.database.query(
        `INSERT INTO session_creation_bans (user_id, blocked_by) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET blocked_by = EXCLUDED.blocked_by, blocked_at = now()`,
        [userId, user.id],
      );
    } else {
      await this.database.query('DELETE FROM session_creation_bans WHERE user_id = $1', [userId]);
    }
    await this.authorization.audit(user, {
      action: blocked ? 'game_creation.block' : 'game_creation.unblock',
      entityType: 'participant', entityId: userId, after: { blocked },
    });
    return { blocked };
  }

  async setFeature(user: SessionUser, key: string, enabled: boolean) {
    await this.authorization.require(user, 'platform.features.manage');
    if (!featureKeys.includes(key as FeatureKey)) {
      throw new ForbiddenException('Неизвестный раздел приложения.');
    }
    const features = { ...await this.flags(), [key]: enabled };
    await this.database.query(
      `INSERT INTO platform_settings (setting_key, value, updated_by)
       VALUES ('feature_flags', $1::jsonb, $2)
       ON CONFLICT (setting_key) DO UPDATE SET
         value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [JSON.stringify(features), user.id],
    );
    await this.authorization.audit(user, {
      action: 'feature.update', entityType: 'feature', entityId: key, after: { enabled },
    });
    return { features };
  }

  async addAdmin(user: SessionUser, userId: number) {
    await this.authorization.require(user, 'platform.roles.assign');
    await this.database.query(
      `INSERT INTO platform_admins (user_id, granted_by) VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING`, [userId, user.id],
    );
    await this.authorization.audit(user, {
      action: 'role.grant_legacy_admin', entityType: 'participant', entityId: userId,
      after: { role: 'platform_admin' },
    });
    return this.dashboard(user);
  }

  async removeAdmin(user: SessionUser, userId: number) {
    await this.authorization.require(user, 'platform.roles.assign');
    if (env.adminIds.includes(userId)) {
      throw new ForbiddenException('Корневого администратора нельзя удалить из панели.');
    }
    await this.database.query('DELETE FROM platform_admins WHERE user_id = $1', [userId]);
    await this.authorization.audit(user, {
      action: 'role.revoke_legacy_admin', entityType: 'participant', entityId: userId,
      before: { role: 'platform_admin' },
    });
    return this.dashboard(user);
  }

  async roles(user: SessionUser) {
    await this.authorization.require(user, 'platform.roles.read');
    const [roles, assignments] = await Promise.all([
      this.database.query<{
        role_key: string; name: string; description: string; permissions: string[];
      }>(
        `SELECT r.role_key, r.name, r.description,
           COALESCE(array_agg(rp.permission_key ORDER BY rp.permission_key)
             FILTER (WHERE rp.permission_key IS NOT NULL), '{}') AS permissions
         FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id
         GROUP BY r.id ORDER BY r.name`,
      ),
      this.database.query<{
        id: string; user_id: string; role_key: string; role_name: string;
        scope_type: string; scope_id: string; granted_by: string;
        granted_at: string | Date; expires_at: string | Date | null;
      }>(
        `SELECT ra.id, ra.user_id, r.role_key, r.name AS role_name,
           ra.scope_type, ra.scope_id, ra.granted_by, ra.granted_at, ra.expires_at
         FROM role_assignments ra JOIN roles r ON r.id = ra.role_id
         WHERE ra.revoked_at IS NULL AND (ra.expires_at IS NULL OR ra.expires_at > now())
         ORDER BY ra.granted_at DESC`,
      ),
    ]);
    return {
      roles: roles.rows.map((item) => ({
        key: item.role_key, name: item.name, description: item.description,
        permissions: item.permissions,
      })),
      assignments: assignments.rows.map((item) => ({
        id: Number(item.id), userId: Number(item.user_id), roleKey: item.role_key,
        roleName: item.role_name, scopeType: item.scope_type, scopeId: item.scope_id,
        grantedBy: Number(item.granted_by),
        grantedAt: new Date(item.granted_at).getTime(),
        expiresAt: item.expires_at ? new Date(item.expires_at).getTime() : null,
      })),
    };
  }

  async assignRole(user: SessionUser, input: Record<string, unknown>) {
    await this.authorization.require(user, 'platform.roles.assign');
    const userId = Number(input.userId);
    const roleKey = String(input.roleKey ?? '');
    const scopeType = String(input.scopeType ?? 'global');
    const scopeId = scopeType === 'global' ? '' : String(input.scopeId ?? '').trim();
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new ForbiddenException('Некорректный пользователь.');
    }
    if (!scopeTypes.includes(scopeType as (typeof scopeTypes)[number]) ||
      (scopeType !== 'global' && !scopeId)) {
      throw new ForbiddenException('Некорректная область действия роли.');
    }
    const expiresAt = input.expiresAt ? new Date(String(input.expiresAt)) : null;
    if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now())) {
      throw new ForbiddenException('Срок роли должен находиться в будущем.');
    }
    const result = await this.database.query<{ id: string }>(
      `INSERT INTO role_assignments
         (user_id, role_id, scope_type, scope_id, granted_by, expires_at)
       SELECT $1, id, $3, $4, $5, $6 FROM roles WHERE role_key = $2
       ON CONFLICT (user_id, role_id, scope_type, scope_id) WHERE revoked_at IS NULL
       DO UPDATE SET granted_by = EXCLUDED.granted_by, granted_at = now(),
         expires_at = EXCLUDED.expires_at
       RETURNING id`,
      [userId, roleKey, scopeType, scopeId, user.id, expiresAt?.toISOString() ?? null],
    );
    if (!result.rows[0]) throw new NotFoundException('Роль не найдена.');
    const assignmentId = Number(result.rows[0].id);
    await this.authorization.audit(user, {
      action: 'role.assign', entityType: 'role_assignment', entityId: assignmentId,
      after: { userId, roleKey, scopeType, scopeId, expiresAt: expiresAt?.toISOString() ?? null },
    });
    return { id: assignmentId };
  }

  async revokeRole(user: SessionUser, assignmentId: number) {
    await this.authorization.require(user, 'platform.roles.assign');
    if (!Number.isSafeInteger(assignmentId) || assignmentId <= 0) {
      throw new NotFoundException('Назначение роли не найдено.');
    }
    const result = await this.database.query(
      `UPDATE role_assignments SET revoked_at = now()
       WHERE id = $1 AND revoked_at IS NULL RETURNING user_id, role_id, scope_type, scope_id`,
      [assignmentId],
    );
    if (!result.rows[0]) throw new NotFoundException('Назначение роли не найдено.');
    await this.authorization.audit(user, {
      action: 'role.revoke', entityType: 'role_assignment', entityId: assignmentId,
      before: result.rows[0],
    });
    return { ok: true };
  }

  async auditLog(user: SessionUser) {
    await this.authorization.require(user, 'platform.audit.read');
    const result = await this.database.query(
      `SELECT id, actor_user_id, action, entity_type, entity_id,
         before_value, after_value, reason, request_id, created_at
       FROM audit_log ORDER BY created_at DESC LIMIT 200`,
    );
    return { entries: result.rows };
  }
}
