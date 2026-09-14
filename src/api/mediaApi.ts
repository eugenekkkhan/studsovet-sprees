import { backendUrl } from "./backendUrl";
import { authHeaders, getSession } from "./session";
import type { Media, MediaType } from "../types/quiz";

/** Права ведущего: свой токен на основном экране или ключ второго пульта. */
export interface UploadAuth {
  code: string;
  hostToken?: string;
  hostJoinKey?: string;
}

/**
 * Сервер отдаёт относительный путь `/media/files/…`, чтобы колода не привязывалась
 * к конкретному хосту. Показывать её нужно с origin игрового сервера.
 */
export const resolveMediaUrl = (url?: string | null) => {
  if (!url) return undefined;
  return url.startsWith("/") ? `${backendUrl}${url}` : url;
};

export interface UploadedMedia extends Media {
  name: string;
  bytes: number;
}

/**
 * Загружает картинку или звук. Достаточно быть автором колоды — комната нужна
 * только там, где колоду правят с пульта, не входя в приложение.
 */
export const uploadMedia = async (
  file: File,
  auth: UploadAuth,
): Promise<UploadedMedia> => {
  if (!auth.code && !getSession()) {
    throw new Error("Войдите через Telegram или подключитесь к комнате.");
  }

  const body = new FormData();
  body.append("file", file);

  let response: Response;
  try {
    response = await fetch(`${backendUrl}/media/upload`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "x-quiz-room": auth.code,
        ...(auth.hostToken ? { "x-quiz-host-token": auth.hostToken } : {}),
        ...(auth.hostJoinKey ? { "x-quiz-host-key": auth.hostJoinKey } : {}),
      },
      body,
    });
  } catch {
    throw new Error("Нет связи с игровым сервером.");
  }

  const payload = (await response.json().catch(() => null)) as
    | { url?: string; type?: MediaType; name?: string; bytes?: number; message?: string }
    | null;

  if (!response.ok || !payload?.url || !payload.type) {
    throw new Error(payload?.message ?? "Не удалось загрузить файл.");
  }

  return {
    url: payload.url,
    type: payload.type,
    name: payload.name ?? "",
    bytes: payload.bytes ?? file.size,
  };
};
