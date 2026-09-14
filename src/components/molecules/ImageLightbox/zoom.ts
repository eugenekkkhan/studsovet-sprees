/** Дальше приближать нечего: пиксели уже видно, а палец теряет картинку. */
export const MAX_SCALE = 6;
export const MIN_SCALE = 1;
/** Двойное касание — сразу заметное приближение, а не робкий шаг. */
export const DOUBLE_TAP_SCALE = 2.5;

export interface Transform {
  scale: number;
  /** Сдвиг в пикселях от центра — в тех же координатах, что и CSS-transform. */
  x: number;
  y: number;
}

export const IDENTITY: Transform = { scale: MIN_SCALE, x: 0, y: 0 };

export const clampScale = (scale: number) =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

/**
 * Не даёт увести картинку за собственный край: сдвиг ограничен той половиной,
 * что вылезла за кадр при увеличении. В исходном масштабе выходит ноль —
 * картинка всегда возвращается в центр.
 */
export const clampOffset = (
  transform: Transform,
  width: number,
  height: number,
): Transform => {
  const limitX = Math.max(0, (width * (transform.scale - 1)) / 2);
  const limitY = Math.max(0, (height * (transform.scale - 1)) / 2);
  return {
    scale: transform.scale,
    x: Math.min(limitX, Math.max(-limitX, transform.x)),
    y: Math.min(limitY, Math.max(-limitY, transform.y)),
  };
};

/**
 * Меняет масштаб вокруг точки: то, что было под пальцем или курсором, там же и
 * остаётся. Точка задаётся от центра картинки — как и сам transform.
 */
export const zoomAround = (
  transform: Transform,
  nextScale: number,
  pointX: number,
  pointY: number,
): Transform => {
  const scale = clampScale(nextScale);
  const ratio = scale / transform.scale;
  return {
    scale,
    x: pointX - (pointX - transform.x) * ratio,
    y: pointY - (pointY - transform.y) * ratio,
  };
};

export interface Point {
  x: number;
  y: number;
}

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
