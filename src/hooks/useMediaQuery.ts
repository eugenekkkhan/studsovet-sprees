import { useEffect, useState } from "react";

/** Следит за медиазапросом и перерисовывает, когда тот перестаёт совпадать. */
export const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);

  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) {
      return;
    }

    setMatches(media.matches);
    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
};
