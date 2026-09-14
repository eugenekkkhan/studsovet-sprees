import { useContext } from "react";
import QuizGameContext, {
  type QuizGameContextType,
} from "../context/QuizGameContext";

/** Доступ к комнате ведущего. Работает только внутри QuizGameProvider. */
export const useQuizGame = (): QuizGameContextType => {
  const value = useContext(QuizGameContext);
  if (!value) {
    throw new Error("useQuizGame используется вне QuizGameProvider");
  }
  return value;
};
