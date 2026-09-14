import type { ReactNode } from "react";

/** Одна сетка команд на все игры: карточки одного размера в три колонки. */
const TeamsGrid = ({ children }: { children: ReactNode }) => (
  <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">{children}</div>
);

export default TeamsGrid;
