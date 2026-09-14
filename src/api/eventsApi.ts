import { request } from "./http";

export type RsvpStatus = "going" | "declined" | "maybe";
export type ReminderRule =
  | { type: "relative"; minutesBefore: number }
  | { type: "absolute"; at: string };

export interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  tags: string[];
  status: "draft" | "published" | "completed" | "cancelled";
  category: "volunteer" | "entertainment" | "other";
  durationMinutes: number;
  counts: Record<RsvpStatus, number>;
  myRsvp: RsvpStatus | null;
  attendanceRequired: boolean;
  attendanceOpen: boolean;
  isPresent: boolean;
  attendanceCount: number;
  attendanceCode?: string | null;
  canManage: boolean;
  canAssignCoordinators: boolean;
  coordinatorIds: number[];
  goingReminderHours: number[];
  maybeReminderHours: number[];
  goingReminders: ReminderRule[];
  maybeReminders: ReminderRule[];
  finalizedAt: number | null;
  responses?: Array<{ userId: number; name: string; status: RsvpStatus; reason?: string }>;
  attendance?: Array<{ userId: number; name: string; confirmedAt: number }>;
}

export interface ReliabilityProfile {
  userId: number;
  name: string;
  username?: string;
  reliability: number;
  recoveryProgress: number;
  course?: number | null;
  faculty?: import("../constants/faculties").Faculty | null;
  eventPoints?: number;
  rating?: number;
  activity?: {
    messages: number;
    reactionsGiven: number;
    reactionsReceived: number;
    currentStreak: number;
  };
  scoreEntries?: Array<{
    eventId: string;
    eventTitle: string;
    category: CommunityEvent["category"];
    durationMinutes: number;
    basePoints: number;
    urgencyMultiplier: number;
    courseMultiplier: number;
    points: number;
    createdAt: number;
  }>;
  entries?: Array<{
    eventId: string;
    eventTitle: string;
    delta: number;
    reason: "attended" | "late_cancel" | "no_show";
    createdAt: number;
  }>;
}

export interface EventsResponse {
  events: CommunityEvent[];
  canCreate: boolean;
}

export const fetchEvents = () => request<EventsResponse>("/events");

export const createEvent = (value: {
  title: string;
  description: string;
  location: string;
  startsAt: string;
  tags: string[];
  category: CommunityEvent["category"];
  durationMinutes: number;
  attendanceRequired: boolean;
  coordinatorIds: number[];
  goingReminderHours: number[];
  maybeReminderHours: number[];
  goingReminders: ReminderRule[];
  maybeReminders: ReminderRule[];
}) => request<CommunityEvent>("/events", {
  method: "POST",
  body: JSON.stringify(value),
});

export const updateEvent = (id: string, value: {
  title: string;
  description: string;
  location: string;
  startsAt: string;
  tags: string[];
  category: CommunityEvent["category"];
  durationMinutes: number;
  attendanceRequired: boolean;
  goingReminderHours: number[];
  maybeReminderHours: number[];
  goingReminders: ReminderRule[];
  maybeReminders: ReminderRule[];
  status: CommunityEvent["status"];
}) => request<CommunityEvent>(`/events/${encodeURIComponent(id)}`, {
  method: "PUT",
  body: JSON.stringify(value),
});

export const setManualAttendance = (
  id: string, userId: number, name: string, present: boolean,
) => request<CommunityEvent>(`/events/${encodeURIComponent(id)}/attendance/manual`, {
  method: "POST",
  body: JSON.stringify({ userId, name, present }),
});

export const finalizeEvent = (id: string) => request<{
  event: CommunityEvent;
  reliability: ReliabilityProfile[];
}>(`/events/${encodeURIComponent(id)}/finalize`, { method: "POST" });

export const fetchReliability = () => request<{ profiles: ReliabilityProfile[] }>(
  "/events/reliability",
);

export const setEventCoordinators = (id: string, coordinatorIds: number[]) =>
  request<CommunityEvent>(`/events/${encodeURIComponent(id)}/coordinators`, {
    method: "PATCH",
    body: JSON.stringify({ coordinatorIds }),
  });

export const generateAttendanceCode = (id: string) =>
  request<CommunityEvent>(`/events/${encodeURIComponent(id)}/attendance/code`, {
    method: "POST",
  });

export const confirmAttendance = (id: string, code: string) =>
  request<CommunityEvent>(`/events/${encodeURIComponent(id)}/attendance/confirm`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });

export const respondToEvent = (
  id: string,
  status: RsvpStatus,
  reason = "",
) => request<CommunityEvent>(`/events/${encodeURIComponent(id)}/rsvp`, {
  method: "POST",
  body: JSON.stringify({ status, reason }),
});
