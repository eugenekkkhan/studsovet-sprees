import { Injectable } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { DatabaseService } from '../database/database.service';
import type { ReliabilityProfile } from './reliability-store';
import type { CommunityEvent, EventCategory } from './types';

const RATE: Record<EventCategory, number> = { volunteer: 55, entertainment: 25, other: 15 };
export const courseMultiplier = (course: number | null) => course ? 1 + (course - 1) * 0.05 : 1;
export const urgencyMultiplier = (event: CommunityEvent) => {
  const days = Math.max(0, (new Date(event.startsAt).getTime() - event.createdAt) / 86_400_000);
  return days >= 7 ? 1 : Math.min(4, 2 ** ((7 - days) / 3));
};

@Injectable()
export class RatingService {
  constructor(
    private readonly database: DatabaseService,
    private readonly activity: ActivityService,
  ) {}

  async award(event: CommunityEvent) {
    if (!this.database.enabled) return;
    const urgency = urgencyMultiplier(event);
    const duration = event.durationMinutes ?? 120;
    for (const person of event.attendance ?? []) {
      const profile = await this.database.query<{ course: number | null }>(
        'SELECT course FROM participants WHERE user_id = $1', [person.userId],
      );
      const course = courseMultiplier(profile.rows[0]?.course ?? null);
      const base = RATE[event.category ?? 'other'] * (duration / 60);
      const points = Math.round(base * urgency * course);
      await this.database.query(
        `INSERT INTO score_entries
          (event_id, user_id, event_title, category, duration_minutes, base_points,
           urgency_multiplier, course_multiplier, points)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (event_id, user_id) DO NOTHING`,
        [event.id, person.userId, event.title, event.category, duration, base, urgency, course, points],
      );
    }
  }

  async list(reliability: ReliabilityProfile[]) {
    if (!this.database.enabled) return reliability.map((profile) => ({ ...profile, eventPoints: 0, rating: 0, scoreEntries: [] }));
    const participants = await this.database.query<{ user_id: string; name: string; username: string; course: number | null; faculty: string | null }>(
      'SELECT user_id, name, username, course, faculty FROM participants ORDER BY name',
    );
    const entries = await this.database.query<Record<string, unknown>>(
      'SELECT * FROM score_entries ORDER BY created_at DESC',
    );
    const reliabilityByUser = new Map(reliability.map((item) => [item.userId, item]));
    const activity = await this.activity.summaries();
    return participants.rows.map((person) => {
      const userId = Number(person.user_id);
      const profile = reliabilityByUser.get(userId);
      const mine = entries.rows.filter((entry) => Number(entry.user_id) === userId);
      const eventPoints = mine.reduce((sum, entry) => sum + Number(entry.points), 0);
      const reliabilityValue = profile?.reliability ?? 100;
      const chat = activity.get(userId) ?? {
        messages: 0, reactionsGiven: 0, reactionsReceived: 0, currentStreak: 0,
      };
      return {
        userId, name: person.name, username: person.username, course: person.course, faculty: person.faculty,
        reliability: reliabilityValue,
        recoveryProgress: profile?.recoveryProgress ?? 0,
        entries: profile?.entries ?? [],
        eventPoints,
        rating: Math.round(eventPoints * (0.5 + reliabilityValue / 200)),
        activity: chat,
        scoreEntries: mine.slice(0, 20).map((entry) => ({
          eventId: String(entry.event_id), eventTitle: String(entry.event_title),
          category: String(entry.category), durationMinutes: Number(entry.duration_minutes),
          basePoints: Number(entry.base_points), urgencyMultiplier: Number(entry.urgency_multiplier),
          courseMultiplier: Number(entry.course_multiplier), points: Number(entry.points),
          createdAt: new Date(String(entry.created_at)).getTime(),
        })),
      };
    }).sort((a, b) => b.rating - a.rating || b.reliability - a.reliability || a.name.localeCompare(b.name));
  }
}
