import { describe, expect, it } from "vitest";
import {
  angleToIndex,
  equalBoundaries,
  hasWidth,
  indexToAngle,
  normalizeDegrees,
  sectorPath,
  weightBoundaries,
} from "./wheel";

/** Every boundary set the app can realistically produce. */
const boundarySets: [string, number[]][] = [
  ["equal 1", equalBoundaries(1)],
  ["equal 2", equalBoundaries(2)],
  ["equal 3", equalBoundaries(3)],
  ["equal 7", equalBoundaries(7)],
  ["equal 18 (drum)", equalBoundaries(18)],
  ["equal 37", equalBoundaries(37)],
  ["weights [1]", weightBoundaries([1])],
  ["weights [1,1]", weightBoundaries([1, 1])],
  ["weights [5,1,1]", weightBoundaries([5, 1, 1])],
  ["weights [1,0,1]", weightBoundaries([1, 0, 1])],
  ["weights [0,0]", weightBoundaries([0, 0])],
  ["weights [3,1,4,1,5,9,2,6]", weightBoundaries([3, 1, 4, 1, 5, 9, 2, 6])],
];

const jitters = Array.from({ length: 20 }, (_, step) => step / 20);

describe("the rigging round trip", () => {
  it.each(boundarySets)(
    "%s: angleToIndex(indexToAngle(i)) === i for every sector and jitter",
    (_name, boundaries) => {
      for (let index = 0; index < boundaries.length - 1; index += 1) {
        if (!hasWidth(index, boundaries)) {
          continue;
        }
        for (const jitter of jitters) {
          expect(angleToIndex(indexToAngle(index, boundaries, jitter), boundaries)).toBe(
            index,
          );
        }
      }
    },
  );
});

describe("weightBoundaries", () => {
  it.each(boundarySets)("%s runs 0 → 360 and never decreases", (_name, boundaries) => {
    expect(boundaries[0]).toBe(0);
    expect(boundaries[boundaries.length - 1]).toBe(360);
    for (let index = 1; index < boundaries.length; index += 1) {
      expect(boundaries[index]).toBeGreaterThanOrEqual(boundaries[index - 1]);
    }
  });

  it("sizes sectors in proportion to their weights", () => {
    const boundaries = weightBoundaries([3, 1]);
    expect(boundaries[1]).toBeCloseTo(270, 10);
  });

  it("falls back to equal sectors when every weight is unusable", () => {
    expect(weightBoundaries([0, -4, Number.NaN])).toEqual(equalBoundaries(3));
  });
});

describe("angleToIndex", () => {
  it("returns -1 for an empty wheel", () => {
    expect(angleToIndex(123, equalBoundaries(0))).toBe(-1);
    expect(angleToIndex(0, [])).toBe(-1);
  });

  it("normalises negative and overshooting rotations", () => {
    const boundaries = equalBoundaries(4);
    expect(angleToIndex(-45, boundaries)).toBe(3);
    expect(angleToIndex(360 * 7 + 100, boundaries)).toBe(1);
    expect(normalizeDegrees(-90)).toBe(270);
  });

  it("never returns a zero-width sector", () => {
    const boundaries = weightBoundaries([1, 0, 1]);
    for (let angle = 0; angle < 360; angle += 0.25) {
      expect(angleToIndex(angle, boundaries)).not.toBe(1);
    }
  });

  it("puts a boundary angle in the sector it starts", () => {
    const boundaries = equalBoundaries(4);
    expect(angleToIndex(90, boundaries)).toBe(1);
    expect(angleToIndex(89.999, boundaries)).toBe(0);
  });
});

describe("sectorPath", () => {
  it("draws a full circle as two arcs for a single-sector wheel", () => {
    const path = sectorPath(50, 50, 44, 0, 360);
    expect(path.match(/A /g)).toHaveLength(2);
    expect(path).not.toContain("L ");
  });

  it("draws nothing for a zero-width sector", () => {
    expect(sectorPath(50, 50, 44, 90, 90)).toBe("");
  });

  it("sets the large-arc flag only past a half turn", () => {
    expect(sectorPath(50, 50, 44, 0, 200)).toContain("A 44 44 0 1 1");
    expect(sectorPath(50, 50, 44, 0, 100)).toContain("A 44 44 0 0 1");
  });

  it("places 0° at 12 o'clock and 90° at 3 o'clock", () => {
    expect(sectorPath(50, 50, 40, 0, 90)).toContain("L 50 10");
    expect(sectorPath(50, 50, 40, 0, 90)).toContain("1 90 50");
  });
});
