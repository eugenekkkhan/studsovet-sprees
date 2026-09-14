import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  msUntil,
  noteServerTime,
  resetServerClock,
  serverOffset,
  toLocalTime,
} from "./serverClock";

const LOCAL_NOW = 1_700_000_000_000;

describe("serverClock", () => {
  beforeEach(() => {
    resetServerClock();
    vi.spyOn(Date, "now").mockReturnValue(LOCAL_NOW);
  });

  it("без данных от сервера считает часы совпадающими", () => {
    expect(serverOffset()).toBe(0);
    expect(toLocalTime(LOCAL_NOW + 2000)).toBe(LOCAL_NOW + 2000);
  });

  it("переводит серверный дедлайн в местное время", () => {
    // Сервер на 5 секунд впереди телефона.
    noteServerTime(LOCAL_NOW + 5000);
    expect(serverOffset()).toBe(5000);
    expect(toLocalTime(LOCAL_NOW + 7000)).toBe(LOCAL_NOW + 2000);
    expect(msUntil(LOCAL_NOW + 7000)).toBe(2000);
  });

  it("считает отсчёт по серверу, а не по отставшим часам телефона", () => {
    // Телефон отстаёт на минуту: без поправки блокировка «висела» бы дольше.
    noteServerTime(LOCAL_NOW + 60_000);
    expect(msUntil(LOCAL_NOW + 62_000)).toBe(2000);
  });

  it("истёкший дедлайн не уходит в минус", () => {
    noteServerTime(LOCAL_NOW);
    expect(msUntil(LOCAL_NOW - 3000)).toBe(0);
  });

  it("оставляет самую быструю оценку: задержка сети завышает расхождение", () => {
    noteServerTime(LOCAL_NOW + 4000);
    noteServerTime(LOCAL_NOW + 9000);
    expect(serverOffset()).toBe(4000);
  });

  it("игнорирует расхождение больше часа и пустое значение", () => {
    noteServerTime(LOCAL_NOW + 2 * 60 * 60 * 1000);
    expect(serverOffset()).toBe(0);
    noteServerTime(undefined);
    noteServerTime(0);
    noteServerTime(Number.NaN);
    expect(serverOffset()).toBe(0);
  });
});
