import React from "react";
import GameContext from "../GameContext";
import TeamCard, { MinTeamCard } from "./TeamCard";

const TeamSection = () => {
  const [addTeamName, setAddTeamName] = React.useState<string>("");
  const [addTeamColor, setAddTeamColor] = React.useState<string>("#ccc");
  const { teams, addTeam, setPoints } = React.useContext(GameContext);
  const [isMinTeamSection, setIsMinTeamSection] = React.useState(true);
  return (
    <div
      style={{
        position: "absolute",
        right: "0",
        top: "0",
        zIndex: 5000,
        maxWidth: isMinTeamSection ? "200px" : "400px",
        height: "100%",
        background:
          "linear-gradient(-90deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.0) 100%)",
      }}
    >
      <div
        style={{
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {!isMinTeamSection && (
          <form
            style={{
              width: "100%",
              display: "flex",
              gap: "8px",
            }}
            onSubmit={(e) => {
              e.preventDefault();
              addTeam(addTeamName, addTeamColor);
              setAddTeamName("");
              setAddTeamColor("#ccc");
            }}
          >
            <input
              type="text"
              style={{ maxHeight: "40px", width: "100%" }}
              value={addTeamName}
              onChange={(e) => setAddTeamName(e.target.value)}
            />
            <input
              type="color"
              onChange={(e) => setAddTeamColor(e.target.value)}
              value={addTeamColor}
              style={{
                width: "78px",
                height: "40px",
                padding: "0",
                border: "none",
                background: "none",
                overflow: "hidden",
              }}
            />
            <button disabled={!addTeamName.trim()}>Добавить</button>
          </form>
        )}
        <button onClick={() => setIsMinTeamSection(!isMinTeamSection)}>
          {isMinTeamSection ? "Развернуть" : "Свернуть"}
        </button>
        <h3 style={{ textAlign: "center" }}>Команды</h3>
        {isMinTeamSection ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {teams.map((team, index) => (
              <MinTeamCard team={team} key={index} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {teams.map((team, index) => (
              <TeamCard
                team={team}
                key={index}
                setPoints={setPoints(team.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamSection;
