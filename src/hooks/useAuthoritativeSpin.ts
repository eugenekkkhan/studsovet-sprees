import { useEffect, useRef } from "react";
import { msUntil } from "../api/serverClock";
import type { AuthoritativeSpin } from "../types/fieldOfMiracles";

/** Та часть колеса, которой достаточно, чтобы проиграть вращение сервера. */
interface SpinControls {
  spinToAngle: (landingAngle: number, remainingDurationMs?: number) => void;
  snapToAngle: (landingAngle: number) => void;
  reset: () => void;
}

/**
 * Проигрывает вращение, назначенное сервером, на любом экране: у ведущего,
 * у капитана и на проекторе. Угол и момент остановки приходят готовыми —
 * клиент ничего не разыгрывает сам, поэтому все три экрана останавливаются
 * на одном секторе.
 *
 * Дедлайн считается через `msUntil`: `startedAt` идёт в часах сервера, и
 * прямое вычитание `Date.now()` обнуляло остаток на спешащем устройстве —
 * вместо вращения был мгновенный перескок.
 */
export const useAuthoritativeSpin = (
  spin: AuthoritativeSpin | null,
  { spinToAngle, snapToAngle, reset }: SpinControls,
) => {
  const animatedSpinId = useRef<string | null>(null);

  useEffect(() => {
    if (!spin) {
      animatedSpinId.current = null;
      reset();
      return;
    }
    // Одно вращение проигрывается один раз: повторные рассылки того же
    // состояния не должны запускать анимацию заново.
    if (animatedSpinId.current === spin.id) return;
    animatedSpinId.current = spin.id;

    if (spin.status === "spinning") {
      spinToAngle(spin.landingAngle, msUntil(spin.startedAt + spin.durationMs));
      return;
    }
    // Экран открыли после остановки — показываем итог без повтора анимации.
    snapToAngle(spin.landingAngle);
  }, [reset, snapToAngle, spin, spinToAngle]);
};
