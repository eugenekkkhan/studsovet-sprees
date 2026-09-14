import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { IoClose } from "react-icons/io5";
import { withHaptic } from "../../../api/telegram";
import { usePrefersReducedMotion } from "../../../hooks/usePrefersReducedMotion";
import { useTelegramBackButton } from "../../../hooks/useTelegramBackButton";
import {
  clampOffset,
  distance,
  DOUBLE_TAP_SCALE,
  IDENTITY,
  midpoint,
  MIN_SCALE,
  zoomAround,
  type Point,
  type Transform,
} from "./zoom";

interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

/** Касание считается тапом, если палец почти не сдвинулся. */
const TAP_SLOP = 12;
/** Два тапа подряд в этом окне — двойной тап. */
const DOUBLE_TAP_MS = 300;
/** Насколько надо потянуть картинку вниз, чтобы просмотр закрылся. */
const DISMISS_DISTANCE = 110;

/**
 * Картинка вопроса во весь экран: щипок и колесо приближают, палец таскает,
 * двойное касание переключает масштаб. Капитан смотрит в телефон с дивана, и
 * мелкая деталь на скриншоте иначе просто не читается.
 *
 * Пока просмотр открыт, он забирает себе родную кнопку «назад» Telegram,
 * поэтому не стоит открывать его на экране, который сам ею распоряжается.
 */
