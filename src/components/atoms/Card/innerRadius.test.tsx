import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Card from "./Card";
import Inset from "../Inset/Inset";
import MediaImage from "../MediaImage/MediaImage";
import { useInnerRadius } from "./innerRadius";
import { cardRadius, contentRadius, controlRadius, space } from "../../../styles/tokens";

/**
 * Радиус углов передаётся вниз по дереву, а не прописывается в каждом месте:
 * карточка публикует его через InnerRadiusContext и `--card-inner-radius`,
 * дети читают. Связь эта невидима глазу — сломается молча, поэтому и тест.
 */

const Probe = () => <span data-testid="probe">{useInnerRadius()}</span>;
const styleOf = (element: HTMLElement) => element.getAttribute("style") ?? "";

describe("передача угла вниз по дереву", () => {
  it("без карточки вокруг хук отдаёт радиус обычного контрола", () => {
    render(<Probe />);

    expect(screen.getByTestId("probe")).toHaveTextContent(controlRadius.md);
  });

  it("карточка отдаёт детям тот угол, из которого построила свой", () => {
    render(<Card padding="lg" content="sm"><Probe /></Card>);

    expect(screen.getByTestId("probe")).toHaveTextContent(contentRadius("sm"));
  });

  it("вложенная карточка перекрывает угол для своих детей, а не наследует чужой", () => {
    render(
      <Card padding="lg" content={cardRadius("sm")}>
        <Card padding="sm" content="sm"><Probe /></Card>
      </Card>,
    );

    expect(screen.getByTestId("probe")).toHaveTextContent(contentRadius("sm"));
  });

  it("Inset публикует меньший угол и добирает разницу отступом", () => {
    render(<Card padding="lg"><Inset content="sm" data-testid="inset"><Probe /></Inset></Card>);

    expect(screen.getByTestId("probe")).toHaveTextContent(contentRadius("sm"));
    expect(styleOf(screen.getByTestId("inset")))
      .toContain(`padding: max(0px, calc(${contentRadius("md")} - ${contentRadius("sm")}))`);
  });

  it("картинка берёт угол у карточки, а не рисует свой", () => {
    render(<Card padding="lg" content="lg"><MediaImage src="/x.png" alt="" /></Card>);

    expect(styleOf(screen.getByRole("presentation", { hidden: true }) as HTMLElement))
      .toContain(`border-radius: ${contentRadius("lg")}`);
  });
});

describe("концентричность вложенных карточек", () => {
  it("радиус внешней — это её отступ плюс радиус внутренней", () => {
    render(
      <Card padding="md" content={cardRadius("sm")} data-testid="outer">
        <Card padding="sm" data-testid="inner" />
      </Card>,
    );

    const inner = cardRadius("sm");
    expect(styleOf(screen.getByTestId("inner"))).toContain(`border-radius: ${inner}`);
    expect(styleOf(screen.getByTestId("outer")))
      .toContain(`border-radius: calc(${space.md} + ${inner})`);
  });
});
