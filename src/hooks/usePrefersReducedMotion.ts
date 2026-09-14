import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** Tracks the OS "reduce motion" setting, and follows it if it changes. */
export const usePrefersReducedMotion = () => {
  const [prefersReduced, setPrefersReduced] = useState(
    () => window.matchMedia?.(QUERY).matches ?? false,
  );

  useEffect(() => {
    const media = window.matchMedia?.(QUERY);
    if (!media) {
      return;
    }

    const handleChange = (event: MediaQueryListEvent) =>
      setPrefersReduced(event.matches);

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return prefersReduced;
};
