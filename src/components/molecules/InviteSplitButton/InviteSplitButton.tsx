import { IoOpenOutline } from "react-icons/io5";
import InviteQrDialog from "../InviteQrDialog/InviteQrDialog";

interface InviteSplitButtonProps {
  url: string;
  label: string;
  title: string;
}

/** Одна ссылка, два действия: QR слева, прямое открытие справа. */
const InviteSplitButton = ({ url, label, title }: InviteSplitButtonProps) => (
  <span className="inline-flex items-stretch overflow-hidden rounded-pill border border-border bg-transparent">
    <span className="inline-flex border-r border-border [&>button]:rounded-none [&>button]:border-0">
      <InviteQrDialog compact url={url} title={title} />
    </span>
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-(--control-height-sm) items-center justify-center gap-2xs px-sm text-xs font-medium whitespace-nowrap text-neutral no-underline transition-opacity hover:opacity-70"
    >
      {label}
      <IoOpenOutline aria-hidden />
    </a>
  </span>
);

export type { InviteSplitButtonProps };
export default InviteSplitButton;
