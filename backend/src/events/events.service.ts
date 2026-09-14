import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
  Optional,
} from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import type { SessionUser } from '../auth/types';
import { env } from '../env';
import { JsonStore } from '../storage/json-store';
import type { CommunityEvent, ReminderRule, RsvpStatus } from './types';
import { ReliabilityStore } from './reliability-store';
import { RatingService } from './rating.service';

interface EventsFile {
  events: CommunityEvent[];
}

export interface EventReminder {
  eventId: string;
  title: string;
  startsAt: string;
  userId: number;
  status: RsvpStatus;
  hoursBefore: number;
  key: string;
  relatedKeys: string[];
}

@Injectable()
export class EventsService implements OnModuleInit {
  private readonly store = new JsonStore<EventsFile>('events.json', () => ({
    events: [],
  }));
  private readonly reliability = new ReliabilityStore();

  constructor(@Optional() private readonly rating?: RatingService) {}

  /**
   * Старые мероприятия могли быть завершены до появления score_entries.
   * Повторный проход безопасен: у начисления уникальный ключ event/user.
   */
  async onModuleInit() {
    if (!this.rating) return;
    for (const event of this.store.read().events) {
      if (event.status === 'completed' || event.finalizedAt) {
        await this.rating.award(event);
      }
    }
  }

  canCreate(user: SessionUser) {
    return user.kind === 'dev' || env.adminIds.includes(user.id);
  }

  private canManageEvent(user: SessionUser, event: CommunityEvent) {
    return (
      this.canCreate(user) ||
      event.createdBy === user.id ||
      (event.coordinatorIds ?? []).includes(user.id)
    );
  }

  list(user: SessionUser) {
    const canCreate = this.canCreate(user);
    const events = this.store
      .read()
      .events.filter(
        (event) => this.canManageEvent(user, event) || event.status === 'published',
      )
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
      .map((event) => this.project(event, user.id, this.canManageEvent(user, event)));
    return { events, canCreate };
  }

