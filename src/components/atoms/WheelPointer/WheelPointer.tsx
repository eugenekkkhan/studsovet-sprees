interface WheelPointerProps {
  /** Half-width of the triangle in px. */
  width?: number;
  height?: number;
  color?: string;
  offset?: number;
}

/** The arrow that marks the winning sector above a wheel. */
const WheelPointer = ({
  width = 15,
  height = 25,
  color = "#333",
  offset = -10,
}: WheelPointerProps) => (
  <span
    className="absolute left-1/2 z-10 size-0 -translate-x-1/2"
    style={{
      top: `${offset}px`,
      borderLeft: `${width}px solid transparent`,
      borderRight: `${width}px solid transparent`,
      borderTop: `${height}px solid ${color}`,
    }}
  />
);

export type { WheelPointerProps };
export default WheelPointer;
