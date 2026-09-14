// В сборке фронт отдаёт сам сервер — значит, он на том же адресе. В разработке
// страница живёт на порту Vite, поэтому берём её хост и порт сервера: `localhost`
// указывал бы на сам телефон, когда игру открывают по локальной сети.
const fallback = import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:3000`
  : window.location.origin;

/** Origin игрового сервера: сокеты, загрузка и раздача файлов. */
export const backendUrl = (import.meta.env.VITE_BACKEND_URL || fallback).replace(
  /\/$/,
  "",
);

/** Адрес, по которому фронт открыт для участников. */
export const publicUrl = (
  import.meta.env.VITE_PUBLIC_URL || window.location.origin
).replace(/\/$/, "");
