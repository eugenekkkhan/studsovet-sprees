import { describe, expect, it, vi } from "vitest";
import type { Deck, MediaType } from "../../types/quiz";
import { attachDeckMedia, matchMediaFiles, pendingMediaUrls } from "./media";
import { createDeck } from "./factory";

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const deckWithMedia = (): Deck => {
  const deck = createDeck("Тест", { rounds: 1, themes: 1, questions: 4, finalThemes: 1 });
  const [round] = deck.rounds;
  const [theme] = round.themes;
  theme.questions[0].media = { url: "images/cat.png", type: "image" };
  theme.questions[1].media = { url: "https://example.com/pic.png", type: "image" };
  theme.questions[2].media = { url: "/media/files/abc.png", type: "image" };
  theme.questions[3].answerMedia = { url: PIXEL, type: "image" };
  deck.finalThemes[0].media = { url: "final.mp3", type: "audio" };
  return deck;
};

const upload = vi.fn(
  async (file: File): Promise<{ url: string; type: MediaType }> => ({
    url: `/media/files/${file.name}`,
    type: file.type.startsWith("audio") ? "audio" : "image",
  }),
);

describe("медиа при импорте колоды", () => {
  it("ждёт файлы только для локальных имён и base64", () => {
    expect(pendingMediaUrls(deckWithMedia()).sort()).toEqual([
      PIXEL,
      "final.mp3",
      "images/cat.png",
    ]);
  });

  it("сопоставляет ссылки с файлами по имени без учёта регистра", () => {
    const files = [new File(["x"], "CAT.PNG", { type: "image/png" })];
    const { matched, missing } = matchMediaFiles(deckWithMedia(), files);
    expect(matched.sort()).toEqual([PIXEL, "images/cat.png"]);
    expect(missing).toEqual(["final.mp3"]);
  });

  it("подставляет загруженные ссылки и не трогает внешние", async () => {
    const files = [
      new File(["x"], "cat.png", { type: "image/png" }),
      new File(["y"], "final.mp3", { type: "audio/mpeg" }),
    ];
    const result = await attachDeckMedia(deckWithMedia(), files, upload);
    const questions = result.deck.rounds[0].themes[0].questions;

    expect(result.uploaded).toBe(3);
    expect(result.missing).toEqual([]);
    expect(questions[0].media?.url).toBe("/media/files/cat.png");
    // Чужой хостинг и уже загруженный файл остаются как были.
    expect(questions[1].media?.url).toBe("https://example.com/pic.png");
    expect(questions[2].media?.url).toBe("/media/files/abc.png");
    expect(questions[3].answerMedia?.url).toBe("/media/files/deck-media.png");
    expect(result.deck.finalThemes[0].media).toEqual({
      url: "/media/files/final.mp3",
      type: "audio",
    });
  });

  it("оставляет ссылку как есть, если файла не приложили", async () => {
    const result = await attachDeckMedia(deckWithMedia(), [], upload);
    expect(result.missing.sort()).toEqual(["final.mp3", "images/cat.png"]);
    expect(result.deck.rounds[0].themes[0].questions[0].media?.url).toBe(
      "images/cat.png",
    );
  });
});
