import { describe, expect, it } from "vitest";
import { applyOrder, reorderBy, reorderKeys } from "./reorder";

describe("перестановка перетаскиванием", () => {
  const keys = ["a", "b", "c", "d"];

  it("переносит элемент на место другого, а не меняет их местами", () => {
    // Обмен дал бы ["c", "b", "a", "d"]: при перетаскивании через список это
    // выбрасывало бы соседа в противоположный конец.
    expect(reorderKeys(keys, "a", "c")).toEqual(["b", "c", "a", "d"]);
    expect(reorderKeys(keys, "d", "a")).toEqual(["d", "a", "b", "c"]);
  });

  it("возвращает тот же массив, когда двигать нечего", () => {
    expect(reorderKeys(keys, "a", "a")).toBe(keys);
    expect(reorderKeys(keys, "a", "нет такого")).toBe(keys);
    expect(reorderKeys(keys, "нет такого", "a")).toBe(keys);
  });

  it("работает с любым ключом, не только с id", () => {
    const criteria = [{ key: "name" }, { key: "score" }, { key: "course" }];

    const moved = reorderBy(criteria, (item) => item.key, "course", "name");

    expect(moved.map((item) => item.key)).toEqual(["course", "name", "score"]);
  });
});

describe("сохранённый порядок поверх текущего списка", () => {
  it("ставит нетронутые ключи в конец в их исходном порядке", () => {
    expect(applyOrder(["a", "b", "c"], ["c"])).toEqual(["c", "a", "b"]);
  });

  it("отсеивает ключи, которых больше нет: набор колонок мог измениться", () => {
    expect(applyOrder(["a", "b"], ["b", "выпилен", "a"])).toEqual(["b", "a"]);
  });

  it("не задваивает ключ, записанный в порядке дважды", () => {
    expect(applyOrder(["a", "b"], ["b", "b"])).toEqual(["b", "a"]);
  });

  it("без сохранённого порядка оставляет список как есть", () => {
    expect(applyOrder(["a", "b", "c"], [])).toEqual(["a", "b", "c"]);
  });
});
