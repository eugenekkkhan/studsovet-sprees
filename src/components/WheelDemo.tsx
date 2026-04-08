import { useEffect, useRef, useState } from "react";
import "./WheelDemo.css";
import audio from "../assets/v-krayu.mp3";
type Movie = {
  title: string;
  color: string;
};

const WheelDemo = () => {
  const [spinning, setSpinning] = useState<boolean>(false);
  const [movies, setMovies] = useState<Movie[]>(() => {
    const savedMovies = localStorage.getItem("wheelMovies");
    return savedMovies ? JSON.parse(savedMovies) : [];
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [preferredMovieIndex, setPreferredMovieIndex] = useState<number | null>(
    null
  );
  const [winResult, setWinResult] = useState<Movie | null>(null);
  const [inputMovie, setInputMovie] = useState<string>("");
  function randomColor(): string {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 70; // vivid but not neon
    const lightness = 55; // readable on light/dark segments
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
  const [rotation, setRotation] = useState<number>(0);
  const targetRotation = useRef<number>(0);

  // Сохранение фильмов в localStorage при их изменении
  useEffect(() => {
    localStorage.setItem("wheelMovies", JSON.stringify(movies));
  }, [movies]);

  const startAudio = () => {
    audioRef?.current?.play();
  };

  const stopAudio = () => {
    audioRef?.current?.pause();
    audioRef?.current?.currentTime && (audioRef.current.currentTime = 0); // reset to beginning
  };

  const clearAllMovies = () => {
    setMovies([]);
    setWinResult(null);
    setPreferredMovieIndex(null);
    localStorage.removeItem("wheelMovies");
  };

  const degreesToIndex = (degrees: number) => {
    const sliceAngle = 360 / movies.length;
    // Normalize to 0-360 range
    const normalizedDegrees = ((degrees % 360) + 360) % 360;
    // Calculate index
    const index = Math.floor(normalizedDegrees / sliceAngle);
    // Clamp to valid range
    return Math.min(index, movies.length - 1);
  };

  const targetRotationBasedOnPreferred = (indexOfPreferred: number) => {
    if (indexOfPreferred !== null && indexOfPreferred < movies.length) {
      const sliceAngle = 360 / movies.length;

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
            const winningMovie = movies.find(
              (_, index) => degreesToIndex(targetRotation.current) === index
            );
            setWinResult(winningMovie || null);
            startAudio();
            return prev;
          } else {
            return prev + (targetRotation.current - prev) / 400;
          }
        });
        console.log(targetRotation.current);
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
          value={inputMovie}
          onChange={(e) => setInputMovie(e.target.value)}
        />
        <button
          style={{ width: "30%" }}
          onClick={() => {
            setMovies([...movies, { title: inputMovie, color: randomColor() }]);
            setInputMovie("");
          }}
          disabled={!inputMovie}
        >
          Добавить фильм
        </button>
      </div>
      {/* wheel */}
      {movies.length > 0 && (
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
                      (preferredMovieIndex !== null
                        ? targetRotationBasedOnPreferred(preferredMovieIndex)
                        : Math.floor(Math.random() * 360));
                  }}
                  disabled={movies.length === 0}
                >
                  Крутить колесо
                </button>
                {audioRef.current && !audioRef?.current?.paused && (
                  <button
                    style={{
                      width: "100%",
                      backgroundColor: "#f44336",
                      color: "white",
                    }}
                    onClick={() => {
                      stopAudio();
                    }}
                  >
                    Стоп мне неприятно
                  </button>
                )}
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
            {movies.map((movie, index) => {
              const angle = (index * 360) / movies.length;
              const nextAngle = ((index + 1) * 360) / movies.length;
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
                      (index / movies.length) * 100
                    }%, ${movie.color} ${(index / movies.length) * 100}%, ${
                      movie.color
                    } ${((index + 1) / movies.length) * 100}%, transparent ${
                      ((index + 1) / movies.length) * 100
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
                      {movie.title}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Movie list with removable items */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              width: "100%",
              alignItems: "flex-start",
            }}
          >
            <h2>Список фильмов:</h2>
            <div
              style={{
                display: "flex",
                gap: "12px",
                width: "100%",
                marginBottom: "12px",
              }}
            >
              <button
                onClick={clearAllMovies}
                style={{
                  backgroundColor: "#f44336",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
                disabled={movies.length === 0}
              >
                Очистить все фильмы
              </button>
            </div>
            {movies.map((movie, index) => (
              <div
                key={index}
                onClick={() => {
                  setPreferredMovieIndex(index);
                }}
                style={{
                  color: movie.color,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <p>{movie.title}</p>
                <button
                  onClick={() => {
                    setMovies(movies.filter((_, i) => i !== index));
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
      <audio ref={audioRef} src={audio} />
    </div>
  );
};

export default WheelDemo;
