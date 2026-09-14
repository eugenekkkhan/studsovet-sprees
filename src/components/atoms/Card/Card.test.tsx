import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Card from "./Card";
import Inset from "../Inset/Inset";
import Button from "../Button/Button";
import { cardRadius, inset } from "../../../styles/tokens";

/**
 * jsdom keeps `calc()` and `var()` as written and resolves neither, so these
 * pin the arithmetic rather than the pixels: the point is that the radius a
 * card draws and the corner it hands its children always differ by exactly its
 * padding. The pixel values live in tokens.css.
 */

const styleOf = (element: HTMLElement) => element.getAttribute("style") ?? "";

describe("the concentric-corner rule", () => {
  it("builds a card's radius from its padding and what sits in its corners", () => {
    render(
      <Card padding="lg" data-testid="card">
        <span>содержимое</span>
      </Card>,
    );

    expect(styleOf(screen.getByTestId("card"))).toContain(
      `border-radius: ${cardRadius("lg", "md")}`,
    );
  });

  it("hands children the corner it was built from, whatever the padding", () => {
    render(
      <>
        <Card padding="xs" content="sm" data-testid="tight" />
        <Card padding="lg" content="lg" data-testid="roomy" />
      </>,
    );

    // radius - padding === the content radius, by construction.
    expect(styleOf(screen.getByTestId("tight"))).toContain(
      "--card-inner-radius: var(--radius-control-sm)",
    );
    expect(styleOf(screen.getByTestId("roomy"))).toContain(
      "--card-inner-radius: var(--radius-control-lg)",
    );
  });

  it("subtracts the padding when a radius is imposed rather than derived", () => {
    render(<Card padding="md" radius="40px" data-testid="shell" />);

    const style = styleOf(screen.getByTestId("shell"));
    expect(style).toContain("border-radius: 40px");
    expect(style).toContain(
      `--card-inner-radius: max(0px, calc(40px - ${inset("md")}))`,
    );
  });

  it("takes the tightest side when the padding is uneven", () => {
    // A single radius cannot be concentric on both axes, so the smaller gap
    // wins and the child never bulges past the parent's arc.
    expect(inset(["sm", "lg"])).toBe(
      "min(var(--spacing-sm), var(--spacing-lg))",
    );
  });

  it("nests: an inner card's radius is what the outer one asked for", () => {
    const rowRadius = cardRadius("sm", "sm");

    render(
      <Card padding="lg" content={rowRadius} data-testid="panel">
        <Card padding="sm" content="sm" data-testid="row" />
      </Card>,
    );

    expect(styleOf(screen.getByTestId("panel"))).toContain(
      `border-radius: ${cardRadius("lg", rowRadius)}`,
    );
    // The row draws exactly the corner the panel demands of it.
    expect(styleOf(screen.getByTestId("row"))).toContain(
      `border-radius: ${rowRadius}`,
    );
  });

  it("wraps a control instead of inflating it when the corner is bigger", () => {
    render(
      <Card padding="lg" content="lg" data-testid="card">
        <Inset content="sm" data-testid="inset">
          <Button size="sm">Обновить</Button>
        </Inset>
      </Card>,
    );

    const style = styleOf(screen.getByTestId("inset"));
    // The wrapper makes up the difference in padding, so the pill keeps its size…
    expect(style).toContain(
      "padding: max(0px, calc(var(--radius-control-lg) - var(--radius-control-sm)))",
    );
    // …and paints nothing itself: a radius here would bend a caller's border.
    expect(style).not.toContain("border-radius");
    // The button is untouched: still a pill.
    expect(screen.getByRole("button").className).toContain("rounded-pill");
  });

  it("tops up padding a section already has rather than stacking onto it", () => {
    render(
      <Card padding="none" radius="40px" data-testid="shell">
        <Inset padding="lg" content="md" data-testid="header" />
      </Card>,
    );

    expect(styleOf(screen.getByTestId("header"))).toContain(
      "padding: max(var(--spacing-lg), calc(max(0px, calc(40px - 0px)) - var(--radius-control-md)))",
    );
  });
});
