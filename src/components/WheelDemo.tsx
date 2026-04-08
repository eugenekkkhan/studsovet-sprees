import { useEffect, useRef, useState } from "react";
import "./WheelDemo.css";
type Entity = {
  title: string;
  color: string;
};

const WheelDemo = () => {
  const [spinning, setSpinning] = useState<boolean>(false);
  const [entities, setEntities] = useState<Entity[]>(() => {
    const savedEntities = localStorage.getItem("wheelEntities");
    return savedEntities ? JSON.parse(savedEntities) : [];
  });
  const [preferredEntityIndex, setPreferredEntityIndex] = useState<
    number | null
  >(null);
  const [winResult, setWinResult] = useState<Entity | null>(null);
  const [inputEntity, setInputEntity] = useState<string>("");
  function randomColor(): string {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 70; // vivid but not neon
    const lightness = 55; // readable on light/dark segments
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
  const [rotation, setRotation] = useState<number>(0);
  const targetRotation = useRef<number>(0);

  // Сохранение сущностей в localStorage при их изменении
  useEffect(() => {
    localStorage.setItem("wheelEntities", JSON.stringify(entities));
  }, [entities]);

  const clearAllEntities = () => {
    setEntities([]);
    setWinResult(null);
    setPreferredEntityIndex(null);
    localStorage.removeItem("wheelEntities");
  };

  const degreesToIndex = (degrees: number) => {
    const sliceAngle = 360 / entities.length;
    // Normalize to 0-360 range
    const normalizedDegrees = ((degrees % 360) + 360) % 360;
    // Calculate index
    const index = Math.floor(normalizedDegrees / sliceAngle);
    // Clamp to valid range
    return Math.min(index, entities.length - 1);
  };

  const targetRotationBasedOnPreferred = (indexOfPreferred: number) => {
    if (indexOfPreferred !== null && indexOfPreferred < entities.length) {
      const sliceAngle = 360 / entities.length;

      const offset =
        sliceAngle * (indexOfPreferred + 1) -
        Math.floor((Math.random() * sliceAngle) / 2); // Center the preferred slice
      return offset;
    }
    return 0;
  };

  useEffect(() => {
    if (spinning) {
      const interval = setInterval(() => {
        setRotation((prev) => {
          if (targetRotation.current <= Math.round(prev)) {
            setSpinning(false);
            clearInterval(interval);
            const winningEntity = entities.find(
              (_, index) => degreesToIndex(targetRotation.current) === index,
            );
            setWinResult(winningEntity || null);
            return prev;
          } else {
            return prev + (targetRotation.current - prev) / 400;
          }
        });
      }, 1);
      return () => clearInterval(interval);
    }
  }, [spinning]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
        width: "720px",
      }}
    >
      <h1>Колесо Удачи</h1>
      <div style={{ display: "flex", gap: "12px", width: "100%" }}>
        <input
          style={{ width: "70%" }}
          value={inputEntity}
          onChange={(e) => setInputEntity(e.target.value)}
        />
        <button
          style={{ width: "30%" }}
          onClick={() => {
            setEntities([
              ...entities,
              { title: inputEntity, color: randomColor() },
            ]);
            setInputEntity("");
          }}
          disabled={!inputEntity}
        >
          Добавить
        </button>
      </div>
      {/* wheel */}
      {entities.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              gap: "12px",
            }}
          >
            {spinning ? (
              <>
                <button
                  onClick={() => {
                    setSpinning(false);
                    setRotation(0);
                    targetRotation.current = 0;
                  }}
                >
                  Сброс
                </button>
                <p>Крутится...</p>
              </>
            ) : (
              <>
                <button
                  style={{
                    width: "100%",
                    backgroundColor: "#3aaf44",
                    color: "white",
                  }}
                  onClick={() => {
                    setSpinning(true);
                    setRotation(0);
                    targetRotation.current =
                      360 * 5 +
                      (preferredEntityIndex !== null
                        ? targetRotationBasedOnPreferred(preferredEntityIndex)
                        : Math.floor(Math.random() * 360));
                  }}
                  disabled={entities.length === 0}
                >
                  Крутить колесо
                </button>
              </>
            )}
          </div>
          {winResult && (
            <div
              style={{
                width: "300px",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <p>Победитель:&nbsp;</p>
              <p style={{ color: winResult.color, fontWeight: "bold" }}>
                {winResult.title}
              </p>
            </div>
          )}
          <div
            style={{
              width: "300px",
              height: "300px",
              position: "relative",
              marginTop: "8px",
            }}
          >
            <span
              id="arrow-for-wheel"
              style={{
                position: "absolute",
                top: "-10px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "0",
                height: "0",
                borderLeft: "15px solid transparent",
                borderRight: "15px solid transparent",
                borderTop: "25px solid #333",
                zIndex: 10,
              }}
            ></span>
            {entities.map((entity, index) => {
              const angle = (index * 360) / entities.length;
              const nextAngle = ((index + 1) * 360) / entities.length;
              return (
                <div
                  key={index}
                  id="wheel-part"
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    position: "absolute",
                    top: "0",
                    left: "0",
                    background: `conic-gradient(transparent ${
                      (index / entities.length) * 100
                    }%, ${entity.color} ${(index / entities.length) * 100}%, ${
                      entity.color
                    } ${((index + 1) / entities.length) * 100}%, transparent ${
                      ((index + 1) / entities.length) * 100
                    }%)`,
                    rotate: `-${rotation}deg`,
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
                        left: `${40}px`,
                        top: `${40}px`,
                        transform: `rotate(45deg)`,

                        color: "black",
                        // background: `aqua`,
                        width: "50px",
                        display: "flex",
                        alignItems: "center",
                        height: "50px",
                        fontWeight: "bold",
                        fontSize: "12px",
                        margin: 0,
                        // textAlign: "center",
                        zIndex: 50,
                      }}
                    >
                      {entity.title}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Entity list with removable items */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              width: "100%",
              alignItems: "flex-start",
            }}
          >
            <h2>Список:</h2>
            <div
              style={{
                display: "flex",
                gap: "12px",
                width: "100%",
                marginBottom: "12px",
              }}
            >
              <button
                onClick={clearAllEntities}
                style={{
                  backgroundColor: "#f44336",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
                disabled={entities.length === 0}
              >
                Очистить всё
              </button>
            </div>
            {entities.map((entity, index) => (
              <div
                key={index}
                onClick={() => {
                  setPreferredEntityIndex(index);
                }}
                style={{
                  color: entity.color,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <p>{entity.title}</p>
                <button
                  onClick={() => {
                    setEntities(entities.filter((_, i) => i !== index));
                  }}
                  style={{ color: "red" }}
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      <div
        style={{
          display: "flex",
          gap: "8px",
          opacity:
            (rotation / targetRotation.current) *
            (rotation / targetRotation.current) *
            (rotation / targetRotation.current),
        }}
      ></div>
    </div>
  );
};

export default WheelDemo;
