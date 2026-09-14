/**
 * Wheel geometry. One convention, used by every wheel in the app:
 *
 * - Angles are degrees **clockwise from 12 o'clock**.
 * - Sector `i` occupies `[boundaries[i], boundaries[i + 1])`.
 * - The wheel is drawn rotated by `-rotation`, and the pointer sits at 0°,
 *   so the sector under the pointer is the one containing `rotation mod 360`.
 *
 * Nothing here divides by the sector count, so equal and weighted wheels take
 * the same code path.
 */

const FULL_CIRCLE = 360;

/**
 * Cumulative sector boundaries; length is `count + 1`, running 0 to exactly 360.
 * An empty wheel yields `[0]` — one entry, no sectors — so the count stays
 * derivable from the array everywhere downstream.
 */
export const equalBoundaries = (count: number): number[] =>
  count <= 0
    ? [0]
    : Array.from(
        { length: count + 1 },
        (_, index) => (index * FULL_CIRCLE) / count,
      );

/**
 * Boundaries proportional to `weights`. Non-finite and non-positive weights
 * collapse to zero-width sectors; an all-zero set falls back to equal ones.
 */
export const weightBoundaries = (weights: number[]): number[] => {
  const safe = weights.map((weight) =>
    Number.isFinite(weight) && weight > 0 ? weight : 0,
  );
  const total = safe.reduce((sum, weight) => sum + weight, 0);

  if (total <= 0) {
    return equalBoundaries(weights.length);
  }

  const boundaries = [0];
  let accumulated = 0;
  for (const weight of safe) {
    accumulated += weight;
    boundaries.push((accumulated / total) * FULL_CIRCLE);
  }
  // Assign the seam rather than letting float error land it at 359.99999.
  boundaries[boundaries.length - 1] = FULL_CIRCLE;

  return boundaries;
};

export const normalizeDegrees = (degrees: number) =>
  ((degrees % FULL_CIRCLE) + FULL_CIRCLE) % FULL_CIRCLE;

/**
 * The sector under the pointer, or -1 for an empty wheel.
 *
 * Binary search for the last boundary at or below the angle. A zero-width
 * sector can never come back: it shares its start with its successor, so the
 * successor is always the later match.
 */
export const angleToIndex = (
  rotationDegrees: number,
  boundaries: number[],
): number => {
  const count = boundaries.length - 1;
  if (count <= 0) {
    return -1;
  }

  const angle = normalizeDegrees(rotationDegrees);
  let low = 0;
  let high = count - 1;

  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (boundaries[middle] <= angle) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low;
};

/** Keeps a landing angle this far from either edge of its sector, as a share. */
const EDGE_INSET = 0.15;

/**
 * The inverse of {@link angleToIndex}: an angle strictly inside sector `index`,
 * placed by `jitter` in `[0, 1)`. The inset is what makes rigging exact — the
 * result can never touch a boundary and spill into the neighbouring sector.
 */
export const indexToAngle = (
  index: number,
  boundaries: number[],
  jitter: number,
): number => {
  const start = boundaries[index];
  const end = boundaries[index + 1];
  const width = end - start;
  const inset = width * EDGE_INSET;

  return start + inset + (width - 2 * inset) * Math.min(Math.max(jitter, 0), 1);
};

/** True when the sector has room to be landed on at all. */
export const hasWidth = (index: number, boundaries: number[]) =>
  boundaries[index + 1] - boundaries[index] > 0;

export interface Point {
  x: number;
  y: number;
}

/**
 * Degrees clockwise from 12 o'clock to SVG user units. Increasing `degrees`
 * moves clockwise on screen, which is why every arc below sweeps positive.
 */
export const polarToCartesian = (
  cx: number,
  cy: number,
  radius: number,
  degrees: number,
): Point => {
  const radians = (degrees * Math.PI) / 180;

  return {
    x: cx + radius * Math.sin(radians),
    y: cy - radius * Math.cos(radians),
  };
};

/** An `<path d>` wedge from the centre. Empty string when there is nothing to draw. */
export const sectorPath = (
  cx: number,
  cy: number,
  radius: number,
  startDegrees: number,
  endDegrees: number,
): string => {
  const sweep = endDegrees - startDegrees;

  if (sweep <= 0.0001) {
    return "";
  }

  // A full circle: an arc from a point back to itself draws nothing, so go
  // round in two halves. This is the single-sector wheel.
  if (sweep >= FULL_CIRCLE - 0.0001) {
    return [
      `M ${cx} ${cy - radius}`,
      `A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius}`,
      `A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius}`,
      "Z",
    ].join(" ");
  }

  const from = polarToCartesian(cx, cy, radius, startDegrees);
  const to = polarToCartesian(cx, cy, radius, endDegrees);
  const largeArc = sweep > 180 ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${from.x} ${from.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${to.x} ${to.y}`,
    "Z",
  ].join(" ");
};
