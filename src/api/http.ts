import { backendUrl } from "./backendUrl";
import { authHeaders, setSession } from "./session";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let onUnauthorized: (() => void) | null = null;

/** Провайдер входа подписывается сюда, чтобы разлогинить всех разом. */
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

/**
 * Запрос к игровому серверу с токеном сессии. Сообщения об ошибках приходят
 * от бэкенда по-русски, поэтому показываем их как есть.
 */
export const request = async <T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> => {
  const { auth = true, headers, ...rest } = init;

  let response: Response;
  try {
    response = await fetch(`${backendUrl}${path}`, {
      ...rest,
      headers: {
        ...(rest.body ? { "content-type": "application/json" } : {}),
        ...(auth ? authHeaders() : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError("Нет связи с сервером.", 0);
  }

  if (response.status === 401) {
    setSession(null);
    onUnauthorized?.();
  }

  const payload = (await response.json().catch(() => null)) as
    | (T & { message?: string | string[] })
    | null;

  if (!response.ok) {
    const message = payload?.message;
    throw new ApiError(
      (Array.isArray(message) ? message[0] : message) || `Ошибка ${response.status}`,
      response.status,
    );
  }

  return payload as T;
};
