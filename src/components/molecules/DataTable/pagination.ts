/** Многоточие между разрывами в ряду страниц. */
export const GAP = "gap" as const;

/**
 * Окно страниц вокруг текущей: первая, последняя, соседи — и разрывы между
 * ними. Без окна ряд из четырнадцати страниц занимал бы всю ширину подвала,
 * а без первой и последней до края пришлось бы идти по одной.
 */
export const pageWindow = (current: number, total: number, around = 1): (number | typeof GAP)[] => {
  if (total <= 1) return [1];

  const shown = new Set([1, total]);
  for (let page = current - around; page <= current + around; page += 1) {
    if (page >= 1 && page <= total) shown.add(page);
  }

  const pages = [...shown].sort((left, right) => left - right);
  return pages.flatMap((page, index) =>
    index > 0 && page - pages[index - 1] > 1 ? [GAP, page] : [page]);
};
