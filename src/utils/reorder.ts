/**
 * Перенос элемента на место другого — результат любого перетаскивания: и в
 * редакторе колоды, и в очереди сортировки, и в панели отбора.
 */
export const reorderBy = <T,>(
  items: T[],
  keyOf: (item: T) => string,
  fromId: string,
  toId: string,
): T[] => {
  const from = items.findIndex((item) => keyOf(item) === fromId);
  const to = items.findIndex((item) => keyOf(item) === toId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

/** То же самое для списка ключей. */
export const reorderKeys = (keys: string[], fromId: string, toId: string) =>
  reorderBy(keys, (key) => key, fromId, toId);

/**
 * Сохранённый порядок поверх текущего списка. Ключи, которых пользователь не
 * трогал, встают в конец в своём исходном порядке, а исчезнувшие отсеиваются:
 * иначе набор колонок, изменившийся между сеансами, ломал бы раскладку.
 */
export const applyOrder = (keys: string[], order: string[]) => {
  const known = new Set(keys);
  const seen = new Set<string>();
  const placed: string[] = [];

  // Порядок приходит из localStorage, то есть может быть каким угодно. Повтор
  // ключа развернулся бы в два одинаковых поля с одним React key.
  for (const key of order) {
    if (!known.has(key) || seen.has(key)) continue;
    seen.add(key);
    placed.push(key);
  }

  return [...placed, ...keys.filter((key) => !seen.has(key))];
};
