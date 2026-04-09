import { useEffect, useState } from "react";
import GameContext from "./GameContext";
import TeamSection from "./TeamSection/TeamSection";
import { Team } from "./types";
import WheelSection from "./WheelSection/WheelSection";
import LetterSection from "./LetterSection/LetterSection";

const TEAMS_STORAGE_KEY = "fieldOfMiraclesTeams";

const readTeamsFromStorage = (): Team[] => {
  try {
    const raw = localStorage.getItem(TEAMS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (team): team is Team =>
        typeof team?.name === "string" &&
        typeof team?.points === "number" &&
        typeof team?.color === "string" &&
        typeof team?.isActive === "boolean",
    );
  } catch {
    return [];
  }
};

const FieldOfMiracles = () => {
  const [teams, setTeams] = useState<Team[]>(readTeamsFromStorage);
  const addTeam = (name: string, color: string) => {
    setTeams((prevTeams) =>
      !prevTeams.some((team) => team.name === name)
        ? [
            ...prevTeams,
            { name, points: 0, color: color ?? "#ccc", isActive: false },
          ]
        : prevTeams,
    );
  };
  const removeTeam = (name: string) => {
    setTeams((prevTeams) => prevTeams.filter((team) => team.name !== name));
  };
  const setPoints = (teamName: string) => (points: number) => {
    setTeams((prevTeams) =>
      prevTeams.map((team) =>
        team.name === teamName ? { ...team, points } : team,
      ),
    );
  };

  const [activeTeam, setActiveTeam] = useState<Team | undefined>(undefined);

  useEffect(() => {
    localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teams));
  }, [teams]);

  const setNewActiveTeam = () => {
    if (teams.length === 0) {
      setActiveTeam(undefined);
      return;
    }
    const currentIndex = teams.findIndex(
      (team) => team.name === activeTeam?.name,
    );
    const nextIndex = (currentIndex + 1) % teams.length;
    setActiveTeam(teams[nextIndex]);
  };

  return (
    <GameContext.Provider
      value={{
        teams,
        addTeam,
        setPoints,
        removeTeam,
        activeTeam,
        setNewActiveTeam,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "32px",
        }}
      >
        <LetterSection />
        <WheelSection />
        <TeamSection />
      </div>
    </GameContext.Provider>
  );
};

export default FieldOfMiracles;
