import type { CSSProperties, Ref } from "react";
import type { IconType } from "react-icons";
import {
  equalBoundaries,
  normalizeDegrees,
  sectorPath,
  weightBoundaries,
} from "../../../utils/wheel";
import { readableInk } from "../../../utils/color";
import { color as token, font, rawInk, shadow } from "../../../styles/tokens";

interface WheelSector {
  /** Stable React key; falls back to the index. */
  id?: string;
  label: string;
  /** Sector fill. User data, so it arrives as a value rather than a token. */
  color: string;
  /** Share of the circle relative to its siblings. Defaults to 1. */
  weight?: number;
  /** Icon drawn at the rim, outside the label. A react-icons component. */
  icon?: IconType;
}

interface WheelProps {
  sectors: WheelSector[];
  /** Degrees. The wheel turns counter-clockwise by this much. */
  rotation: number;
  /** Any CSS length: "420px", "min(72vmin, 520px)". */
  size?: string | number;
  /** 0 or undefined animates nothing — also the reduced-motion path. */
  spinDurationMs?: number;
  easing?: string;
  /** Outlined once the spin settles. Indexes `sectors`. */
  winnerIndex?: number | null;
  showLabels?: boolean;
  hub?: boolean;
  hubColor?: string;
  /** Draws the outer ring. Off by default — the roulette wants a bare disc. */
  rim?: boolean;
  rimColor?: string;
  pointerColor?: string;
  /** Forwarded to the rotating group so a spin hook can hear `transitionend`. */
  spinRef?: Ref<SVGGElement>;
  ariaLabel?: string;
  className?: string;
}

/* Geometry, in viewBox units. The viewBox starts at 0 0 rather than being
   centred so the spin's transform-origin is a plain "50px 50px" — SVG elements
   take their origin from the viewBox, not from their own box. */
const VIEW = 100;
const CENTRE = VIEW / 2;
const SECTOR_R = 44;
const RIM_R = 45.6;
const RIM_WIDTH = 2.4;
const HUB_R = 9;
const LABEL_OUTER_R = 41;

const MAX_FONT = 5.5;
const MIN_FONT = 2.4;
/** Rough advance width per em for the body face; good enough to fit text by. */
const AVG_ADVANCE = 0.55;
/** Icon box and the room it claims, both as multiples of the font size. */
const ICON_SCALE = 1.25;
const ICON_ADVANCE = ICON_SCALE * 1.35;
/** Past this, a label would be under 11px on a 450px wheel — drop them all. */
const MAX_LABELLED_SECTORS = 60;
/** A lone sector owns the whole disc, so its label sits big in the middle. */
const SOLO_FONT = 9;

const POINTER = `M ${CENTRE} 10.5 L ${CENTRE - 5} -0.5 L ${CENTRE + 5} -0.5 Z`;

const toLength = (size: string | number) =>
  typeof size === "number" ? `${size}px` : size;

interface LabelPlan {
  text: string;
  fontSize: number;
  iconSize: number;
  /** Distances from the centre, so a flipped label can mirror them. */
  iconDistance: number;
  textDistance: number;
}

/**
 * Shrinks a label to fit its wedge, and only truncates once it hits the floor.
 * Sizing is arithmetic rather than measured: `getComputedTextLength` would cost
 * a second render on every resize to buy a slightly better ellipsis.
 */
const planLabel = (
  label: string,
  hasIcon: boolean,
  startDegrees: number,
  endDegrees: number,
  innerR: number,
): LabelPlan | null => {
  const sweep = endDegrees - startDegrees;
  if (sweep <= 0 || label.length === 0) {
    return null;
  }

  const midR = (innerR + LABEL_OUTER_R) / 2;
  // Room across the wedge at the label's midpoint, which is what caps the type
  // size on a crowded wheel. The half-angle is clamped to 90°: past a half
  // turn the chord starts shrinking again, and a wedge that wide is not short
  // of room. Reachable once weights are uneven enough.
  const tangential =
    2 * midR * Math.sin((Math.min(sweep / 2, 90) * Math.PI) / 180);
  const radial = LABEL_OUTER_R - innerR;

  const byWedge = 0.68 * tangential;
  // The icon is sized off the font, so both are solved together: the run needs
  // `length * ADVANCE * font` for the text plus `ICON_ADVANCE * font` for the
  // icon. Folding the icon in here is what lets a long label shrink to fit
  // instead of being truncated while there is still room to shrink.
  const usable = radial * 0.92;
  const byLength =
    usable / (label.length * AVG_ADVANCE + (hasIcon ? ICON_ADVANCE : 0));
  const fontSize = Math.max(MIN_FONT, Math.min(MAX_FONT, byWedge, byLength));

  const iconSize = hasIcon ? fontSize * ICON_SCALE : 0;
  const available = usable - (hasIcon ? fontSize * ICON_ADVANCE : 0);
  // The epsilon keeps a label that fits exactly from losing its last character
  // to float error — `byLength` above solves for precisely this width.
  const maxChars = Math.max(
    1,
    Math.floor(available / (fontSize * AVG_ADVANCE) + 1e-6),
  );

  return {
    text: label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label,
    fontSize,
    iconSize,
    iconDistance: LABEL_OUTER_R,
    textDistance: LABEL_OUTER_R - (hasIcon ? fontSize * ICON_ADVANCE : 0),
  };
};

