import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { env } from '../env';

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private pool: Pool | null = null;

  get enabled() {
    return Boolean(env.databaseUrl);
  }

  async onModuleInit() {
    if (!env.databaseUrl) return;
    this.pool = new Pool({ connectionString: env.databaseUrl });
    await this.query(`
      CREATE TABLE IF NOT EXISTS decks (
        owner_id BIGINT NOT NULL,
        deck_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        visibility TEXT NOT NULL CHECK (visibility IN ('private', 'published')),
        content JSONB NOT NULL,
        share_token_hash TEXT,
        share_allow_copy BOOLEAN NOT NULL DEFAULT true,
        share_views INTEGER NOT NULL DEFAULT 0,
        share_copies INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (owner_id, deck_id)
      );
      CREATE INDEX IF NOT EXISTS decks_visibility_updated_idx
        ON decks (visibility, updated_at DESC);
      ALTER TABLE decks ADD COLUMN IF NOT EXISTS share_token_hash TEXT;
      ALTER TABLE decks ADD COLUMN IF NOT EXISTS share_allow_copy BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE decks ADD COLUMN IF NOT EXISTS share_views INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE decks ADD COLUMN IF NOT EXISTS share_copies INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE decks ADD COLUMN IF NOT EXISTS share_last_viewed_at TIMESTAMPTZ;
      CREATE UNIQUE INDEX IF NOT EXISTS decks_share_token_hash_idx
        ON decks (share_token_hash) WHERE share_token_hash IS NOT NULL;

      CREATE TABLE IF NOT EXISTS participants (
        user_id BIGINT PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT NOT NULL DEFAULT '',
        telegram_name TEXT NOT NULL DEFAULT '',
        first_name TEXT NOT NULL DEFAULT '',
        last_name TEXT NOT NULL DEFAULT '',
        faculty TEXT,
        education_level TEXT CHECK (education_level IN ('bachelor', 'master', 'postgraduate', 'specialist')),
        photo_url TEXT NOT NULL DEFAULT '',
        course SMALLINT CHECK (course BETWEEN 1 AND 6),
        birthday DATE,
        name_locked BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS participants_name_idx ON participants (name);
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS name_locked BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS telegram_name TEXT NOT NULL DEFAULT '';
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS faculty TEXT;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS education_level TEXT;
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'participants_education_level_check'
        ) THEN
          ALTER TABLE participants ADD CONSTRAINT participants_education_level_check
            CHECK (education_level IN ('bachelor', 'master', 'postgraduate', 'specialist'));
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS telegram_chats (
        chat_id BIGINT PRIMARY KEY,
        title TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS participant_chats (
        user_id BIGINT NOT NULL REFERENCES participants(user_id) ON DELETE CASCADE,
        chat_id BIGINT NOT NULL REFERENCES telegram_chats(chat_id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'member',
        active BOOLEAN NOT NULL DEFAULT true,
        joined_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, chat_id)
      );
      CREATE INDEX IF NOT EXISTS participant_chats_chat_active_idx
        ON participant_chats (chat_id, active);

      CREATE TABLE IF NOT EXISTS score_entries (
        event_id UUID NOT NULL,
        user_id BIGINT NOT NULL,
        event_title TEXT NOT NULL,
        category TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        base_points NUMERIC NOT NULL,
        urgency_multiplier NUMERIC NOT NULL,
        course_multiplier NUMERIC NOT NULL,
        points INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (event_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS score_entries_user_idx ON score_entries (user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS chat_messages (
        chat_id BIGINT NOT NULL,
        message_id BIGINT NOT NULL,
        author_user_id BIGINT NOT NULL,
        sent_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (chat_id, message_id)
      );
      CREATE INDEX IF NOT EXISTS chat_messages_author_idx
        ON chat_messages (author_user_id, sent_at DESC);

      CREATE TABLE IF NOT EXISTS message_reactions (
        chat_id BIGINT NOT NULL,
        message_id BIGINT NOT NULL,
        actor_user_id BIGINT NOT NULL,
        recipient_user_id BIGINT,
        reaction_count INTEGER NOT NULL CHECK (reaction_count >= 0),
        updated_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (chat_id, message_id, actor_user_id)
      );

      CREATE TABLE IF NOT EXISTS activity_daily (
        user_id BIGINT NOT NULL,
        activity_date DATE NOT NULL,
        messages INTEGER NOT NULL DEFAULT 0 CHECK (messages >= 0),
        reactions_given INTEGER NOT NULL DEFAULT 0 CHECK (reactions_given >= 0),
        reactions_received INTEGER NOT NULL DEFAULT 0 CHECK (reactions_received >= 0),
        PRIMARY KEY (user_id, activity_date)
      );
      CREATE INDEX IF NOT EXISTS activity_daily_date_idx
        ON activity_daily (activity_date DESC);

      CREATE TABLE IF NOT EXISTS platform_admins (
        user_id BIGINT PRIMARY KEY,
        granted_by BIGINT NOT NULL,
        granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS platform_settings (
        setting_key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_by BIGINT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS session_creation_bans (
        user_id BIGINT PRIMARY KEY,
        blocked_by BIGINT NOT NULL,
        blocked_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS roles (
        id BIGSERIAL PRIMARY KEY,
        role_key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        system BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS permissions (
        permission_key TEXT PRIMARY KEY,
        description TEXT NOT NULL DEFAULT '',
        risk_level TEXT NOT NULL DEFAULT 'normal'
          CHECK (risk_level IN ('normal', 'high', 'critical'))
      );
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_key TEXT NOT NULL REFERENCES permissions(permission_key) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_key)
      );
      CREATE TABLE IF NOT EXISTS role_assignments (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        scope_type TEXT NOT NULL DEFAULT 'global'
          CHECK (scope_type IN ('global', 'chat', 'event', 'event_tag', 'game', 'self')),
        scope_id TEXT NOT NULL DEFAULT '',
        granted_by BIGINT NOT NULL,
        granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS role_assignments_active_user_idx
        ON role_assignments (user_id) WHERE revoked_at IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS role_assignments_active_unique_idx
        ON role_assignments (user_id, role_id, scope_type, scope_id) WHERE revoked_at IS NULL;
      CREATE TABLE IF NOT EXISTS audit_log (
        id BIGSERIAL PRIMARY KEY,
        actor_user_id BIGINT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        before_value JSONB,
        after_value JSONB,
        reason TEXT,
        request_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);
      CREATE INDEX IF NOT EXISTS audit_log_entity_idx
        ON audit_log (entity_type, entity_id, created_at DESC);

      INSERT INTO roles (role_key, name, description, system) VALUES
        ('platform_admin', 'Главный администратор', 'Полное повседневное управление платформой', true),
        ('event_manager', 'Менеджер мероприятий', 'Создание и управление мероприятиями', true),
        ('game_admin', 'Игровой администратор', 'Игровые комнаты и модерация колод', true)
      ON CONFLICT (role_key) DO NOTHING;

      INSERT INTO permissions (permission_key) VALUES
        ('platform.settings.read'), ('platform.settings.update'), ('platform.features.manage'),
        ('platform.roles.read'), ('platform.roles.assign'), ('platform.roles.define'),
        ('platform.audit.read'), ('participants.read'), ('participants.profile.update_self'),
        ('participants.profile.update_any'), ('events.read'), ('events.create'),
        ('events.update_assigned'), ('events.update_any'), ('events.assign_coordinator'),
        ('events.attendance.manage'), ('events.finalize'), ('games.sessions.read'),
        ('games.sessions.terminate'), ('games.creation_bans.manage'), ('decks.moderate')
      ON CONFLICT (permission_key) DO NOTHING;

      INSERT INTO role_permissions (role_id, permission_key)
      SELECT r.id, p.permission_key FROM roles r CROSS JOIN permissions p
      WHERE r.role_key = 'platform_admin'
      ON CONFLICT DO NOTHING;
      INSERT INTO role_permissions (role_id, permission_key)
      SELECT r.id, p.permission_key FROM roles r JOIN permissions p ON p.permission_key IN
        ('events.read', 'events.create', 'events.update_assigned', 'events.update_any',
         'events.assign_coordinator', 'events.attendance.manage', 'events.finalize')
      WHERE r.role_key = 'event_manager'
      ON CONFLICT DO NOTHING;
      INSERT INTO role_permissions (role_id, permission_key)
      SELECT r.id, p.permission_key FROM roles r JOIN permissions p ON p.permission_key IN
        ('games.sessions.read', 'games.sessions.terminate', 'games.creation_bans.manage', 'decks.moderate')
      WHERE r.role_key = 'game_admin'
      ON CONFLICT DO NOTHING;
    `);
  }

  query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
    if (!this.pool) throw new Error('PostgreSQL не настроен.');
    return this.pool.query<T>(text, values);
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>) {
    if (!this.pool) throw new Error('PostgreSQL не настроен.');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onApplicationShutdown() {
    await this.pool?.end();
  }
}
