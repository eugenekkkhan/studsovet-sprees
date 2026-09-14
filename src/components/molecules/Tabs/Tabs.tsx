import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { withHaptic } from "../../../api/telegram";
import { usePrefersReducedMotion } from "../../../hooks/usePrefersReducedMotion";

interface TabItem<T extends string> {
  value: T;
  label: string;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `pill` floats above the content, `segmented` renders a joined switch. */
  variant?: "pill" | "segmented";
  block?: boolean;
  /** Compact controls align with the 28px reorder/action row. */
  compact?: boolean;
}

interface Indicator {
  left: number;
  top: number;
  width: number;
  height: number;
}

// The active tab is one pill that slides between the labels, so the track is a
// pill too — and the concentric rule fixes its padding: the pill's radius is
// half its height, the track's is half of *its* height, and the difference is
// the inset. 40px track → 32px pill → 4px; 28px → 24px → 2px.
const containerVariants = cva("relative flex", {
  variants: {
    variant: {
      // The pill variant is a row of separate labels, not one surface.
      pill: "gap-sm",
      segmented: "box-border w-full gap-0 bg-border",
    },
    compact: { true: "", false: "" },
  },
  compoundVariants: [
    {
      variant: "segmented",
      compact: true,
      className: "h-(--control-height-sm) rounded-control-sm p-[2px]",
    },
    {
      variant: "segmented",
      compact: false,
      className: "h-(--control-height-md) rounded-control-md p-2xs",
    },
  ],
  defaultVariants: { variant: "pill", compact: false },
});

const indicatorVariants = cva("absolute top-0 left-0 rounded-pill", {
  variants: {
    variant: {
      pill: "bg-primary-soft",
      segmented: "bg-primary",
    },
  },
  defaultVariants: { variant: "pill" },
});

// Reserves the width of the *bold* label at all times (via the `after`
// ghost copy), so activating a tab changes its weight without
// re-measuring — the row never shifts.
const tabBase =
  "relative z-10 cursor-pointer border-0 bg-transparent text-sm leading-[1.2] whitespace-nowrap transition-colors after:pointer-events-none after:invisible after:block after:h-0 after:overflow-hidden after:font-bold after:content-[attr(data-label)]";

const tabVariants = cva(tabBase, {
  variants: {
    variant: {
      pill: "h-(--control-height-md) rounded-pill px-lg font-medium text-neutral hover:text-text",
      segmented: "h-full flex-1 px-sm font-medium text-text",
    },
    active: {
      true: "",
      false: "",
    },
    block: {
      true: "flex-1",
      false: "",
    },
  },
  compoundVariants: [
    { variant: "pill", active: true, className: "font-bold text-primary-ink" },
    { variant: "segmented", active: true, className: "text-primary-foreground" },
  ],
  defaultVariants: { variant: "pill", active: false, block: false },
});

const sameBox = (a: Indicator | null, b: Indicator) =>
  a !== null &&
  a.left === b.left &&
  a.top === b.top &&
  a.width === b.width &&
  a.height === b.height;

const Tabs = <T extends string>({
  items,
  value,
  onChange,
  variant = "pill",
  block = false,
  compact = false,
}: TabsProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = useState<Indicator | null>(null);
  // The pill only animates once it has a place to move *from*; the first
  // measurement must land silently instead of flying in from the corner.
  const [placed, setPlaced] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  const measure = useCallback(() => {
    const node = buttonsRef.current.get(value);
    if (!node) {
      return;
    }
    const next = {
      left: node.offsetLeft,
      top: node.offsetTop,
      width: node.offsetWidth,
      height: node.offsetHeight,
    };
    // Call sites are free to pass a fresh `items` array on every render, so an
    // unconditional setState here would loop.
    setIndicator((current) => (sameBox(current, next) ? current : next));
  }, [value]);

  useLayoutEffect(measure, [measure, items]);

  useEffect(() => {
    if (indicator && !placed) {
      const frame = requestAnimationFrame(() => setPlaced(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [indicator, placed]);

  // Labels change width with the container (segmented tabs stretch) and again
  // when the display face finishes loading, so both are watched.
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    buttonsRef.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [measure, items]);

  return (
    <div
      ref={containerRef}
      className={cn(containerVariants({ variant, compact }))}
    >
      {indicator && (
        <span
          aria-hidden
          className={cn(
            indicatorVariants({ variant }),
            placed &&
              !prefersReducedMotion &&
              "transition-[transform,width,height] duration-200 ease-out",
          )}
          style={{
            transform: `translate3d(${indicator.left}px, ${indicator.top}px, 0)`,
            width: `${indicator.width}px`,
            height: `${indicator.height}px`,
          }}
        />
      )}

      {items.map((item) => {
        const active = item.value === value;

        return (
          <button
            key={item.value}
            ref={(node) => {
              if (node) {
                buttonsRef.current.set(item.value, node);
              } else {
                buttonsRef.current.delete(item.value);
              }
            }}
            type="button"
            data-label={item.label}
            aria-pressed={active}
            className={cn(tabVariants({ variant, active, block }))}
            onClick={withHaptic("tap", () => onChange(item.value))}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export type { TabItem, TabsProps };
export default Tabs;
