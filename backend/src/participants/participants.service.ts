import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { SessionUser } from '../auth/types';
import { DatabaseService } from '../database/database.service';
import { AuthorizationService } from '../authorization/authorization.service';

interface ParticipantRow extends Record<string, unknown> {
  user_id: string;
  name: string;
  username: string;
  telegram_name: string;
  first_name: string;
  last_name: string;
  faculty: string | null;
  education_level: string | null;
  photo_url: string;
  course: number | null;
  birthday: string | Date | null;
  created_at: string | Date;
  last_seen_at: string | Date;
}

const project = (row: ParticipantRow) => ({
  userId: Number(row.user_id),
  name: row.name,
  username: row.username,
  telegramName: row.telegram_name,
  firstName: row.first_name,
  lastName: row.last_name,
  faculty: row.faculty,
  educationLevel: row.education_level,
  photoUrl: row.photo_url,
  course: row.course,
  birthday: row.birthday ? new Date(row.birthday).toISOString().slice(0, 10) : null,
  createdAt: new Date(row.created_at).getTime(),
  lastSeenAt: new Date(row.last_seen_at).getTime(),
});

@Injectable()
export class ParticipantsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly authorization: AuthorizationService,
  ) {}

  private async canManageAll(user: SessionUser) {
    return this.authorization.has(user, 'participants.profile.update_any');
  }

  async touch(user: SessionUser) {
    if (!this.database.enabled) return;
    await this.database.query(
      `INSERT INTO participants (user_id, name, username, photo_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         name = CASE WHEN participants.name_locked THEN participants.name ELSE EXCLUDED.name END,
         username = EXCLUDED.username,
         photo_url = EXCLUDED.photo_url,
         last_seen_at = now()`,
      [user.id, user.name, user.username, user.photoUrl],
    );
  }

  async list(user: SessionUser) {
    const [result, chats, memberships, canManageAll] = await Promise.all([
      this.database.query<ParticipantRow>(
        'SELECT * FROM participants ORDER BY (user_id = $1) DESC, name ASC, user_id ASC',
        [user.id],
      ),
      this.database.query<{ chat_id: string; title: string }>(
        'SELECT chat_id, title FROM telegram_chats ORDER BY title',
      ),
      this.database.query<{ user_id: string; chat_id: string; role: string; active: boolean }>(
        'SELECT user_id, chat_id, role, active FROM participant_chats',
      ),
      this.canManageAll(user),
    ]);
    const byUser = new Map<number, Array<{ chatId: number; role: string; active: boolean }>>();
    for (const membership of memberships.rows) {
      const userId = Number(membership.user_id);
      const current = byUser.get(userId) ?? [];
      current.push({
        chatId: Number(membership.chat_id),
        role: membership.role,
        active: membership.active,
      });
      byUser.set(userId, current);
    }
    return {
      chats: chats.rows.map((chat) => ({ chatId: Number(chat.chat_id), title: chat.title })),
      participants: result.rows.map((row) => ({
        ...project(row),
        chats: byUser.get(Number(row.user_id)) ?? [],
      })),
      canManageAll,
    };
  }

  async get(user: SessionUser, rawId: string) {
    const userId = Number(rawId);
    if (!Number.isSafeInteger(userId)) throw new NotFoundException('Участник не найден.');
    const result = await this.list(user);
    const participant = result.participants.find((item) => item.userId === userId);
    if (!participant) throw new NotFoundException('Участник не найден.');
    return { participant, chats: result.chats, canEdit: result.canManageAll || user.id === userId };
  }

  async update(user: SessionUser, rawId: string, input: Record<string, unknown>) {
    const userId = Number(rawId);
    const canManageAll = await this.canManageAll(user);
    if (!Number.isSafeInteger(userId) || (!canManageAll && user.id !== userId)) {
      throw new ForbiddenException('Можно редактировать только свой профиль.');
    }
    const firstName = String(input.firstName ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const lastName = String(input.lastName ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!firstName || !lastName) throw new BadRequestException('Укажите имя и фамилию.');
    const name = `${firstName} ${lastName}`;
    const faculty = input.faculty === null || input.faculty === '' ? null : String(input.faculty);
    const faculties = new Set([
      'ggt', 'geol', 'jour', 'hist', 'cs', 'math', 'bio', 'ir', 'amm',
      'rgf', 'pharm', 'phys', 'phil', 'phipsy', 'chem', 'econ', 'law',
    ]);
    if (faculty !== null && !faculties.has(faculty)) {
      throw new BadRequestException('Неизвестный факультет.');
    }
    const educationLevel = input.educationLevel === null || input.educationLevel === ''
      ? null : String(input.educationLevel);
    const courseLimits: Record<string, number> = {
      bachelor: 4, master: 2, postgraduate: 4, specialist: 6,
    };
    if (educationLevel !== null && !courseLimits[educationLevel]) {
      throw new BadRequestException('Неизвестная форма обучения.');
    }
    const course = input.course === null || input.course === '' ? null : Number(input.course);
    if (course !== null && (
      !educationLevel || !Number.isInteger(course) || course < 1 || course > courseLimits[educationLevel]
    )) {
      throw new BadRequestException('Курс не соответствует выбранной форме обучения.');
    }
    const birthday = input.birthday === null || input.birthday === ''
      ? null : String(input.birthday);
    if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      throw new BadRequestException('Дата рождения должна быть в формате ГГГГ-ММ-ДД.');
    }
    const result = await this.database.query<ParticipantRow>(
      `UPDATE participants SET name = $2, first_name = $3, last_name = $4, faculty = $5,
         education_level = $6, course = $7, birthday = $8::date, name_locked = true
       WHERE user_id = $1 RETURNING *`,
      [userId, name, firstName, lastName, faculty, educationLevel, course, birthday],
    );
    if (!result.rows[0]) throw new NotFoundException('Участник не найден.');
    await this.authorization.audit(user, {
      action: user.id === userId ? 'participant.profile.update_self' : 'participant.profile.update_any',
      entityType: 'participant', entityId: userId,
      after: project(result.rows[0]),
    });
    return project(result.rows[0]);
  }
}
