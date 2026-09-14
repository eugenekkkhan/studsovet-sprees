import { JsonStore } from '../storage/json-store';
import type { CommunityEvent } from './types';

export interface ReliabilityEntry {
  eventId: string;
  eventTitle: string;
  delta: number;
  reason: 'attended' | 'late_cancel' | 'no_show';
  createdAt: number;
}

export interface ReliabilityProfile {
  userId: number;
  name: string;
  reliability: number;
  recoveryProgress: number;
  entries: ReliabilityEntry[];
}

interface ReliabilityFile {
  profiles: ReliabilityProfile[];
  processedEventIds: string[];
}

export class ReliabilityStore {
  private readonly store = new JsonStore<ReliabilityFile>('reliability.json', () => ({
    profiles: [],
    processedEventIds: [],
  }));

  list() {
    return this.store.read().profiles
      .map((profile) => ({ ...profile, entries: profile.entries.slice(-20) }))
      .sort((left, right) => right.reliability - left.reliability || left.name.localeCompare(right.name));
  }

  apply(event: CommunityEvent) {
    const current = this.store.read();
    if (current.processedEventIds.includes(event.id)) return this.list();
    const profiles = [...current.profiles];
    const attendees = new Set((event.attendance ?? []).map((item) => item.userId));
    const people = new Map<number, string>();
    for (const response of event.rsvps) people.set(response.userId, response.name);
    for (const attendance of event.attendance ?? []) people.set(attendance.userId, attendance.name);

    for (const [userId, name] of people) {
      const response = event.rsvps.find((item) => item.userId === userId);
      const history = (event.rsvpHistory ?? []).filter((item) => item.userId === userId);
      const committedAt = history.find((item) => item.status === 'going')?.updatedAt ??
        (response?.status === 'going' ? response.updatedAt : undefined);
      const cancelledAt = committedAt
        ? history.find((item) => item.updatedAt > committedAt && item.status !== 'going')?.updatedAt
        : undefined;
      let reason: ReliabilityEntry['reason'] | null = null;
      let delta = 0;
      let recovery = 0;

      if (attendees.has(userId)) {
        reason = 'attended';
        recovery = event.category === 'volunteer' ? 1 : event.category === 'entertainment' ? 0.5 : 0.75;
      } else if (response?.status === 'going') {
        reason = 'no_show';
      } else if (cancelledAt) {
        reason = 'late_cancel';
        const hours = (new Date(event.startsAt).getTime() - cancelledAt) / 3_600_000;
        delta = -(hours <= 3 ? 40 : hours <= 24 ? 25 : hours <= 72 ? 15 : 5);
      }
      if (!reason) continue;

      const index = profiles.findIndex((item) => item.userId === userId);
      const before = index >= 0 ? profiles[index] : {
        userId, name, reliability: 100, recoveryProgress: 0, entries: [],
      };
      let reliability = before.reliability;
      let recoveryProgress = before.recoveryProgress;
      if (reason === 'no_show') {
        delta = -reliability;
        reliability = 0;
        recoveryProgress = 0;
      } else if (reason === 'late_cancel') {
        reliability = Math.max(0, reliability + delta);
        recoveryProgress = 0;
      } else {
        recoveryProgress = Math.min(3, recoveryProgress + recovery);
        const restored = Math.round((recoveryProgress / 3) * 100);
        const next = Math.max(reliability, restored);
        delta = next - reliability;
        reliability = next;
      }
      const profile: ReliabilityProfile = {
        ...before, name, reliability, recoveryProgress,
        entries: [...before.entries, { eventId: event.id, eventTitle: event.title, delta, reason, createdAt: Date.now() }],
      };
      if (index >= 0) profiles[index] = profile;
      else profiles.push(profile);
    }

    this.store.write({ profiles, processedEventIds: [...current.processedEventIds, event.id] });
    return this.list();
  }
}
