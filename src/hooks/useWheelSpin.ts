import { useCallback, useEffect, useRef, useState } from "react";
import { angleToIndex, hasWidth, indexToAngle, normalizeDegrees } from "../utils/wheel";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

const DEFAULT_DURATION_MS = 4200;
const DEFAULT_TURNS = 5;
const DEFAULT_EASING = "cubic-bezier(0.18, 0.88, 0.18, 1)";
/** A backgrounded tab can defer a transition indefinitely; this ends the spin anyway. */
const SETTLE_GRACE_MS = 250;

interface UseWheelSpinOptions {
  /**
   * Cumulative sector boundaries. Taking these rather than a count is what
   * makes weighted and equal wheels one code path — nothing here divides by n.
   */
  boundaries: number[];
  durationMs?: number;
  turns?: number;
  easing?: string;
  onSettle?: (index: number) => void;
}

/**
 * Drives a wheel with a CSS transition on its rotating group and resolves the
 * winner on `transitionend`. React renders twice per spin rather than once per
 * frame, which is why this is not a requestAnimationFrame loop.
 */
export const useWheelSpin = ({
  boundaries,
  durationMs = DEFAULT_DURATION_MS,
  turns = DEFAULT_TURNS,
  easing = DEFAULT_EASING,
  onSettle,
}: UseWheelSpinOptions) => {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);

  // A callback ref, not a plain one: the rotating group is absent while the
  // wheel is empty, so the listener has to attach when it finally mounts.
  const [node, setNode] = useState<SVGGElement | null>(null);
  const rotationRef = useRef(0);
  const resultRef = useRef<number | null>(null);
  const boundariesRef = useRef(boundaries);
  const onSettleRef = useRef(onSettle);
  const timerRef = useRef<number | null>(null);
  /** Bumped on every spin, so a late event from an abandoned one is ignored. */
  const tokenRef = useRef(0);

  boundariesRef.current = boundaries;
  onSettleRef.current = onSettle;

  const prefersReducedMotion = usePrefersReducedMotion();
  const effectiveDurationMs = prefersReducedMotion ? 0 : durationMs;
  const [transitionDurationMs, setTransitionDurationMs] =
    useState(effectiveDurationMs);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const settle = useCallback((token: number) => {
    if (token !== tokenRef.current || resultRef.current === null) {
      return;
    }

    clearTimer();
    const index = resultRef.current;
    resultRef.current = null;
    setSpinning(false);
    setWinnerIndex(index);
    onSettleRef.current?.(index);
  }, []);

  const spinRef = useCallback((element: SVGGElement | null) => setNode(element), []);

  // The token check inside `settle` does the filtering; this cleanup covers
  // unmounting mid-spin.
  useEffect(() => {
    if (!node) {
      return;
    }

    const handleEnd = (event: TransitionEvent) => {
      if (event.propertyName === "transform" && event.target === node) {
        settle(tokenRef.current);
      }
    };

    node.addEventListener("transitionend", handleEnd);
    return () => {
      node.removeEventListener("transitionend", handleEnd);
      clearTimer();
    };
  }, [node, settle]);

  const startSpin = useCallback(
    (
      landing: number,
      randomizeTurns: boolean,
      requestedDurationMs = effectiveDurationMs,
    ) => {
      const bounds = boundariesRef.current;
      const count = bounds.length - 1;
      if (count <= 0 || spinning) {
        return;
      }

      // Continue from wherever the wheel stopped rather than snapping to zero.
      const current = rotationRef.current;
      const delta = normalizeDegrees(landing - normalizeDegrees(current));
      const target =
        current +
        (turns + (randomizeTurns ? Math.floor(Math.random() * 3) : 2)) * 360 +
        delta;

      const token = tokenRef.current + 1;
      tokenRef.current = token;
      resultRef.current = angleToIndex(target, bounds);
      rotationRef.current = target;

      clearTimer();
      setWinnerIndex(null);
      setSpinning(true);
      const animationDurationMs = prefersReducedMotion
        ? 0
        : Math.max(0, requestedDurationMs);
      setTransitionDurationMs(animationDurationMs);
      setRotation(target);

      // A 0ms transition may never fire `transitionend` at all — which is
      // exactly the reduced-motion path — so the timer is the real finish line
      // there and the safety net everywhere else. With no animation to wait
      // for there is nothing to grant grace to, so that path resolves at once.
      timerRef.current = window.setTimeout(
        () => settle(token),
        animationDurationMs === 0 ? 0 : animationDurationMs + SETTLE_GRACE_MS,
      );
    },
    [effectiveDurationMs, prefersReducedMotion, settle, spinning, turns],
  );

  const spin = useCallback(
    (targetIndex?: number | null) => {
      // Snapshot: the list must not shift the boundaries out from under a
      // result that has already been computed.
      const bounds = boundariesRef.current;
      const count = bounds.length - 1;
      if (count <= 0 || spinning) return;
      const rigged =
        targetIndex !== null &&
        targetIndex !== undefined &&
        targetIndex >= 0 &&
        targetIndex < count &&
        hasWidth(targetIndex, bounds);
      startSpin(
        rigged
          ? indexToAngle(targetIndex as number, bounds, Math.random())
          : Math.random() * 360,
        true,
      );
    },
    [spinning, startSpin],
  );

  /** Animate to the exact backend-issued angle without client-side randomness. */
  const spinToAngle = useCallback(
    (landingAngle: number, remainingDurationMs?: number) => {
      if (!Number.isFinite(landingAngle)) return;
      startSpin(
        normalizeDegrees(landingAngle),
        false,
        remainingDurationMs ?? effectiveDurationMs,
      );
    },
    [effectiveDurationMs, startSpin],
  );

  /** Restore an already-settled authoritative result without replaying it. */
  const snapToAngle = useCallback((landingAngle: number) => {
    const bounds = boundariesRef.current;
    if (!Number.isFinite(landingAngle) || bounds.length < 2) return;
    tokenRef.current += 1;
    resultRef.current = null;
    clearTimer();
    const current = rotationRef.current;
    const target =
      current + normalizeDegrees(landingAngle - normalizeDegrees(current));
    rotationRef.current = target;
    setTransitionDurationMs(0);
    setSpinning(false);
    setRotation(target);
    setWinnerIndex(angleToIndex(target, bounds));
  }, []);

  const reset = useCallback(() => {
    tokenRef.current += 1;
    resultRef.current = null;
    clearTimer();
    setSpinning(false);
    setWinnerIndex(null);
  }, []);

  return {
    rotation,
    spinning,
    winnerIndex,
    effectiveDurationMs: transitionDurationMs,
    easing,
    spinRef,
    spin,
    spinToAngle,
    snapToAngle,
    reset,
  };
};