  create(user: SessionUser, input: Record<string, unknown>) {
    if (!this.canCreate(user)) {
      throw new ForbiddenException('Создавать мероприятия могут только администраторы.');
    }
    const title = String(input.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const location = String(input.location ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
    const description = String(input.description ?? '').trim().slice(0, 2000);
    const startsAt = new Date(String(input.startsAt ?? ''));
    if (!title) throw new BadRequestException('Укажите название мероприятия.');
    if (!Number.isFinite(startsAt.getTime())) {
      throw new BadRequestException('Укажите дату и время мероприятия.');
    }
    const tags = Array.isArray(input.tags)
      ? [...new Set(input.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))].slice(0, 12)
      : [];
    const coordinatorIds = this.parseCoordinatorIds(input.coordinatorIds);
    const event: CommunityEvent = {
      id: randomUUID(),
      title,
      description,
      location,
      startsAt: startsAt.toISOString(),
      tags,
      category: ['volunteer', 'entertainment', 'other'].includes(String(input.category))
        ? String(input.category) as CommunityEvent['category'] : 'other',
      durationMinutes: this.parseDuration(input.durationMinutes, 120),
      status: 'published',
      createdBy: user.id,
      coordinatorIds: [...new Set([user.id, ...coordinatorIds])],
      createdAt: Date.now(),
      rsvps: [],
      attendanceRequired: input.attendanceRequired === true,
      attendance: [],
      goingReminderHours: this.parseReminderHours(input.goingReminderHours, [24, 3]),
      maybeReminderHours: this.parseReminderHours(input.maybeReminderHours, [72, 24, 3]),
      goingReminders: this.rulesBeforeStart(
        this.parseReminderRules(input.goingReminders, [24, 3]), startsAt,
      ),
      maybeReminders: this.rulesBeforeStart(
        this.parseReminderRules(input.maybeReminders, [72, 24, 3]), startsAt,
      ),
    };
    this.store.update((current) => ({ events: [...current.events, event] }));
    return this.project(event, user.id, true);
  }

  rsvp(user: SessionUser, id: string, status: string, reason: string) {
    if (!(['going', 'declined', 'maybe'] as string[]).includes(status)) {
      throw new BadRequestException('Выберите: иду, не иду или пока думаю.');
    }
    let updated: CommunityEvent | null = null;
    this.store.update((current) => ({
      events: current.events.map((event) => {
        if (event.id !== id) return event;
        if (event.status !== 'published') {
          throw new BadRequestException('На это мероприятие запись закрыта.');
        }
        const response = {
          userId: user.id,
          name: user.name,
          status: status as RsvpStatus,
          reason: status === 'declined' ? reason.trim().slice(0, 500) : undefined,
          updatedAt: Date.now(),
        };
        updated = {
          ...event,
          rsvps: [
            ...event.rsvps.filter((item) => item.userId !== user.id),
            response,
          ],
          rsvpHistory: [...(event.rsvpHistory ?? []), response],
        };
        return updated;
      }),
    }));
    if (!updated) throw new NotFoundException('Мероприятие не найдено.');
    return this.project(updated, user.id, this.canManageEvent(user, updated));
  }

  getPublished(id: string) {
    const event = this.store.read().events.find((item) => item.id === id);
    return event?.status === 'published' ? event : null;
  }

  getById(id: string) {
    return this.store.read().events.find((item) => item.id === id) ?? null;
  }

  update(user: SessionUser, id: string, input: Record<string, unknown>) {
    let updated: CommunityEvent | null = null;
    this.store.update((current) => ({
      events: current.events.map((event) => {
        if (event.id !== id) return event;
        if (!this.canManageEvent(user, event)) {
          throw new ForbiddenException('Редактировать мероприятие может только координатор.');
        }
        if (event.finalizedAt) {
          throw new BadRequestException('Итоги уже зафиксированы — мероприятие закрыто.');
        }
        const title = String(input.title ?? event.title).replace(/\s+/g, ' ').trim().slice(0, 120);
        const location = String(input.location ?? event.location).replace(/\s+/g, ' ').trim().slice(0, 160);
        const description = String(input.description ?? event.description).trim().slice(0, 2000);
        const startsAt = new Date(String(input.startsAt ?? event.startsAt));
        if (!title) throw new BadRequestException('Укажите название мероприятия.');
        if (!Number.isFinite(startsAt.getTime())) throw new BadRequestException('Укажите дату и время мероприятия.');
        const tags = Array.isArray(input.tags)
          ? [...new Set(input.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))].slice(0, 12)
          : event.tags;
        const category = ['volunteer', 'entertainment', 'other'].includes(String(input.category))
          ? String(input.category) as CommunityEvent['category']
          : event.category ?? 'other';
        const goingReminderHours = this.parseReminderHours(input.goingReminderHours, event.goingReminderHours ?? [24, 3]);
        const maybeReminderHours = this.parseReminderHours(input.maybeReminderHours, event.maybeReminderHours ?? [72, 24, 3]);
        const goingReminders = this.rulesBeforeStart(Array.isArray(input.goingReminders)
          ? this.parseReminderRules(input.goingReminders, [])
          : event.goingReminders ?? this.rulesFromHours(event.goingReminderHours ?? [24, 3]), startsAt);
        const maybeReminders = this.rulesBeforeStart(Array.isArray(input.maybeReminders)
          ? this.parseReminderRules(input.maybeReminders, [])
          : event.maybeReminders ?? this.rulesFromHours(event.maybeReminderHours ?? [72, 24, 3]), startsAt);
        const timingChanged = startsAt.toISOString() !== event.startsAt ||
          JSON.stringify(goingReminderHours) !== JSON.stringify(event.goingReminderHours ?? [24, 3]) ||
          JSON.stringify(maybeReminderHours) !== JSON.stringify(event.maybeReminderHours ?? [72, 24, 3]) ||
          JSON.stringify(goingReminders) !== JSON.stringify(event.goingReminders ?? this.rulesFromHours(event.goingReminderHours ?? [24, 3])) ||
          JSON.stringify(maybeReminders) !== JSON.stringify(event.maybeReminders ?? this.rulesFromHours(event.maybeReminderHours ?? [72, 24, 3]));
        const allowedStatuses = ['draft', 'published', 'cancelled'];
        const status = allowedStatuses.includes(String(input.status))
          ? String(input.status) as CommunityEvent['status']
          : event.status;
        updated = {
          ...event, title, location, description, startsAt: startsAt.toISOString(), tags, status, category,
          attendanceRequired: typeof input.attendanceRequired === 'boolean'
            ? input.attendanceRequired : event.attendanceRequired,
          goingReminderHours, maybeReminderHours,
          goingReminders, maybeReminders,
          ...(timingChanged ? { reminderAttempts: [] } : {}),
          durationMinutes: this.parseDuration(input.durationMinutes, event.durationMinutes ?? 120),
        };
        return updated;
      }),
    }));
    if (!updated) throw new NotFoundException('Мероприятие не найдено.');
    return this.project(updated, user.id, true);
  }

