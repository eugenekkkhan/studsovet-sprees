import { useState } from "react";

/**
 * Wraps admin fetch calls with the shared loading / error handling
 * that every admin tab needs.
 */
export const useApiCall = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const call = async (request: () => Promise<Response>) => {
    setLoading(true);
    setError("");
    try {
      const response = await request();
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.message ?? `Ошибка ${response.status}`);
      }
    } catch {
      setError("Не удалось связаться с сервером");
    }
    setLoading(false);
  };

  return { call, loading, error, setError };
};
