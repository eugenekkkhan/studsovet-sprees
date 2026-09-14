export type EventStatus = 'draft' | 'published' | 'completed' | 'cancelled';
export type EventCategory = 'volunteer' | 'entertainment' | 'other';
export type RsvpStatus = 'going' | 'declined' | 'maybe';
export type ReminderRule =
  | { type: 'relative'; minutesBefore: number }
  | { type: 'absolute'; at: string };

export interface EventRsvp {
  userId: number;
  name: string;
  status: RsvpStatus;
  reason?: string;
  updatedAt: number;
}

export interface EventAttendance {
  userId: number;
  name: string;
  confirmedAt: number;
}

export interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  tags: string[];
  category: EventCategory;
  durationMinutes: number;
  status: EventStatus;
  createdBy: number;
  coordinatorIds: number[];
  createdAt: number;
  rsvps: EventRsvp[];
  attendanceRequired: boolean;
  attendanceCode?: string;
  attendance: EventAttendance[];
  reminderAttempts?: string[];
  goingReminderHours?: number[];
  maybeReminderHours?: number[];
  goingReminders?: ReminderRule[];
  maybeReminders?: ReminderRule[];
  announcementMessages?: Array<{ chatId: number; messageId: number }>;
  rsvpHistory?: EventRsvp[];
  finalizedAt?: number;
}
