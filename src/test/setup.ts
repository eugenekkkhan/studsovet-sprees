import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Каждый тест начинается с пустого документа: иначе разметка предыдущего
// остаётся в DOM и запросы вроде getByRole находят по две кнопки.
afterEach(cleanup);
