import type { TextareaHTMLAttributes } from "react";
import { cn } from "cn";
import { Textarea as BaseTextarea } from "@/components/ui/textarea";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Input's textarea flavour, built on shadcn/ui's Textarea. It grows, so it
 * cannot be a pill; it borrows the md control radius instead and so sits on
 * the same corner as the fields around it. */
const TextArea = ({ className, rows = 2, ...rest }: TextAreaProps) => (
  <BaseTextarea
    rows={rows}
    // See Input: a placeholder is a weak name, but it beats none at all.
    aria-label={
      rest["aria-label"] ??
      (rest["aria-labelledby"] ? undefined : rest.placeholder)
    }
    className={cn(
      "field-sizing-fixed min-h-(--control-height-md) resize-y rounded-control-md border-[1.5px] border-border bg-surface px-md py-xs text-sm leading-[1.45] shadow-none disabled:bg-surface-muted",
      className,
    )}
    {...rest}
  />
);

export type { TextAreaProps };
export default TextArea;
