const PLAYABLE_LETTER = /^[А-ЯЁ]$/u;

export const RUSSIAN_LETTERS = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";

export const normalizePuzzleText = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleUpperCase("ru-RU");

export const normalizeLetter = (value: string) =>
  value.trim().slice(0, 1).toLocaleUpperCase("ru-RU");

export const isPlayableLetter = (value: string) => PLAYABLE_LETTER.test(value);

export const countLetter = (answer: string, letter: string) =>
  Array.from(answer).filter((character) => character === letter).length;

export const isPuzzleComplete = (answer: string, guessedLetters: string[]) => {
  const guessed = new Set(guessedLetters);
  return Array.from(answer).every(
    (character) => !isPlayableLetter(character) || guessed.has(character),
  );
};
