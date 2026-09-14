import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { SessionUser } from '../auth/types';
import { DatabaseService } from '../database/database.service';
import { env } from '../env';
import { FieldOfMiraclesService } from '../field-of-miracles/field-of-miracles.service';
import { QuizService } from '../quiz/quiz.service';

export const featureKeys = [
  'events', 'rating', 'participants', 'roulette', 'fieldOfMiracles', 'quiz',
] as const;
export type FeatureKey = (typeof featureKeys)[number];
export type FeatureFlags = Record<FeatureKey, boolean>;

const defaults = (): FeatureFlags => Object.fromEntries(
  featureKeys.map((key) => [key, true]),
) as FeatureFlags;

@Injectable()
export class AdminService {
  constructor(
    private readonly database: DatabaseService,
    private readonly quiz: QuizService,
    private readonly field: FieldOfMiraclesService,
  ) {}

  isRoot(user: SessionUser) {
    return user.kind === 'dev' || env.adminIds.includes(user.id);
  }

  async isAdmin(user: SessionUser) {
    if (this.isRoot(user)) return true;
    if (!this.database.enabled) return false;
    const result = await this.database.query(
      'SELECT 1 FROM platform_admins WHERE user_id = $1', [user.id],
    );
    return Boolean(result.rowCount);
  }

  async requireAdmin(user: SessionUser) {
    if (!(await this.isAdmin(user))) {
      throw new ForbiddenException('Раздел доступен только администраторам.');
    }
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
    await this.requireAdmin(user);
    const removed = game === 'quiz'
      ? this.quiz.removeSession(code)
      : game === 'fieldOfMiracles'
        ? this.field.removeSession(code)
        : false;
    if (!removed) throw new NotFoundException('Игровая сессия не найдена.');
    return { ok: true };
  }

  async setCreationBlocked(user: SessionUser, userId: number, blocked: boolean) {
    await this.requireAdmin(user);
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
    return { blocked };
  }

  async setFeature(user: SessionUser, key: string, enabled: boolean) {
    await this.requireAdmin(user);
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
    return { features };
  }

  async addAdmin(user: SessionUser, userId: number) {
    await this.requireAdmin(user);
    await this.database.query(
      `INSERT INTO platform_admins (user_id, granted_by) VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING`, [userId, user.id],
    );
    return this.dashboard(user);
  }

  async removeAdmin(user: SessionUser, userId: number) {
    await this.requireAdmin(user);
    if (env.adminIds.includes(userId)) {
      throw new ForbiddenException('Корневого администратора нельзя удалить из панели.');
    }
    await this.database.query('DELETE FROM platform_admins WHERE user_id = $1', [userId]);
    return this.dashboard(user);
  }
}
