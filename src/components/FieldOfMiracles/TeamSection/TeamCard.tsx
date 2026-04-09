import { useContext, useState } from "react";
import { Team } from "../types";
import {
  IoSettingsOutline,
  IoCloseOutline,
  IoTrashBinOutline,
  IoFootsteps,
} from "react-icons/io5";
import GameContext from "../GameContext";

const makeMoreContrast = (color: string) => {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const avg = (r + g + b) / 3;
  if (avg > 128) {
    return `rgb(${Math.max(r - 50, 0)}, ${Math.max(g - 50, 0)}, ${Math.max(
      b - 50,
      0,
    )})`;
  } else {
    return `rgb(${Math.min(r + 50, 255)}, ${Math.min(g + 50, 255)}, ${Math.min(
      b + 50,
      255,
    )})`;
  }
};

const addOpacity = (color: string, opacity: number) => {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const TeamCard = ({
  team,
  setPoints,
}: {
  team: Team;
  setPoints: (points: number) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [mode, setMode] = useState<"edit" | "add">("edit");
  const [addValue, setAddValue] = useState(0);

  const { removeTeam, activeTeam } = useContext(GameContext);

  return (
    <div
      style={{
        border: `1px solid ${team.color}`,
        color: makeMoreContrast(team.color),
        background: "rgba(255, 255, 255, 0.8)",
        borderRadius: "24px",
        padding: "16px",
        gap: "8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backdropFilter: "blur(4px)",
      }}
    >
      <h3>
        {team.name} {activeTeam?.name === team.name && <IoFootsteps />}
      </h3>
      <p>
        {team.points}{" "}
        {team.points % 10 === 1
          ? "очка"
          : team.points % 10 < 5
            ? "очка"
            : "очков"}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {isEditing ? (
          <>
            <form
              style={{ display: "flex", gap: "8px" }}
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="number"
                value={mode === "edit" ? team.points : addValue}
                style={{ width: "100%" }}
                onChange={(e) => {
                  if (mode === "edit") {
                    setPoints(Number(e.target.value));
                  } else {
                    setAddValue(Number(e.target.value));
                  }
                }}
              />
              <button
                style={{ background: "#75b666", color: "white" }}
                onClick={() => {
                  if (mode === "edit") {
                    setPoints(team.points + 1);
                  } else {
                    setPoints(team.points + addValue);
                  }
                }}
              >
                +
              </button>
              <button
                style={{ background: "#cb4d4d", color: "white" }}
                onClick={() => {
                  if (mode === "edit") {
                    setPoints(team.points - 1);
                  } else {
                    setPoints(team.points - addValue);
                  }
                }}
              >
                -
              </button>
              <button
                className="round-button"
                onClick={() => setIsEditing(false)}
              >
                <IoCloseOutline style={{ width: "120px" }} />
              </button>
            </form>
            <div
              style={{
                borderRadius: "8px",
                overflow: "hidden",
                width: "100%",
                display: "flex",
              }}
            >
              <button
                style={{
                  color: mode === "edit" ? "white" : "black",
                  background: mode === "edit" ? "#497ad4" : "lightgray",
                  borderRadius: "8px 0 0 8px",
                  width: "100%",
                }}
                onClick={() => setMode("edit")}
              >
                Редактирование
              </button>
              <button
                style={{
                  color: mode === "add" ? "white" : "black",
                  background: mode === "add" ? "#497ad4" : "lightgray",
                  borderRadius: "0 8px 8px 0",
                  width: "100%",
                }}
                onClick={() => setMode("add")}
              >
                Добавление
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="round-button" onClick={() => setIsEditing(true)}>
              <IoSettingsOutline />
            </button>
            <button
              className="round-button"
              onClick={() => removeTeam(team.name)}
            >
              <IoTrashBinOutline />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const MinTeamCard = ({ team }: { team: Team }) => {
  const { activeTeam } = useContext(GameContext);
  return (
    <div
      style={{
        border: `1px solid ${team.color}`,
        color: makeMoreContrast(team.color),
        background: "rgba(255, 255, 255, 0.8)",
        borderRadius: "24px",
        padding: "16px",
        gap: "8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backdropFilter: "blur(4px)",
      }}
    >
      <h3>
        {team.name} {activeTeam?.name === team.name && <IoFootsteps />}
      </h3>
      <p>
        {team.points}{" "}
        {team.points === 1 ? "очка" : team.points < 5 ? "очка" : "очков"}
      </p>
    </div>
  );
};

export default TeamCard;
export { MinTeamCard };