const ImageLightbox = ({ src, alt = "", onClose }: ImageLightboxProps) => {
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const [smooth, setSmooth] = useState(false);
  /** Сдвиг «утаскивания» вниз: видно, что палец уже закрывает просмотр. */
  const [dismissY, setDismissY] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ start: Transform; distance: number; center: Point } | null>(
    null,
  );
  const drag = useRef<{
    id: number;
    origin: Point;
    start: Transform;
    startedAt: number;
    onImage: boolean;
  } | null>(null);
  const lastTapAt = useRef(0);

  const reducedMotion = usePrefersReducedMotion();
  useTelegramBackButton(onClose);

  /** Точка события в координатах от центра картинки. */
  const toStagePoint = useCallback((clientX: number, clientY: number): Point => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clientX - (rect.left + rect.width / 2),
      y: clientY - (rect.top + rect.height / 2),
    };
  }, []);

  /** Приводит картинку в допустимые пределы: из-под края и обратно в центр. */
  const contain = useCallback((next: Transform): Transform => {
    if (next.scale <= MIN_SCALE) return IDENTITY;
    const image = imageRef.current;
    return image
      ? clampOffset(next, image.offsetWidth, image.offsetHeight)
      : next;
  }, []);

  const settle = useCallback(
    () => setTransform((current) => contain(current)),
    [contain],
  );

  const zoomTo = useCallback(
    (scale: number, at: Point) => {
      setSmooth(!reducedMotion);
      setTransform((current) =>
        contain(zoomAround(current, scale, at.x, at.y)),
      );
    },
    [contain, reducedMotion],
  );

  // Клавиатура ведущего: Escape закрывает, «0» возвращает исходный масштаб.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "0") {
        setSmooth(!reducedMotion);
        setTransform(IDENTITY);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, reducedMotion]);

  // Страница под просмотром не должна прокручиваться вместе с картинкой.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Колесо мыши приближает к курсору. Слушатель родной и не пассивный: иначе
  // браузер сначала прокрутит страницу, а отменить это уже нельзя.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const at = toStagePoint(event.clientX, event.clientY);
      setSmooth(false);
      setTransform((current) =>
        contain(
          zoomAround(current, current.scale * Math.exp(-event.deltaY / 300), at.x, at.y),
        ),
      );
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [contain, toStagePoint]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Захват держит жест на сцене, даже если палец уехал на кнопку закрытия.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Старый или тестовый DOM без захвата указателя — жест переживёт.
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setSmooth(false);

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const center = midpoint(a, b);
      pinch.current = {
        start: transform,
        distance: distance(a, b),
        center: toStagePoint(center.x, center.y),
      };
      drag.current = null;
      return;
    }

    if (pointers.current.size === 1) {
      drag.current = {
        id: event.pointerId,
        origin: { x: event.clientX, y: event.clientY },
        start: transform,
        startedAt: Date.now(),
        onImage: event.target === imageRef.current,
      };
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const spread = pinch.current;
    if (spread && pointers.current.size >= 2) {
      const [a, b] = Array.from(pointers.current.values());
      const factor = distance(a, b) / (spread.distance || 1);
      setTransform(
        zoomAround(
          spread.start,
          spread.start.scale * factor,
          spread.center.x,
          spread.center.y,
        ),
      );
      return;
    }

    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    const dx = event.clientX - active.origin.x;
    const dy = event.clientY - active.origin.y;

    if (active.start.scale > MIN_SCALE) {
      setTransform(
        contain({
          scale: active.start.scale,
          x: active.start.x + dx,
          y: active.start.y + dy,
        }),
      );
      return;
    }

    // В исходном масштабе таскать нечего, поэтому вертикальный жест закрывает
    // просмотр — привычный способ выйти из галереи одним движением.
    if (Math.abs(dy) > Math.abs(dx)) setDismissY(dy);
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);

    if (pointers.current.size < 2 && pinch.current) {
      pinch.current = null;
      drag.current = null;
      settle();
      return;
    }

    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    drag.current = null;

    const dx = event.clientX - active.origin.x;
    const dy = event.clientY - active.origin.y;

    if (active.start.scale <= MIN_SCALE && dismissY > DISMISS_DISTANCE) {
      setDismissY(0);
      onClose();
      return;
    }
    setSmooth(!reducedMotion);
    setDismissY(0);

    if (Math.hypot(dx, dy) > TAP_SLOP || Date.now() - active.startedAt > 400) {
      settle();
      return;
    }

    // Тап мимо картинки закрывает просмотр; по самой картинке — ждём второго
    // касания, иначе выйти можно было бы случайно, разглядывая деталь.
    if (!active.onImage) {
      onClose();
      return;
    }

    const now = Date.now();
    if (now - lastTapAt.current < DOUBLE_TAP_MS) {
      lastTapAt.current = 0;
      zoomTo(
        transform.scale > MIN_SCALE ? MIN_SCALE : DOUBLE_TAP_SCALE,
        toStagePoint(event.clientX, event.clientY),
      );
      return;
    }
    lastTapAt.current = now;
  };

  const zoomed = transform.scale > MIN_SCALE;
  const fade = Math.min(1, Math.abs(dismissY) / (DISMISS_DISTANCE * 2));

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Изображение вопроса"
      style={{ opacity: 1 - fade * 0.6 }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-sm p-md">
        <span className="rounded-pill bg-white/10 px-sm py-2xs text-xs text-white/80">
          {zoomed ? `${transform.scale.toFixed(1)}×` : "Двойное касание — приблизить"}
        </span>
        <button
          type="button"
          aria-label="Закрыть изображение"
          onClick={withHaptic("tap", onClose)}
          className="pointer-events-auto inline-flex size-(--control-height-md) shrink-0 cursor-pointer appearance-none items-center justify-center rounded-pill border border-white/30 bg-white/10 p-0 text-white outline-none hover:bg-white/20 focus-visible:ring-[3px] focus-visible:ring-white/50"
        >
          <IoClose size={22} aria-hidden />
        </button>
      </div>

      <div
        ref={stageRef}
        className="flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full object-contain"
          style={{
            transform: `translate3d(${transform.x}px, ${transform.y + dismissY}px, 0) scale(${transform.scale})`,
            transition: smooth ? "transform 200ms ease-out" : undefined,
            cursor: zoomed ? "grab" : "zoom-in",
          }}
        />
      </div>
    </div>,
    document.body,
  );
};

export type { ImageLightboxProps };
export default ImageLightbox;
