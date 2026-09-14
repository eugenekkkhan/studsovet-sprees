import { describe, expect, it } from "vitest";
import { GAP, pageWindow } from "./pagination";

describe("окно страниц", () => {
  it("показывает все страницы, пока они помещаются без разрывов", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  });

  it("всегда держит первую и последнюю, чтобы до края был один щелчок", () => {
    const window = pageWindow(7, 14);

    expect(window[0]).toBe(1);
    expect(window.at(-1)).toBe(14);
  });

  it("ставит разрыв там, где страницы не подряд", () => {
    expect(pageWindow(7, 14)).toEqual([1, GAP, 6, 7, 8, GAP, 14]);
  });

  it("не оставляет разрыв ради одной пропущенной страницы", () => {
    expect(pageWindow(3, 14)).toEqual([1, 2, 3, 4, GAP, 14]);
  });

  it("не ломается на краях и на единственной странице", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 0)).toEqual([1]);
    expect(pageWindow(14, 14)).toEqual([1, GAP, 13, 14]);
  });
});
