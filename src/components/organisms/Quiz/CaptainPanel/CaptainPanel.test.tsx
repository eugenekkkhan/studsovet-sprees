import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CaptainPanel from "./CaptainPanel";
import type { PublicActiveQuestion, PublicGameState } from "../../../../types/quiz";

/**
 * Страница капитана и без того печатает статус игры с сервера. Всё, что панель
 * говорит вдобавок, должно касаться самого капитана — иначе одна и та же фраза
 * стоит на экране дважды, и капитан ищет между ними разницу.
 */

const OURS = "team-ours";
const THEIRS = "team-theirs";

const activeQuestion = (
  overrides: Partial<PublicActiveQuestion> = {},
): PublicActiveQuestion =>
  ({
    questionId: "q-1",
    themeName: "Фразы Меллстроя",
    price: 2100,
    type: "simple",
    text: "Фраза меллстроя",
    buzzOpen: false,
    buzzedTeamId: null,
    soloTeamId: null,
    openerTeamId: THEIRS,
    lockedTeamIds: [],
    falseStartUntil: {},
    answerRevealed: false,
    ...overrides,
  }) as PublicActiveQuestion;

const gameWith = (active: PublicActiveQuestion): PublicGameState =>
  ({
    phase: "answer",
    teams: [
      { id: OURS, name: "хуй", color: "#2563eb", score: 3000 },
      { id: THEIRS, name: "бим бим", color: "#22c55e", score: 5500 },
    ],
    activeQuestion: active,
    pickerTeamId: THEIRS,
    statusMessage: "Отвечает «бим бим».",
    statusTone: "info",
    serverNow: Date.now(),
  }) as unknown as PublicGameState;

const renderPanel = (active: PublicActiveQuestion) =>
  render(
    <CaptainPanel
      game={gameWith(active)}
      teamId={OURS}
      pending={false}
      onCommand={vi.fn()}
    />,
  );

describe("панель капитана во время ответа соперника", () => {
  it("молчит, когда кнопку нажала другая команда", () => {
    const { container } = renderPanel(activeQuestion({ buzzedTeamId: THEIRS }));

    // Ни слова про «бим бим»: это уже сказано статусом страницы.
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/Отвечает/)).not.toBeInTheDocument();
  });

  it("подтверждает нажатие тому, кто нажал", () => {
    renderPanel(activeQuestion({ buzzedTeamId: OURS }));

    expect(screen.getByText("Вы нажали первым — отвечайте!")).toBeInTheDocument();
  });

  it("на вопросе в одиночку объясняет, почему кнопка молчит", () => {
    // Здесь текст не дублирует статус: он про саму кнопку, а не про то, чей ход.
    renderPanel(activeQuestion({ soloTeamId: THEIRS }));

    expect(
      screen.getByText("Вопрос играет другая команда — кнопка не работает."),
    ).toBeInTheDocument();
  });
});
