export const permissions = [
  'platform.settings.read',
  'platform.settings.update',
  'platform.features.manage',
  'platform.roles.read',
  'platform.roles.assign',
  'platform.roles.define',
  'platform.audit.read',
  'participants.read',
  'participants.profile.update_self',
  'participants.profile.update_any',
  'events.read',
  'events.create',
  'events.update_assigned',
  'events.update_any',
  'events.assign_coordinator',
  'events.attendance.manage',
  'events.finalize',
  'games.sessions.read',
  'games.sessions.terminate',
  'games.creation_bans.manage',
  'decks.moderate',
] as const;

export type Permission = (typeof permissions)[number];

export interface PermissionScope {
  type: 'global' | 'event' | 'self';
  id?: string | number;
}
