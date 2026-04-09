import { useContext, useState } from "react";
import GameContext from "../GameContext";
import { showToast } from "../../Toast/ToastWrapper";

type Sector = {
  label: string;
  color: string;
  image?: string;
};

type SectorConfig = {
  label: string;
  image?: string;
};

const sectorItems: SectorConfig[] = [
  { label: "⬆" },
  { label: "+100" },
  { label: "Задание" },
  { label: "+100" },
  { label: "+200" },
  { label: "+200" },
  { label: "+300" },
  { label: "+300" },
  { label: "Задание" },
  { label: "+400" },
  { label: "+400" },
  { label: "Задание" },
  { label: "+500" },
  { label: "+500" },
  {
    label: "+1000",
    image: "https://cdn-icons-png.flaticon.com/512/138/138281.png",
  },
  {
    label: "Смерть в нищете",
    image: "../public/poordeath.jpg",
  },
  {
    label: "Друг 📞",
    image: "../public/poordeath.jpg",
  },
  {
    label: "X2",
    image: "../public/poordeath.jpg",
  },
  {
    label: "ПРИЗ",
    image: "../public/poordeath.jpg",
  },
  {
    label: "Задание",
    image: "../public/poordeath.jpg",
  },
];

const buildSectors = (items: SectorConfig[]): Sector[] => {
  const palette = ["#ffffff", "#2563eb"];
  return items.map((item, index) => ({
    label: item.label,
    color: palette[index % palette.length],
    image: item.image,
  }));
};

const sectors: Sector[] = buildSectors(sectorItems);

const SPIN_DURATION_MS = 4200;

const degreesToIndex = (degrees: number, count: number) => {
  const sectorAngle = 360 / count;
  const normalizedDegrees = ((degrees % 360) + 360) % 360;
  const index = Math.floor(normalizedDegrees / sectorAngle);
  return Math.min(index, count - 1);
};

const showSectorToast = (sector: Sector) => {
  showToast.message(
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      {sector.image ? (
        <img
          src={sector.image}
          alt={sector.label}
          style={{
            width: "34px",
            height: "34px",
            objectFit: "contain",
            borderRadius: "8px",
          }}
        />
      ) : null}
      <div>
        <div style={{ fontSize: "12px", opacity: 0.9 }}>Результат барабана</div>
        <div style={{ fontWeight: 700 }}>{sector.label}</div>
      </div>
    </div>,
  );
};

const WheelSection = () => {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);

  const handleSpin = () => {
    if (isSpinning) {
      return;
    }

    const extraRounds = 6 + Math.floor(Math.random() * 3);
    const randomOffset = Math.floor(Math.random() * 360);
    const nextRotation = rotation + extraRounds * 360 + randomOffset;
    const resultIndex = degreesToIndex(nextRotation, sectors.length);

    setIsSpinning(true);
    setWinnerIndex(null);
    setRotation(nextRotation);

    window.setTimeout(() => {
      setWinnerIndex(resultIndex);
      showSectorToast(sectors[resultIndex]);
      setIsSpinning(false);
    }, SPIN_DURATION_MS);
  };

  const { setNewActiveTeam } = useContext(GameContext);

  return (
    <section
      style={{
        width: "100%",
        maxWidth: "620px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <button
        onClick={() => {
          handleSpin();
          setNewActiveTeam?.();
        }}
        disabled={isSpinning}
        style={{
          width: "100%",
          color: "white",
          background: "#2563eb",
          padding: "12px",
          fontSize: "16px",
        }}
      >
        {isSpinning ? "Крутится..." : "Крутить барабан"}
      </button>
      <p style={{ margin: 0, fontWeight: 700, textAlign: "center" }}>
        {winnerIndex !== null
          ? `Выпало: ${sectors[winnerIndex].label}`
          : "\u00A0"}
      </p>
      <div
        style={{
          width: "450px",
          height: "450px",
          position: "relative",
          marginTop: "8px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-15px",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "23px solid transparent",
            borderRight: "23px solid transparent",
            borderTop: "38px solid #1f2937",
            zIndex: 10,
          }}
        />

        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "999px",
            position: "relative",
          }}
        >
          {sectors.map((sector, index) => {
            const angle = (index * 360) / sectors.length;
            const nextAngle = ((index + 1) * 360) / sectors.length;

            return (
              <div
                key={`${sector.label}-${index}`}
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  position: "absolute",
                  top: "0",
                  left: "0",
                  background: `conic-gradient(transparent ${(index / sectors.length) * 100}%, ${sector.color} ${(index / sectors.length) * 100}%, ${sector.color} ${((index + 1) / sectors.length) * 100}%, transparent ${((index + 1) / sectors.length) * 100}%)`,
                  rotate: `-${rotation}deg`,
                  transition: isSpinning
                    ? `rotate ${SPIN_DURATION_MS}ms cubic-bezier(0.18, 0.88, 0.18, 1)`
                    : "none",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    top: "0%",
                    left: "0%",
                    width: "100%",
                    height: "100%",
                    transform: `rotate(${(angle + nextAngle) / 2 + 45}deg)`,
                    pointerEvents: "none",
                  }}
                >
                  <p
                    style={{
                      position: "absolute",
                      left: `${60}px`,
                      top: `${66}px`,
                      transform: `rotate(45deg)`,
                      color: "black",
                      width: "90px",
                      display: "flex",
                      alignItems: "center",
                      height: "75px",
                      fontWeight: "bold",
                      fontSize: "16px",
                      margin: 0,
                      zIndex: 50,
                    }}
                  >
                    {sector.label}
                  </p>
                </div>
              </div>
            );
          })}

          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "84px",
              height: "84px",
              borderRadius: "999px",
              background: "#2563eb",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "100.5%",
              height: "100.5%",
              borderRadius: "999px",
              zIndex: -10,
              background: "#2563eb",
            }}
          />
        </div>
      </div>
    </section>
  );
};

export default WheelSection;
