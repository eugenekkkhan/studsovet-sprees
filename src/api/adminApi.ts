import { request } from "./http";

export type FeatureKey =
  | "events"
  | "rating"
  | "participants"
  | "roulette"
  | "fieldOfMiracles"
  | "quiz";

export type FeatureFlags = Record<FeatureKey, boolean>;

export interface AdminPerson {
  userId: number;
  name: string;
  username: string;
  root?: boolean;
}

export interface AdminConfig {
  features: FeatureFlags;
  isAdmin: boolean;
}

export interface ActiveGameSession {
  game: "quiz" | "fieldOfMiracles";
  code: string;
  ownerUserId: number | null;
  ownerName: string;
  ownerUsername: string;
  createdAt: number;
  lastActivityAt: number;
  teamCount: number;
}

export interface AdminDashboard extends AdminConfig {
  admins: AdminPerson[];
  candidates: AdminPerson[];
  blockedCreatorIds: number[];
  sessions: ActiveGameSession[];
}

export const fetchAdminConfig = () => request<AdminConfig>("/admin/config");
export const fetchAdminDashboard = () => request<AdminDashboard>("/admin");
export const setFeatureEnabled = (key: FeatureKey, enabled: boolean) =>
  request<{ features: FeatureFlags }>(`/admin/features/${key}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
export const grantAdmin = (userId: number) =>
  request<AdminDashboard>(`/admin/admins/${userId}`, { method: "POST" });
export const revokeAdmin = (userId: number) =>
  request<AdminDashboard>(`/admin/admins/${userId}`, { method: "DELETE" });
export const terminateGameSession = (game: ActiveGameSession["game"], code: string) =>
  request<{ ok: true }>(`/admin/sessions/${game}/${encodeURIComponent(code)}`, { method: "DELETE" });
export const setSessionCreationBlocked = (userId: number, blocked: boolean) =>
  request<{ blocked: boolean }>(`/admin/session-creation-bans/${userId}`, {
    method: blocked ? "POST" : "DELETE",
  });
