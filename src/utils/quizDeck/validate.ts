import type { Deck } from "../../types/quiz";

export interface DeckIssue {
  level: "error" | "warning";
  message: string;
  roundId?: string;
  themeId?: string;
  questionId?: string;
}

export interface DeckStats {
  rounds: number;
  themes: number;
  questions: number;
  specials: number;
  finalThemes: number;
  incomplete: number;
}

const isBlank = (value: string) => value.trim() === "";

export const deckStats = (deck: Deck): DeckStats => {
  const questions = deck.rounds.flatMap((round) =>
    round.themes.flatMap((theme) => theme.questions),
  );
  return {
    rounds: deck.rounds.length,
    themes: deck.rounds.reduce((total, round) => total + round.themes.length, 0),
    questions: questions.length,
    specials: questions.filter((question) => question.type !== "simple").length,
    finalThemes: deck.finalThemes.length,
    incomplete: questions.filter(
      (question) => isBlank(question.text) || isBlank(question.answer),
    ).length,
  };
};

/**
 * Что мешает играть по колоде. Ошибки блокируют загрузку в игру,
 * предупреждения — просто повод вернуться и дописать.
 */
export const deckIssues = (deck: Deck): DeckIssue[] => {
  const issues: DeckIssue[] = [];

  if (isBlank(deck.name)) {
    issues.push({ level: "warning", message: "У колоды нет названия." });
  }
  if (deck.rounds.length === 0) {
    issues.push({ level: "error", message: "В колоде нет ни одного раунда." });
  }

  deck.rounds.forEach((round, roundIndex) => {
    const playable = round.themes.filter((theme) => theme.questions.length > 0);
    if (playable.length === 0) {
      issues.push({
        level: "error",
        roundId: round.id,
        message: `Раунд ${roundIndex + 1}: нет ни одной темы с вопросами.`,
      });
    }

    round.themes.forEach((theme) => {
      if (isBlank(theme.name)) {
        issues.push({
          level: "error",
          roundId: round.id,
          themeId: theme.id,
          message: `Раунд ${roundIndex + 1}: тема без названия.`,
        });
      }

      theme.questions.forEach((question) => {
        const label = `${theme.name || "Без темы"}, ${question.price}`;
        if (isBlank(question.text)) {
          issues.push({
            level: "error",
            roundId: round.id,
            themeId: theme.id,
            questionId: question.id,
            message: `${label}: пустой вопрос.`,
          });
        }
        if (isBlank(question.answer)) {
          issues.push({
            level: "error",
            roundId: round.id,
            themeId: theme.id,
            questionId: question.id,
            message: `${label}: не указан ответ.`,
          });
        }
        if (question.type === "secret" && isBlank(question.secretTheme)) {
          issues.push({
            level: "warning",
            roundId: round.id,
            themeId: theme.id,
            questionId: question.id,
            message: `${label}: у «Кота» не задана своя тема — объявят тему клетки.`,
          });
        }
      });
    });
  });

  deck.finalThemes.forEach((theme, index) => {
    if (isBlank(theme.name) || isBlank(theme.text) || isBlank(theme.answer)) {
      issues.push({
        level: "warning",
        message: `Финальная тема ${index + 1}: заполните название, вопрос и ответ — иначе она не попадёт в игру.`,
      });
    }
  });

  return issues;
};

export const hasBlockingIssues = (deck: Deck) =>
  deckIssues(deck).some((issue) => issue.level === "error");

/** Финальные темы, которые сервер примет в игру. */
export const playableFinalThemes = (deck: Deck) =>
  deck.finalThemes.filter(
    (theme) => !isBlank(theme.name) && !isBlank(theme.text),
  );
