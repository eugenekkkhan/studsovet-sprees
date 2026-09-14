import { describe, expect, it } from "vitest";
import { escapeCsv } from "./csv";

describe("экранирование ячейки CSV", () => {
  it("обезвреживает значения, которые Excel принял бы за формулу", () => {
    expect(escapeCsv("=SUM(A1:A9)")).toBe("\"'=SUM(A1:A9)\"");
    expect(escapeCsv("+79991234567")).toBe("\"'+79991234567\"");
    expect(escapeCsv("-5")).toBe("\"'-5\"");
    expect(escapeCsv("@user")).toBe("\"'@user\"");
  });

  it("не трогает обычный текст и числа", () => {
    expect(escapeCsv("Аня")).toBe('"Аня"');
    expect(escapeCsv(42)).toBe('"42"');
  });

  it("удваивает кавычки внутри значения", () => {
    expect(escapeCsv('он сказал "да"')).toBe('"он сказал ""да"""');
  });

  it("пустое и отсутствующее даёт пустой ячейкой", () => {
    expect(escapeCsv(null)).toBe('""');
    expect(escapeCsv(undefined)).toBe('""');
  });
});
