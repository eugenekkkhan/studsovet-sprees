import { Separator } from "@/components/ui/separator";

interface DividerProps {
  margin?: string;
}

/** Built on shadcn/ui's (Radix) Separator for proper `role="separator"` semantics. */
const Divider = ({ margin = "0" }: DividerProps) => (
  <Separator className="w-full" style={{ margin }} />
);

export type { DividerProps };
export default Divider;
