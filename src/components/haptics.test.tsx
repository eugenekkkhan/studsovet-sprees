import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Button, IconButton, LetterTile } from "./atoms";
import { BuzzButton } from "./molecules";

/**
 * Отклик прошит в базовые компоненты, а не в экраны: только так на одну
 * кнопку приходит ровно одна вибрация, а на соседнюю — не ноль.
 */

const HapticFeedback = {
  impactOccurred: vi.fn(),
  notificationOccurred: vi.fn(),
  selectionChanged: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as { Telegram?: unknown }).Telegram = {
    WebApp: { initData: "auth_date=1&hash=abc", HapticFeedback },
  };
});

afterEach(() => {
  delete (window as { Telegram?: unknown }).Telegram;
});

const click = (name: string) => userEvent.click(screen.getByRole("button", { name }));

describe("тактильный отклик базовых компонентов", () => {
  it("обычная кнопка отзывается лёгким нажатием и не теряет обработчик", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Сохранить</Button>);

    await click("Сохранить");
    expect(HapticFeedback.selectionChanged).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("успех и отказ различаются на ощупь", async () => {
    render(
      <>
        <Button variant="success">Принять</Button>
        <Button variant="danger">Снять очки</Button>
      </>,
    );

    await click("Принять");
    expect(HapticFeedback.notificationOccurred).toHaveBeenLastCalledWith("success");
    await click("Снять очки");
    expect(HapticFeedback.notificationOccurred).toHaveBeenLastCalledWith("error");
    expect(HapticFeedback.selectionChanged).not.toHaveBeenCalled();
  });

  it("иконка в danger-тоне отзывается ошибкой, обычная — нажатием", async () => {
    render(
      <>
        <IconButton label="Удалить" tone="danger">
          ×
        </IconButton>
        <IconButton label="Вверх">↑</IconButton>
      </>,
    );

    await click("Удалить");
    expect(HapticFeedback.notificationOccurred).toHaveBeenCalledWith("error");
    await click("Вверх");
    expect(HapticFeedback.selectionChanged).toHaveBeenCalledTimes(1);
  });

  it("позволяет игровому действию запросить тяжёлый отклик", async () => {
    render(<Button hapticFeedback="press">Крутить барабан</Button>);

    await click("Крутить барабан");
    expect(HapticFeedback.impactOccurred).toHaveBeenCalledWith("heavy");
    expect(HapticFeedback.selectionChanged).not.toHaveBeenCalled();
  });

  it("ход в игре бьёт сильнее выбора позиции", async () => {
    render(
      <>
        <BuzzButton label="Ответить" enabled onClick={vi.fn()} />
        <LetterTile letter="А" revealed shape="choice" aria-label="Назвать А" />
        <LetterTile letter="" revealed={false} aria-label="Открыть позицию 1" />
      </>,
    );

    await click("Ответить");
    await click("Назвать А");
    expect(HapticFeedback.impactOccurred).toHaveBeenCalledTimes(2);
    expect(HapticFeedback.impactOccurred).toHaveBeenCalledWith("heavy");

    await click("Открыть позицию 1");
    expect(HapticFeedback.selectionChanged).toHaveBeenCalledTimes(1);
  });

  it("заблокированная кнопка молчит", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Крутить
      </Button>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Крутить" }));
    expect(HapticFeedback.selectionChanged).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("вне Telegram нажатие проходит без моста", async () => {
    delete (window as { Telegram?: unknown }).Telegram;
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Дальше</Button>);

    await click("Дальше");
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
