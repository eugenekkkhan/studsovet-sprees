import { cn } from "cn";

interface StatusDotProps {
  ok: boolean;
  title?: string;
  className?: string;
}

/** Connection indicator. */
const StatusDot = ({ ok, title, className }: StatusDotProps) => (
  <span
    title={title}
    className={cn("text-[18px] leading-none", ok ? "text-success" : "text-danger", className)}
  >
    ●
  </span>
);

export type { StatusDotProps };
export default StatusDot;
