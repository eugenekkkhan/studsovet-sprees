import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AnswerBox from "./AnswerBox";
import { answerBoxRadius } from "./answerBoxRadius";
import { Card } from "../../atoms";
import { cardRadius } from "../../../styles/tokens";

/**
 * Коробка ответа — единственное, что стоит в углах карточки, когда ответ
 * открыт. Значит, радиус карточки должен строиться от неё, а не от кнопок,
 * которых в этот момент на экране уже нет.
 */

const styleOf = (element: HTMLElement) => element.getAttribute("style") ?? "";

describe("углы коробки ответа", () => {
  it("коробка рисует радиус из своего отступа и угла картинки внутри", () => {
    const { container } = render(<AnswerBox answer="ответ" size="md" />);

    expect(styleOf(container.firstElementChild as HTMLElement)).toContain(
      `border-radius: ${answerBoxRadius("md")}`,
    );
  });

  it("карточка вокруг строится от коробки и требует от угла ровно её радиус", () => {
    render(
      <Card padding="md" content={answerBoxRadius("md")} data-testid="panel">
        <AnswerBox answer="ответ" size="md" />
      </Card>,
    );

    const style = styleOf(screen.getByTestId("panel"));
    expect(style).toContain(
      `border-radius: ${cardRadius("md", answerBoxRadius("md"))}`,
    );
    expect(style).toContain(`--card-inner-radius: ${answerBoxRadius("md")}`);
  });

  it("маленькая коробка сидит в карточке с меньшим отступом", () => {
    // sm и md различаются только отступом, поэтому радиусы не совпадают —
    // иначе одна из двух коробок выпала бы из концентрики.
    expect(answerBoxRadius("sm")).not.toBe(answerBoxRadius("md"));
  });
});
