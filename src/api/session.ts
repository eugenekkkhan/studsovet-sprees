const TOKEN_KEY = "spreesSessionV1";

interface StoredSession {
  token: string;
  expiresAt: number;
}

let session: StoredSession | null = null;
let loaded = false;

const read = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredSession) : null;
    if (!parsed?.token || parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
};

/** Токен сессии: в памяти для скорости, в localStorage — чтобы пережить перезагрузку. */
export const getSession = () => {
  if (!loaded) {
    session = read();
    loaded = true;
  }
  return session;
};

export const setSession = (value: StoredSession | null) => {
  session = value;
  loaded = true;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, JSON.stringify(value));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Приватный режим: сессия живёт до перезагрузки страницы.
  }
};

export const authHeaders = (): Record<string, string> => {
  const token = getSession()?.token;
  return token ? { authorization: `Bearer ${token}` } : {};
};
