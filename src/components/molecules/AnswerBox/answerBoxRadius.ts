import { cardRadius, radius } from "../../../styles/tokens";

export type AnswerBoxSize = "sm" | "md";

/**
 * Радиус коробки ответа: её собственный отступ плюс угол картинки внутри.
 * Живёт отдельно от компонента, потому что в карточке коробка обычно стоит в
 * углу — и родителю нужен этот радиус, чтобы построить свой по тому же
 * правилу, что и всё остальное в приложении.
 */
export const answerBoxRadius = (size: AnswerBoxSize = "sm") =>
  cardRadius(size === "md" ? "md" : "sm", radius.md);
