import { describe, expect, it } from "vitest";
import {
  clampOffset,
  clampScale,
  distance,
  IDENTITY,
  MAX_SCALE,
  midpoint,
  MIN_SCALE,
  zoomAround,
} from "./zoom";

describe("арифметика увеличения картинки", () => {
  it("масштаб не выходит за пределы, в которых картинка ещё читается", () => {
    expect(clampScale(0.2)).toBe(MIN_SCALE);
    expect(clampScale(2.5)).toBe(2.5);
    expect(clampScale(40)).toBe(MAX_SCALE);
  });

  it("точка под пальцем остаётся на месте при увеличении", () => {
    // Палец держит левый верхний угол; после приближения он должен указывать
    // на ту же деталь картинки, иначе она уезжает из-под пальца.
    const at = { x: -100, y: -60 };
    const next = zoomAround(IDENTITY, 2, at.x, at.y);

    const before = { x: (at.x - IDENTITY.x) / IDENTITY.scale, y: (at.y - IDENTITY.y) / IDENTITY.scale };
    const after = { x: (at.x - next.x) / next.scale, y: (at.y - next.y) / next.scale };
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it("возврат к исходному масштабу отменяет накопленный сдвиг", () => {
    const zoomed = zoomAround(IDENTITY, 3, 120, 40);
    const back = zoomAround(zoomed, MIN_SCALE, 120, 40);
    expect(back.scale).toBe(MIN_SCALE);
    expect(back.x).toBeCloseTo(0, 6);
    expect(back.y).toBeCloseTo(0, 6);
  });

  it("картинку нельзя утащить за собственный край", () => {
    // При двукратном увеличении за кадром прячется по половине ширины с
    // каждой стороны — дальше сдвигать некуда.
    const dragged = { scale: 2, x: 900, y: -900 };
    const held = clampOffset(dragged, 400, 300);
    expect(held.x).toBe(200);
    expect(held.y).toBe(-150);
  });

  it("в исходном масштабе картинка всегда стоит по центру", () => {
    const centered = clampOffset({ scale: 1, x: 80, y: -40 }, 400, 300);
    expect(centered.scale).toBe(MIN_SCALE);
    expect(centered.x).toBeCloseTo(0, 6);
    expect(centered.y).toBeCloseTo(0, 6);
  });

  it("щипок считает расстояние и середину между пальцами", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 30, y: 40 };
    expect(distance(a, b)).toBe(50);
    expect(midpoint(a, b)).toEqual({ x: 15, y: 20 });
  });
});
