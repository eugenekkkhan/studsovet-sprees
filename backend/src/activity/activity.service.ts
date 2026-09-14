import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

interface TelegramPerson {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramChatIdentity {
  id: number;
  title?: string;
}

export interface ActivitySummary {
  messages: number;
  reactionsGiven: number;
  reactionsReceived: number;
  currentStreak: number;
}

const previousDate = (date: string) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
};

export const streakFromDates = (activeDates: string[], today: string) => {
  const dates = new Set(activeDates);
  let cursor = dates.has(today) ? today : previousDate(today);
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = previousDate(cursor);
  }
  return streak;
};

const moscowToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

const personName = (person: TelegramPerson) =>
  [person.first_name, person.last_name].filter(Boolean).join(' ').trim() ||
  (person.username ? `@${person.username}` : `id${person.id}`);

@Injectable()
export class ActivityService {
  constructor(private readonly database: DatabaseService) {}

  private async remember(person: TelegramPerson) {
    await this.database.query(
      `INSERT INTO participants (user_id, name, telegram_name, username)
       VALUES ($1, $2, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         name = CASE WHEN participants.name_locked THEN participants.name ELSE EXCLUDED.name END,
         telegram_name = EXCLUDED.telegram_name,
         username = EXCLUDED.username,
         last_seen_at = now()`,
      [person.id, personName(person), person.username ?? ''],
    );
  }

  async recordMembership(
    chat: TelegramChatIdentity,
    person: TelegramPerson,
    status: string,
  ) {
    if (!this.database.enabled) return;
    const active = ['creator', 'administrator', 'member', 'restricted'].includes(status);
    await this.remember(person);
    await this.database.transaction(async (client) => {
      await client.query(
        `INSERT INTO telegram_chats (chat_id, title) VALUES ($1, $2)
         ON CONFLICT (chat_id) DO UPDATE SET title = EXCLUDED.title, updated_at = now()`,
        [chat.id, chat.title?.trim() || `Чат ${chat.id}`],
      );
      await client.query(
        `INSERT INTO participant_chats (user_id, chat_id, role, active, joined_at)
         VALUES ($1, $2, $3, $4, CASE WHEN $4 THEN now() ELSE NULL END)
         ON CONFLICT (user_id, chat_id) DO UPDATE SET
           role = EXCLUDED.role,
           active = EXCLUDED.active,
           joined_at = CASE
             WHEN EXCLUDED.active AND NOT participant_chats.active THEN now()
             ELSE participant_chats.joined_at
           END,
           updated_at = now()`,
        [person.id, chat.id, status, active],
      );
    });
  }

  async recordMessage(chatId: number, messageId: number, sentAt: number, author: TelegramPerson) {
    if (!this.database.enabled) return;
    const inserted = await this.database.query(
      `INSERT INTO chat_messages (chat_id, message_id, author_user_id, sent_at)
       VALUES ($1, $2, $3, to_timestamp($4))
       ON CONFLICT DO NOTHING RETURNING message_id`,
      [chatId, messageId, author.id, sentAt],
    );
    if (!inserted.rowCount) return;
    await this.database.query(
      `INSERT INTO activity_daily (user_id, activity_date, messages)
       VALUES ($1, (to_timestamp($2) AT TIME ZONE 'Europe/Moscow')::date, 1)
       ON CONFLICT (user_id, activity_date) DO UPDATE
       SET messages = activity_daily.messages + 1`,
      [author.id, sentAt],
    );
  }

  async recordReaction(
    chatId: number,
    messageId: number,
    changedAt: number,
    actor: TelegramPerson,
    reactionCount: number,
  ) {
    if (!this.database.enabled) return;
    await this.database.transaction(async (client) => {
      const message = await client.query<{ author_user_id: string }>(
        'SELECT author_user_id FROM chat_messages WHERE chat_id = $1 AND message_id = $2',
        [chatId, messageId],
      );
      const recipientId = message.rows[0] ? Number(message.rows[0].author_user_id) : null;
      const previous = await client.query<{ reaction_count: number }>(
        `SELECT reaction_count FROM message_reactions
         WHERE chat_id = $1 AND message_id = $2 AND actor_user_id = $3 FOR UPDATE`,
        [chatId, messageId, actor.id],
      );
      const before = Number(previous.rows[0]?.reaction_count ?? 0);
      const next = Math.max(0, reactionCount);
      const delta = next - before;
      if (!delta) return;

      await client.query(
        `INSERT INTO message_reactions
          (chat_id, message_id, actor_user_id, recipient_user_id, reaction_count, updated_at)
         VALUES ($1, $2, $3, $4, $5, to_timestamp($6))
         ON CONFLICT (chat_id, message_id, actor_user_id) DO UPDATE SET
           recipient_user_id = EXCLUDED.recipient_user_id,
           reaction_count = EXCLUDED.reaction_count,
           updated_at = EXCLUDED.updated_at`,
        [chatId, messageId, actor.id, recipientId, next, changedAt],
      );
      await client.query(
        `INSERT INTO activity_daily (user_id, activity_date, reactions_given)
         VALUES ($1, (to_timestamp($2) AT TIME ZONE 'Europe/Moscow')::date, $3)
         ON CONFLICT (user_id, activity_date) DO UPDATE SET
           reactions_given = GREATEST(0, activity_daily.reactions_given + EXCLUDED.reactions_given)`,
        [actor.id, changedAt, delta],
      );
      if (recipientId !== null) {
        await client.query(
          `INSERT INTO activity_daily (user_id, activity_date, reactions_received)
           VALUES ($1, (to_timestamp($2) AT TIME ZONE 'Europe/Moscow')::date, $3)
           ON CONFLICT (user_id, activity_date) DO UPDATE SET
             reactions_received = GREATEST(0, activity_daily.reactions_received + EXCLUDED.reactions_received)`,
          [recipientId, changedAt, delta],
        );
      }
    });
  }

  async summaries(): Promise<Map<number, ActivitySummary>> {
    if (!this.database.enabled) return new Map();
    const result = await this.database.query<{
      user_id: string;
      messages: string;
      reactions_given: string;
      reactions_received: string;
      active_dates: string[];
    }>(
      `SELECT user_id,
        SUM(messages)::text AS messages,
        SUM(reactions_given)::text AS reactions_given,
        SUM(reactions_received)::text AS reactions_received,
        ARRAY_AGG(activity_date::text ORDER BY activity_date DESC)
          FILTER (WHERE messages > 0) AS active_dates
       FROM activity_daily GROUP BY user_id`,
    );
    const today = moscowToday();
    return new Map(result.rows.map((row) => {
      return [Number(row.user_id), {
        messages: Number(row.messages),
        reactionsGiven: Number(row.reactions_given),
        reactionsReceived: Number(row.reactions_received),
        currentStreak: streakFromDates(row.active_dates ?? [], today),
      }];
    }));
  }
}
