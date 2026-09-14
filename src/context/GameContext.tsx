import { createContext } from "react";
import type { FieldGameViewState, Sector, Team } from "../types/fieldOfMiracles";

export interface StartRoundPayload {
  category: string;
  clue: string;
  answer: string;
}

export interface GameContextType {
  game: FieldGameViewState;
  teams: Team[];
  activeTeam: Team | null;
  currentSector: Sector | null;
  sessionCode: string;
  joinUrl: string;
  hostJoinUrl: string;
  /** Экран для зала: слово под маской, барабан и счёт, без ответа. */
  boardUrl: string;
  connectionStatus: "connecting" | "connected" | "disconnected";
  connectionError: string | null;
  addTeam: (name: string, color: string) => void;
  removeTeam: (teamId: string) => void;
  updateTeam: (teamId: string, name: string, color: string) => void;
  setPoints: (teamId: string, points: number) => void;
  startRound: (payload: StartRoundPayload) => void;
  beginSpin: () => void;
  guessLetter: (letter: string) => void;
  choosePosition: (index: number) => void;
  attemptSolve: (answer: string) => void;
  resolveSpecial: (success: boolean) => void;
  passTurn: () => void;
  undo: () => void;
  newGame: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

export default GameContext;
