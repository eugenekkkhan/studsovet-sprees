import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire('/app/backend/package.json');
const { Client } = require('pg');

const files = process.argv.slice(2);
if (!process.env.DATABASE_URL || files.length === 0) {
  throw new Error('Usage: DATABASE_URL=... node import-postgres.mjs <export.json>...');
}

const botChatId = (id) => {
  const value = Number(id);
  return value > 0 ? Number(`-100${value}`) : value;
};

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let memberships = 0;
const users = new Set();
try {
  await client.query('BEGIN');
  for (const file of files) {
    const data = JSON.parse(await readFile(file, 'utf8'));
    const chatId = botChatId(data.chat_id);
    await client.query(
      `INSERT INTO telegram_chats (chat_id, title) VALUES ($1, $2)
       ON CONFLICT (chat_id) DO UPDATE SET title = EXCLUDED.title, updated_at = now()`,
      [chatId, String(data.chat || `Чат ${chatId}`)],
    );
    for (const member of data.members ?? []) {
      if (member.bot || member.deleted || !Number.isSafeInteger(Number(member.id))) continue;
      const id = Number(member.id);
      const name = [member.first_name, member.last_name].filter(Boolean).join(' ').trim()
        || (member.username ? `@${member.username}` : `id${id}`);
      await client.query(
        `INSERT INTO participants (user_id, name, username)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET
           name = CASE WHEN participants.name_locked THEN participants.name ELSE EXCLUDED.name END,
           username = EXCLUDED.username,
           last_seen_at = now()`,
        [id, name, String(member.username || '')],
      );
      await client.query(
        `INSERT INTO participant_chats (user_id, chat_id, role, active, joined_at)
         VALUES ($1, $2, $3, true, now())
         ON CONFLICT (user_id, chat_id) DO UPDATE SET
           role = EXCLUDED.role, active = true, updated_at = now()`,
        [id, chatId, String(member.role || 'Member')],
      );
      users.add(id);
      memberships += 1;
    }
  }
  await client.query('COMMIT');
  console.log(JSON.stringify({ users: users.size, memberships }));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
