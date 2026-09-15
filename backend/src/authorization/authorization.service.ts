import { ForbiddenException, Injectable } from '@nestjs/common';
import type { SessionUser } from '../auth/types';
import { DatabaseService } from '../database/database.service';
import { env } from '../env';
import type { Permission, PermissionScope } from './permissions';

interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string | number;
  before?: unknown;
  after?: unknown;
  reason?: string;
  requestId?: string;
}

@Injectable()
export class AuthorizationService {
  constructor(private readonly database: DatabaseService) {}

  isRoot(user: SessionUser) {
    return user.kind === 'dev' || env.adminIds.includes(user.id);
  }

  async has(user: SessionUser, permission: Permission, scope?: PermissionScope) {
    if (this.isRoot(user)) return true;
    if (!this.database.enabled) return false;
    const values: unknown[] = [user.id, permission];
    let scopeSql = `ra.scope_type = 'global'`;
    if (scope) {
      values.push(scope.type, String(scope.id ?? ''));
      scopeSql += ` OR (ra.scope_type = $3 AND ra.scope_id = $4)`;
    }
    const result = await this.database.query(
      `SELECT 1
       FROM role_assignments ra
       JOIN role_permissions rp ON rp.role_id = ra.role_id
       WHERE ra.user_id = $1 AND rp.permission_key = $2
         AND ra.revoked_at IS NULL
         AND (ra.expires_at IS NULL OR ra.expires_at > now())
         AND (${scopeSql})
       UNION ALL
       SELECT 1 FROM platform_admins
       WHERE user_id = $1
       LIMIT 1`,
      values,
    );
    return Boolean(result.rowCount);
  }

  async require(
    user: SessionUser,
    permission: Permission,
    scope?: PermissionScope,
    message = 'Недостаточно прав для этого действия.',
  ) {
    if (!(await this.has(user, permission, scope))) throw new ForbiddenException(message);
  }

  async isAdmin(user: SessionUser) {
    if (this.isRoot(user)) return true;
    if (!this.database.enabled) return false;
    const result = await this.database.query(
      `SELECT 1 FROM platform_admins WHERE user_id = $1
       UNION ALL
       SELECT 1 FROM role_assignments
       WHERE user_id = $1 AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > now())
       LIMIT 1`,
      [user.id],
    );
    return Boolean(result.rowCount);
  }

  async audit(user: SessionUser, input: AuditInput) {
    if (!this.database.enabled) return;
    await this.database.query(
      `INSERT INTO audit_log
         (actor_user_id, action, entity_type, entity_id, before_value, after_value, reason, request_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
      [
        user.id,
        input.action,
        input.entityType,
        input.entityId === undefined ? null : String(input.entityId),
        input.before === undefined ? null : JSON.stringify(input.before),
        input.after === undefined ? null : JSON.stringify(input.after),
        input.reason?.trim() || null,
        input.requestId?.trim() || null,
      ],
    );
  }
}
