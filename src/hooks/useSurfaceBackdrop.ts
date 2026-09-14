import { useEffect, useState } from "react";
import { surfaceBackdrop, THEME_EVENT } from "../utils/color";

/**
 * Цвет подложки, на которой лежат карточки. Telegram присылает свою тему уже
 * после первого рендера и может сменить её на ходу, поэтому цвет не читается
 * один раз навсегда, а пересчитывается по событию темы.
 */
export const useSurfaceBackdrop = () => {
  const [color, setColor] = useState(surfaceBackdrop);

  useEffect(() => {
    const update = () => setColor(surfaceBackdrop());
    update();
    window.addEventListener(THEME_EVENT, update);
    return () => window.removeEventListener(THEME_EVENT, update);
  }, []);

  return color;
};
