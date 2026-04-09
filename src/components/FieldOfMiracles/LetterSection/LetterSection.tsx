import React from "react";

const CIRYLLIC_LETTERS = "абвгдежзийклмнопрстуфхцчшщъыьэюя";

const LetterComponent = ({
  letter,
  isVisible,
  onClick,
}: {
  letter: string;
  isVisible: boolean;
  onClick?: () => void;
}) => {
  return (
    <span
      style={{
        width: "50px",
        height: "50px",
        textAlign: "center",
        background: isVisible ? "none" : "#2563eb",
        border: "2px solid #2563eb",
        borderRadius: "8px",
        fontSize: "32px",
        fontWeight: "bold",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        cursor: "pointer",
      }}
      onClick={onClick}
    >
      {isVisible ? letter.toUpperCase() : ""}
    </span>
  );
};

const LetterSection = () => {
  const [hiddenWord, setHiddenWord] = React.useState<string>("");
  const [isInputVisible, setIsInputVisible] = React.useState(true);
  const [letterVisibility, setLetterVisibility] = React.useState<
    Record<string, boolean>
  >({});
  const handleChange = (value: string) => {
    setHiddenWord(value.toLowerCase());
    setLetterVisibility(
      value
        .toLowerCase()
        .split("")
        .reduce((acc, letter) => ({ ...acc, [letter]: false }), {}),
    );
    // setLetterVisibility((prev) => ({ ...prev, [value.toLowerCase()]: false }));
  };

  const revealLetter = (letter: string) => {
    setLetterVisibility((prev) => ({ ...prev, [letter.toLowerCase()]: true }));
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {isInputVisible && (
          <input
            type="text"
            value={hiddenWord}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Введите загаданное слово"
            style={
              {
                WebkitTextSecurity: "disc",
                width: "100%",
                minWidth: "200px",
              } as React.CSSProperties
            }
          />
        )}
        <button
          onClick={() => setIsInputVisible((prev) => !prev)}
          disabled={!hiddenWord.trim()}
          style={{
            position: !isInputVisible ? "absolute" : "unset",
            left: "16px",
            bottom: "16px",
            transition: "all 0.3s",
            minWidth: "200px",
          }}
        >
          {isInputVisible ? "Скрыть слово" : "Изменить слово"}
        </button>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: "16px",
          gap: "8px",
        }}
      >
        {hiddenWord.split("").map((letter, index) => (
          <LetterComponent
            key={index}
            letter={letter}
            isVisible={letterVisibility[letter.toLowerCase()]}
            onClick={() => revealLetter(letter)}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: "32px",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        {CIRYLLIC_LETTERS.split("").map((letter) => (
          <LetterComponent
            key={letter}
            letter={letter}
            isVisible={!letterVisibility[letter.toLowerCase()]}
            onClick={() => revealLetter(letter)}
          />
        ))}
      </div>
    </div>
  );
};
// "#2563eb"
export default LetterSection;
