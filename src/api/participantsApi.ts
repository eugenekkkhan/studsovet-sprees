import { request } from "./http";
import type { Faculty } from "../constants/faculties";

export interface ParticipantProfile {
  userId: number;
  name: string;
  username: string;
  telegramName: string;
  firstName: string;
  lastName: string;
  faculty: Faculty | null;
  educationLevel: EducationLevel | null;
  photoUrl: string;
  course: number | null;
  birthday: string | null;
  createdAt: number;
  lastSeenAt: number;
  chats: Array<{ chatId: number; role: string; active: boolean }>;
}

export type EducationLevel = "bachelor" | "master" | "postgraduate" | "specialist";

export interface ParticipantChat {
  chatId: number;
  title: string;
}

export const fetchParticipants = () =>
  request<{ participants: ParticipantProfile[]; chats: ParticipantChat[]; canManageAll: boolean }>("/participants");

export const fetchParticipant = (userId: number) =>
  request<{ participant: ParticipantProfile; chats: ParticipantChat[]; canEdit: boolean }>(`/participants/${userId}`);

export const updateParticipant = (
  userId: number,
  value: Pick<ParticipantProfile, "firstName" | "lastName" | "faculty" | "educationLevel" | "course" | "birthday">,
) => request<Omit<ParticipantProfile, "chats">>(`/participants/${userId}`, {
  method: "PATCH",
  body: JSON.stringify(value),
});
