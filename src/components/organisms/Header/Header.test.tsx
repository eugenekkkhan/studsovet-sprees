import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { AuthContextType, AuthStatus } from "../../../context/AuthContext";

const auth = vi.hoisted(() => ({ status: "authorized" as AuthStatus }));
const fetchAdminConfig = vi.hoisted(() => vi.fn(() => Promise.resolve({
  features: {
    events: true,
    rating: false,
    participants: false,
    roulette: false,
    fieldOfMiracles: false,
    quiz: false,
  },
  isAdmin: false,
})));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ ...auth, signOut: vi.fn() }) as unknown as AuthContextType,
}));

vi.mock("../../../api/adminApi", () => ({ fetchAdminConfig }));

const { default: Header } = await import("./Header");

const renderAt = (path: string, status: AuthStatus) => {
  auth.status = status;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Header />
    </MemoryRouter>,
  );
};

describe("шапка", () => {
  it("не показывается, пока вход не состоялся", () => {
    // Каждая ссылка ведёт на защищённый экран, то есть обратно на форму входа.
    for (const status of ["loading", "anonymous", "denied", "offline"] as const) {
      const { container, unmount } = renderAt("/", status);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("показывает только включённые вкладки после загрузки конфига", async () => {
    renderAt("/", "authorized");

    expect(screen.queryByRole("link", { name: "Мероприятия" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Выйти" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Мероприятия" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Рейтинг" })).not.toBeInTheDocument();
  });

  it("не лезет на экраны игроков и проектора", () => {
    for (const path of [
      "/quiz/play",
      "/quiz/board",
      "/quiz/host",
      "/field-of-miracles/play",
      "/field-of-miracles/board",
      "/field-of-miracles/host",
    ]) {
      const { container, unmount } = renderAt(path, "authorized");
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });
});
