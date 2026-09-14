import { Card, EmptyState, LetterTile, Stack, Text } from "../../../atoms";
import { useGameContext } from "../../../../hooks/useGameContext";
import {
  countLetter,
  isPlayableLetter,
  RUSSIAN_LETTERS,
} from "../../../../utils/fieldOfMiracles";

/** Hidden word plus the Cyrillic alphabet the host reveals letters from. */
const LetterSection = () => {
  const { game, guessLetter, choosePosition } = useGameContext();
  const puzzle = game.puzzle;

  if (!puzzle) {
    return (
      <Card padding="lg">
        <EmptyState paddingY="xl">
          Здесь появится табло после запуска раунда.
        </EmptyState>
      </Card>
    );
  }

  const guessed = new Set(puzzle.guessedLetters);
  const selectingPosition = game.phase === "awaiting-position";
  const selectingLetter = game.phase === "awaiting-letter";

  return (
    <Card padding="lg">
      <Stack gap="lg">
        <Stack direction="row" gap="xs" justify="center" wrap>
          {Array.from(puzzle.answer).map((letter, index) => {
            if (letter === " ") {
              return <span key={`space-${index}`} aria-hidden className="w-md" />;
            }
            if (!isPlayableLetter(letter)) {
              return (
                <span
                  key={`${letter}-${index}`}
                  className="flex size-12 items-center justify-center text-2xl font-bold"
                >
                  {letter}
                </span>
              );
            }
            const revealed = guessed.has(letter);
            return (
              <LetterTile
                key={`${letter}-${index}`}
                letter={letter}
                revealed={revealed}
                size={48}
                disabled={!selectingPosition || revealed}
                aria-label={
                  revealed
                    ? `Открытая буква ${letter}`
                    : selectingPosition
                      ? `Открыть позицию ${index + 1}`
                      : `Закрытая позиция ${index + 1}`
                }
                onClick={() => choosePosition(index)}
              />
            );
          })}
        </Stack>

        <Stack gap="xs">
          <Text as="p" size="sm" tone="muted" align="center">
            {selectingPosition
              ? "Нажмите на закрытую позицию — откроются все такие буквы."
              : selectingLetter
                ? "Выберите ещё не использованную букву."
                : "Использованные буквы приглушены."}
          </Text>
          <Stack direction="row" gap="2xs" justify="center" wrap>
            {Array.from(RUSSIAN_LETTERS).map((letter) => {
              const used = guessed.has(letter);
              const present = countLetter(puzzle.answer, letter) > 0;
              return (
                <LetterTile
                  key={letter}
                  letter={letter}
                  revealed
                  size={36}
                  shape="choice"
                  disabled={!selectingLetter || used}
                  aria-label={
                    used
                      ? `Буква ${letter} уже называлась`
                      : `Назвать букву ${letter}`
                  }
                  className={
                    used
                      ? present
                        ? "border-success bg-success-soft text-success-strong"
                        : "border-border bg-surface-muted text-muted-foreground"
                      : "bg-surface hover:bg-primary-soft"
                  }
                  onClick={() => guessLetter(letter)}
                />
              );
            })}
          </Stack>
        </Stack>
      </Stack>
    </Card>
  );
};

export default LetterSection;
