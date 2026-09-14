import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { cardRadius, space } from "../../styles/tokens";
import type { AdminDashboard } from "../../api/adminApi";

/**
 * Список сессий — единственное место админки, где карточка стоит в углу
 * карточки. Такую пару легко расстроить правкой отступа, и заметно это не
 * будет: угол разъедется на несколько пикселей. Поэтому проверяем само
 * равенство, а не картинку.
 */

const dashboard: AdminDashboard = {
  isAdmin: true,
  features: { events: true, rating: true, participants: true, roulette: true, fieldOfMiracles: true, quiz: true },
  admins: [],
  candidates: [],
  blockedCreatorIds: [],
  sessions: [{
    game: "quiz", code: "ABCD", ownerUserId: 1, ownerName: "Аня", ownerUsername: "anya",
    createdAt: Date.UTC(2026, 0, 1), lastActivityAt: Date.UTC(2026, 0, 2), teamCount: 3,
  }],
};

vi.mock("../../api/adminApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../api/adminApi")>(),
  fetchAdminDashboard: () => Promise.resolve(dashboard),
}));

const AdminPage = (await import("./AdminPage")).default;

const styleOf = (element: Element | null | undefined) => element?.getAttribute("style") ?? "";

describe("углы в админке", () => {
  it("карточка сессий строит радиус от карточки внутри, а не от контрола", async () => {
    const { container } = render(<AdminPage />);
    await screen.findByText(/Своя игра · ABCD/);

    const sessionCard = screen.getByText(/Своя игра · ABCD/).closest(".ui-card");
    const sessionsPanel = sessionCard?.parentElement?.closest(".ui-card");

    const inner = cardRadius("sm");
    expect(styleOf(sessionCard)).toContain(`border-radius: ${inner}`);
    expect(styleOf(sessionsPanel)).toContain(`border-radius: calc(${space.md} + ${inner})`);
    expect(container).toBeTruthy();
  });

  it("карточка вкладок остаётся на контроле: внутри неё карточек нет", async () => {
    render(<AdminPage />);
    const heading = await screen.findByText("Вкладки для пользователей");

    const panel = heading.closest(".ui-card");

    expect(panel?.querySelector(".ui-card")).toBeNull();
    expect(styleOf(panel)).toContain(`border-radius: ${cardRadius("md")}`);
  });
});
