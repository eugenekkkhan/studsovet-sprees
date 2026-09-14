/** Пользователь Telegram в том виде, в каком его присылает мини-приложение. */
export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  is_premium?: boolean;
}

/** Тот, от чьего имени приходят запросы: либо Telegram, либо локальная разработка. */
export interface SessionUser {
  id: number;
  name: string;
  username: string;
  photoUrl: string;
  kind: 'telegram' | 'dev';
}

export interface SessionPayload extends SessionUser {
  /** Unix-время в секундах, после которого токен недействителен. */
  exp: number;
}

export interface SessionResponse {
  token: string;
  expiresAt: number;
  user: SessionUser;
}

/** Имя пользователя для интерфейса: «Женя К.» лучше, чем голый id. */
export const displayName = (user: TelegramUser) =>
  [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
  (user.username ? `@${user.username}` : `id${user.id}`);
