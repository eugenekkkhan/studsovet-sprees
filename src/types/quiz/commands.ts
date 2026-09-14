import type { Deck } from "./deck";
import type { GameSettings } from "./game";

/** Команды пульта ведущего. Формат совпадает с движком на бэкенде. */
export type HostCommand =
  | { type: "ADD_TEAM"; name: string; color: string }
  | { type: "REMOVE_TEAM"; teamId: string }
  | { type: "UPDATE_TEAM"; teamId: string; name: string; color: string }
  | { type: "SET_TEAM_SCORE"; teamId: string; score: number }
  | { type: "SET_SETTINGS"; settings: Partial<GameSettings> }
  | { type: "LOAD_DECK"; deck: Deck }
  | { type: "START_ROUND"; roundIndex: number }
  | { type: "SET_PICKER"; teamId: string }
  | { type: "PICK_QUESTION"; questionId: string }
  | { type: "ASSIGN_SECRET"; teamId: string }
  | {
      type: "PLACE_BID";
      teamId: string;
      action: "bid" | "pass" | "all-in";
      amount: number;
    }
  | { type: "SET_BUZZ"; open: boolean }
  | { type: "BUZZ"; teamId: string }
  | { type: "JUDGE"; correct: boolean }
  | { type: "NO_ANSWER" }
  | { type: "CLOSE_QUESTION" }
  | { type: "END_ROUND" }
  | { type: "START_FINAL" }
  | { type: "FINAL_REMOVE_THEME"; themeId: string }
  | { type: "FINAL_BET"; teamId: string; amount: number }
  | { type: "FINAL_ANSWER"; teamId: string; text: string }
  | { type: "FINAL_LOCK_ANSWERS" }
  | { type: "FINAL_REVEAL_NEXT" }
  | { type: "FINAL_JUDGE"; teamId: string; correct: boolean }
  | { type: "NEW_GAME" }
  | { type: "UNDO" };

/** Что капитан отправляет со своего телефона — teamId проставляет сервер. */
export type ParticipantCommand =
  | { type: "PICK_QUESTION"; questionId: string }
  | { type: "ASSIGN_SECRET"; teamId: string }
  | { type: "PLACE_BID"; action: "bid" | "pass" | "all-in"; amount: number }
  | { type: "BUZZ" }
  | { type: "FINAL_REMOVE_THEME"; themeId: string }
  | { type: "FINAL_BET"; amount: number }
  | { type: "FINAL_ANSWER"; text: string };
