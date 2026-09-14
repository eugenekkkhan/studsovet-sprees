import { describe, expect, it } from "vitest";
import { ratingPlaces } from "./rating";

const participant = (userId: number, name: string, rating?: number) => ({ userId, name, rating });

describe("места в рейтинге", () => {
  it("даёт равным результатам равное место, а следующему — сдвиг на размер группы", () => {
    const places = ratingPlaces([
      participant(1, "Аня", 100),
      participant(2, "Борис", 90),
      participant(3, "Вера", 90),
      participant(4, "Глеб", 80),
    ]);

    expect([...places.values()]).not.toContain(3);
    expect(places.get(1)).toBe(1);
    expect(places.get(2)).toBe(2);
    expect(places.get(3)).toBe(2);
    expect(places.get(4)).toBe(4);
  });

  it("не зависит от порядка, в котором пришли профили", () => {
    const people = [
      participant(1, "Аня", 100),
      participant(2, "Борис", 90),
      participant(3, "Вера", 90),
    ];

    expect(ratingPlaces(people)).toEqual(ratingPlaces([...people].reverse()));
  });

  it("считает отсутствующий рейтинг нулём и ставит его вровень с явным нулём", () => {
    const places = ratingPlaces([
      participant(1, "Аня", 10),
      participant(2, "Борис", 0),
      participant(3, "Вера"),
    ]);

    expect(places.get(2)).toBe(2);
    expect(places.get(3)).toBe(2);
  });

  it("ставит всех на первое место, когда рейтинг у всех одинаковый", () => {
    const places = ratingPlaces([
      participant(1, "Аня", 50),
      participant(2, "Борис", 50),
      participant(3, "Вера", 50),
    ]);

    expect([...places.values()]).toEqual([1, 1, 1]);
  });

  it("не трогает переданный массив и переживает пустой список", () => {
    const people = [participant(2, "Борис", 10), participant(1, "Аня", 20)];
    ratingPlaces(people);

    expect(people.map((person) => person.userId)).toEqual([2, 1]);
    expect(ratingPlaces([]).size).toBe(0);
  });
});
