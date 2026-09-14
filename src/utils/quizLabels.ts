import type { GamePhase, QuestionType } from "../types/quiz";

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  simple: "Обычный",
  secret: "Кот в мешке",
  stake: "Аукцион",
  norisk: "Без риска",
};

export const QUESTION_TYPE_HINT: Record<QuestionType, string> = {
  simple: "Кнопка: отвечает тот, кто нажал первым.",
  secret: "Открывший обязан отдать вопрос сопернику; тема и цена свои.",
  stake: "Торги от номинала; играет назначивший высшую цену.",
  norisk: "Играет открывший, за неверный ответ очки не снимаются.",
};

export const PHASE_LABEL: Record<GamePhase, string> = {
  lobby: "Подготовка",
  board: "Выбор вопроса",
  transfer: "Передача «Кота»",
  bidding: "Торги",
  question: "Вопрос",
  answer: "Ответ команды",
  reveal: "Ответ раскрыт",
  "round-over": "Раунд сыгран",
  "final-themes": "Финал: убираем темы",
  "final-bets": "Финал: ставки",
  "final-answers": "Финал: ответы",
  "final-reveal": "Финал: вскрытие",
  "game-over": "Игра окончена",
};

/** Счёт в «Своей игре» бывает отрицательным — знак показываем всегда. */
export const formatScore = (score: number) =>
  score > 0 ? `+${score}` : String(score);