  setAnnouncementMessages(id: string, messages: Array<{ chatId: number; messageId: number }>) {
    this.store.update((current) => ({ events: current.events.map((event) =>
      event.id === id ? { ...event, announcementMessages: messages } : event),
    }));
  }

  dueReminders(now = Date.now()): EventReminder[] {
    const jobs: EventReminder[] = [];
    for (const event of this.store.read().events) {
      if (event.status !== 'published') continue;
      const remaining = new Date(event.startsAt).getTime() - now;
      if (remaining <= 0) continue;
      const hoursRemaining = remaining / 3_600_000;
      for (const response of event.rsvps) {
        const rules = response.status === 'maybe'
          ? event.maybeReminders ?? this.rulesFromHours(event.maybeReminderHours ?? [72, 24, 3])
          : response.status === 'going'
            ? event.goingReminders ?? this.rulesFromHours(event.goingReminderHours ?? [24, 3])
            : [];
        const due = rules.map((rule) => ({ rule, triggerAt: this.triggerAt(rule, event.startsAt) }))
          .filter((item) => item.triggerAt <= now)
          .sort((a, b) => b.triggerAt - a.triggerAt);
        const attempted = event.reminderAttempts ?? [];
        const pending = due.filter(({ rule }) => !attempted.includes(this.reminderKey(response.userId, rule)));
        if (!pending.length) continue;
        const chosen = pending[0];
        const key = this.reminderKey(response.userId, chosen.rule);
        jobs.push({
          eventId: event.id,
          title: event.title,
          startsAt: event.startsAt,
          userId: response.userId,
          status: response.status,
          hoursBefore: Math.max(0, Math.round(hoursRemaining)),
          key,
          relatedKeys: pending.map(({ rule }) => this.reminderKey(response.userId, rule)),
        });
      }
    }
    return jobs;
  }

  markReminderAttempts(eventId: string, keys: string[]) {
    this.store.update((current) => ({ events: current.events.map((event) =>
      event.id === eventId
        ? { ...event, reminderAttempts: [...new Set([...(event.reminderAttempts ?? []), ...keys])] }
        : event),
    }));
  }

  setCoordinators(user: SessionUser, id: string, rawIds: unknown) {
    let updated: CommunityEvent | null = null;
    this.store.update((current) => ({
      events: current.events.map((event) => {
        if (event.id !== id) return event;
        if (!this.canCreate(user) && event.createdBy !== user.id) {
          throw new ForbiddenException(
            'Назначать координаторов может автор мероприятия или администратор.',
          );
        }
        updated = {
          ...event,
          coordinatorIds: [
            ...new Set([event.createdBy, ...this.parseCoordinatorIds(rawIds)]),
          ],
        };
        return updated;
      }),
    }));
    if (!updated) throw new NotFoundException('Мероприятие не найдено.');
    return this.project(updated, user.id, true);
  }

