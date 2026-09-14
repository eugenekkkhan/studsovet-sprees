/**
 * Значение, начинающееся с =, +, - или @, Excel и Sheets разбирают как
 * формулу, а имена и юзернеймы в этих таблицах приходят из Telegram, то есть
 * пишутся пользователем. Апостроф впереди оставляет значение текстом.
 */
export const escapeCsv = (value: unknown) => {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};
