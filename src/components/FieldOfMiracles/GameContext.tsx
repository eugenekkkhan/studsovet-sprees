import { createContext } from "react";
import { Team } from "./types";

interface GameContextType {
  teams: Team[];
  addTeam: (name: string, color: string) => void;
  removeTeam: (name: string) => void;
  setPoints: (teamName: string) => (points: number) => void;
  activeTeam?: Team;
  setNewActiveTeam?: () => void;
}

const GameContext = createContext({
  teams: [],
  addTeam: () => {},
  setPoints: () => () => {},
  removeTeam: () => {},
  activeTeam: undefined,
  setNewActiveTeam: () => {},
} as GameContextType);

export default GameContext;