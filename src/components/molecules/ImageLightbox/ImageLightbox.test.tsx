import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MediaPreview from "../MediaPreview/MediaPreview";

const PICTURE = "https://example.com/question.png";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

const openViewer = async () => {
  await userEvent.click(
    screen.getByRole("button", { name: "Открыть изображение во весь экран" }),
  );
  return screen.getByRole("dialog", { name: "Изображение вопроса" });
};

describe("картинка вопроса во весь экран", () => {
  it("открывается по касанию превью и показывает ту же картинку", async () => {
    render(<MediaPreview url={PICTURE} type="image" zoomable />);

    const dialog = await openViewer();
    const shown = dialog.querySelector("img");
    expect(shown).toHaveAttribute("src", PICTURE);
    // Пока картинка на весь экран, страница под ней не прокручивается.
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("закрывается кнопкой и возвращает странице прокрутку", async () => {
    render(<MediaPreview url={PICTURE} type="image" zoomable />);
    await openViewer();

    await userEvent.click(screen.getByRole("button", { name: "Закрыть изображение" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("закрывается по Escape", async () => {
    render(<MediaPreview url={PICTURE} type="image" zoomable />);
    await openViewer();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("без разрешения на увеличение превью остаётся картинкой, а не кнопкой", () => {
    render(<MediaPreview url={PICTURE} type="image" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("presentation")).toHaveAttribute("src", PICTURE);
  });
});