  setAttendance(user: SessionUser, id: string, userId: number, name: string, present: boolean) {
    let updated: CommunityEvent | null = null;
    this.store.update((current) => ({ events: current.events.map((event) => {
      if (event.id !== id) return event;
      if (!this.canManageEvent(user, event)) throw new ForbiddenException('Явку отмечает координатор.');
      if (event.finalizedAt) throw new BadRequestException('Итоги мероприятия уже зафиксированы.');
      const attendance = event.attendance ?? [];
      updated = { ...event, attendance: present
        ? attendance.some((item) => item.userId === userId) ? attendance
          : [...attendance, { userId, name: name.trim().slice(0, 120) || `id${userId}`, confirmedAt: Date.now() }]
        : attendance.filter((item) => item.userId !== userId) };
      return updated;
    }) }));
    if (!updated) throw new NotFoundException('Мероприятие не найдено.');
    return this.project(updated, user.id, true);
  }

  async finalize(user: SessionUser, id: string) {
    let finalized: CommunityEvent | null = null;
    this.store.update((current) => ({ events: current.events.map((event) => {
      if (event.id !== id) return event;
      if (!this.canManageEvent(user, event)) throw new ForbiddenException('Итоги фиксирует координатор.');
      if (event.finalizedAt) throw new BadRequestException('Итоги уже были зафиксированы.');
      finalized = { ...event, status: 'completed', finalizedAt: Date.now() };
      return finalized;
    }) }));
    if (!finalized) throw new NotFoundException('Мероприятие не найдено.');
    const reliability = this.reliability.apply(finalized);
    await this.rating?.award(finalized);
    return { event: this.project(finalized, user.id, true), reliability };
  }

  async listReliability() {
    const reliability = this.reliability.list();
    return { profiles: this.rating ? await this.rating.list(reliability) : reliability };
  }

  generateAttendanceCode(user: SessionUser, id: string) {
    let updated: CommunityEvent | null = null;
    this.store.update((current) => ({
      events: current.events.map((event) => {
        if (event.id !== id) return event;
        if (!this.canManageEvent(user, event)) {
          throw new ForbiddenException('Код присутствия доступен только координаторам.');
        }
        if (!event.attendanceRequired) {
          throw new BadRequestException('Для мероприятия не включено подтверждение присутствия.');
        }
        if (event.status !== 'published') {
          throw new BadRequestException('Мероприятие уже закрыто.');
        }
        updated = { ...event, attendanceCode: String(randomInt(100000, 1000000)) };
        return updated;
      }),
    }));
    if (!updated) throw new NotFoundException('Мероприятие не найдено.');
    return this.project(updated, user.id, true);
  }

  confirmAttendance(user: SessionUser, id: string, rawCode: string) {
    const code = rawCode.replace(/\D/g, '').slice(0, 6);
    let updated: CommunityEvent | null = null;
    this.store.update((current) => ({
      events: current.events.map((event) => {
        if (event.id !== id) return event;
        if (!event.attendanceRequired || !event.attendanceCode) {
          throw new BadRequestException('Координатор ещё не открыл подтверждение присутствия.');
        }
        if (event.attendanceCode !== code) {
          throw new BadRequestException('Неверный код присутствия.');
        }
        const response = event.rsvps.find((item) => item.userId === user.id);
        if (response?.status !== 'going') {
          throw new BadRequestException('Сначала отметьте, что вы идёте на мероприятие.');
        }
        const attendance = event.attendance ?? [];
        updated = {
          ...event,
          attendance: attendance.some((item) => item.userId === user.id)
            ? attendance
            : [...attendance, { userId: user.id, name: user.name, confirmedAt: Date.now() }],
        };
        return updated;
      }),
    }));
    if (!updated) throw new NotFoundException('Мероприятие не найдено.');
    return this.project(updated, user.id, this.canManageEvent(user, updated));
  }