/** The SVG wheel shared by the roulette and the Field of Miracles drum. */
const Wheel = ({
  sectors,
  rotation,
  size = 320,
  spinDurationMs,
  easing = "cubic-bezier(0.18, 0.88, 0.18, 1)",
  winnerIndex = null,
  showLabels = true,
  hub = false,
  hubColor = token.primary,
  rim = false,
  rimColor,
  pointerColor = token.text,
  spinRef,
  ariaLabel,
  className,
}: WheelProps) => {
  const weights = sectors.map((sector) => sector.weight ?? 1);
  const boundaries = weights.some((weight) => weight !== 1)
    ? weightBoundaries(weights)
    : equalBoundaries(sectors.length);

  const innerR = hub ? HUB_R + 2 : 6;
  const withLabels = showLabels && sectors.length <= MAX_LABELLED_SECTORS;

  const spinStyle: CSSProperties = {
    transform: `rotate(${-rotation}deg)`,
    transformOrigin: `${CENTRE}px ${CENTRE}px`,
    transition: spinDurationMs
      ? `transform ${spinDurationMs}ms ${easing}`
      : "none",
  };

  return (
    <div
      className={className}
      style={{ width: toLength(size), maxWidth: "100%", aspectRatio: "1 / 1" }}
    >
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          filter: shadow.wheel,
        }}
        role="img"
        aria-label={ariaLabel ?? "Колесо"}
      >
        {sectors.length === 0 ? (
          <circle
            cx={CENTRE}
            cy={CENTRE}
            r={SECTOR_R}
            fill={token.surfaceMuted}
          />
        ) : (
          <g ref={spinRef} style={spinStyle}>
            {sectors.map((sector, index) => {
              const start = boundaries[index];
              const end = boundaries[index + 1];
              const path = sectorPath(CENTRE, CENTRE, SECTOR_R, start, end);
              if (!path) {
                return null;
              }

              const mid = (start + end) / 2;
              const plan = withLabels
                ? planLabel(sector.label, Boolean(sector.icon), start, end, innerR)
                : null;
              // A CSS variable cannot be measured by the JS luminance helper.
              // Neutral themed wedges always use the theme's own foreground;
              // authored game colours use a fixed black/white contrast ink.
              const ink = sector.color === token.surface
                ? token.text
                : rawInk[readableInk(sector.color)];
              // Flip the labels on the screen's left half so none of them read
              // upside down. Decided against `rotation`, which changes only
              // twice a spin, so the flip lands while the wheel is a blur and
              // never snaps in front of the eye.
              const flipped = normalizeDegrees(mid - rotation) > 180;
              const Icon = sector.icon;

              return (
                <g key={sector.id ?? `${sector.label}-${index}`}>
                  <path
                    d={path}
                    fill={sector.color}
                    stroke={token.surface}
                    strokeWidth={0.4}
                  />

                  {plan && sectors.length === 1 && (
                    <text
                      x={CENTRE}
                      y={CENTRE}
                      textAnchor="middle"
                      dy="0.35em"
                      fill={ink}
                      fontFamily={font.body}
                      fontSize={SOLO_FONT}
                      fontWeight={700}
                    >
                      {sector.label}
                    </text>
                  )}

                  {plan && sectors.length > 1 && (
                    /* Local +x points outward once rotated, so the label sits
                       at the rim and runs inward. A flipped sector turns the
                       other way and anchors on the opposite side, which lands
                       it on the same wedge the right way up. */
                    <g
                      transform={`rotate(${flipped ? mid + 90 : mid - 90} ${CENTRE} ${CENTRE})`}
                    >
                      {Icon && (
                        <Icon
                          size={plan.iconSize}
                          x={
                            flipped
                              ? CENTRE - plan.iconDistance
                              : CENTRE + plan.iconDistance - plan.iconSize
                          }
                          y={CENTRE - plan.iconSize / 2}
                          fill={ink}
                        />
                      )}
                      <text
                        x={
                          flipped
                            ? CENTRE - plan.textDistance
                            : CENTRE + plan.textDistance
                        }
                        y={CENTRE}
                        textAnchor={flipped ? "start" : "end"}
                        dy="0.35em"
                        fill={ink}
                        fontFamily={font.body}
                        fontSize={plan.fontSize}
                        fontWeight={700}
                      >
                        {plan.text}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {winnerIndex !== null &&
              winnerIndex >= 0 &&
              winnerIndex < sectors.length && (
                <path
                  d={sectorPath(
                    CENTRE,
                    CENTRE,
                    SECTOR_R,
                    boundaries[winnerIndex],
                    boundaries[winnerIndex + 1],
                  )}
                  fill={token.surface}
                  fillOpacity={0.18}
                  stroke={token.text}
                  strokeWidth={1}
                  strokeLinejoin="round"
                />
              )}
          </g>
        )}

        {/* Everything below sits outside the rotating group: the rim, the hub
            and the pointer must hold still while the sectors turn. */}
        {rim && (
          <circle
            cx={CENTRE}
            cy={CENTRE}
            r={RIM_R}
            fill="none"
            stroke={rimColor ?? hubColor}
            strokeWidth={RIM_WIDTH}
          />
        )}

        {hub && <circle cx={CENTRE} cy={CENTRE} r={HUB_R} fill={hubColor} />}

        <path
          d={POINTER}
          fill={pointerColor}
          stroke={token.surface}
          strokeWidth={1}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export type { WheelSector, WheelProps };
export default Wheel;