  private parseCoordinatorIds(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => Number(item))
      .filter((id) => Number.isSafeInteger(id) && id > 0)
      .slice(0, 30);
  }

  private parseDuration(value: unknown, fallback: number) {
    const minutes = Math.round(Number(value));
    return Number.isFinite(minutes) ? Math.min(24 * 60, Math.max(30, minutes)) : fallback;
  }

  private parseReminderHours(value: unknown, fallback: number[]) {
    if (!Array.isArray(value)) return fallback;
    return [...new Set(value.map(Number).filter((hours) =>
      Number.isFinite(hours) && hours >= 1 && hours <= 24 * 30,
    ))].sort((a, b) => b - a).slice(0, 10);
  }

  private parseReminderRules(value: unknown, fallbackHours: number[]): ReminderRule[] {
    if (!Array.isArray(value)) return this.rulesFromHours(fallbackHours);
    const rules: ReminderRule[] = [];
    for (const raw of value.slice(0, 20)) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Record<string, unknown>;
      if (item.type === 'relative') {
        const minutesBefore = Math.round(Number(item.minutesBefore));
        if (minutesBefore >= 1 && minutesBefore <= 60 * 24 * 30) {
          rules.push({ type: 'relative', minutesBefore });
        }
      } else if (item.type === 'absolute') {
        const at = new Date(String(item.at ?? ''));
        if (Number.isFinite(at.getTime())) rules.push({ type: 'absolute', at: at.toISOString() });
      }
    }
    return rules.filter((rule, index) =>
      rules.findIndex((candidate) => this.ruleId(candidate) === this.ruleId(rule)) === index,
    );
  }

  private rulesFromHours(hours: number[]): ReminderRule[] {
    return hours.map((value) => ({ type: 'relative', minutesBefore: value * 60 }));
  }

  private rulesBeforeStart(rules: ReminderRule[], startsAt: Date) {
    return rules.filter((rule) =>
      rule.type === 'relative' || new Date(rule.at).getTime() < startsAt.getTime(),
    );
  }

  private triggerAt(rule: ReminderRule, startsAt: string) {
    return rule.type === 'absolute'
      ? new Date(rule.at).getTime()
      : new Date(startsAt).getTime() - rule.minutesBefore * 60_000;
  }

  private ruleId(rule: ReminderRule) {
    return rule.type === 'absolute' ? `at:${rule.at}` : `before:${rule.minutesBefore}`;
  }

  private reminderKey(userId: number, rule: ReminderRule) {
    return `${userId}:${this.ruleId(rule)}`;
  }

  private project(event: CommunityEvent, userId: number, canManage: boolean) {
    const counts = { going: 0, declined: 0, maybe: 0 };
    for (const response of event.rsvps) counts[response.status] += 1;
    const mine = event.rsvps.find((response) => response.userId === userId);
    const attendance = event.attendance ?? [];
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: event.startsAt,
      tags: event.tags,
      category: event.category ?? 'other',
      durationMinutes: event.durationMinutes ?? 120,
      status: event.status,
      counts,
      myRsvp: mine?.status ?? null,
      attendanceRequired: event.attendanceRequired ?? false,
      attendanceOpen: Boolean(event.attendanceCode),
      isPresent: attendance.some((item) => item.userId === userId),
      attendanceCount: attendance.length,
      canManage,
      canAssignCoordinators:
        env.adminIds.includes(userId) || event.createdBy === userId,
      coordinatorIds: event.coordinatorIds ?? [event.createdBy],
      goingReminderHours: event.goingReminderHours ?? [24, 3],
      maybeReminderHours: event.maybeReminderHours ?? [72, 24, 3],
      goingReminders: event.goingReminders ?? this.rulesFromHours(event.goingReminderHours ?? [24, 3]),
      maybeReminders: event.maybeReminders ?? this.rulesFromHours(event.maybeReminderHours ?? [72, 24, 3]),
      finalizedAt: event.finalizedAt ?? null,
      ...(canManage
        ? { responses: event.rsvps, attendance, attendanceCode: event.attendanceCode ?? null }
        : {}),
    };
  }
}
