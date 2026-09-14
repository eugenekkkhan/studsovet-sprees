import { useId, useMemo, useRef } from "react";
import { IoCloseOutline, IoQrCodeOutline } from "react-icons/io5";
import { QRCodeSVG } from "qrcode.react";
import {
  Button,
  Card,
  Heading,
  IconButton,
  Notice,
  Stack,
  Text,
} from "../../atoms";
import { cardRadius } from "../../../styles/tokens";
import { showToast } from "../../../utils/toast";

interface InviteQrDialogProps {
  url: string;
  title: string;
  compact?: boolean;
  triggerLabel?: string;
}

const InviteQrDialog = ({
  url,
  title,
  compact = false,
  triggerLabel = "QR-код",
}: InviteQrDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const isLocalhost = useMemo(() => {
    try {
      return ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);
    } catch {
      return false;
    }
  }, [url]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast.success("Ссылка скопирована.");
    } catch {
      window.prompt("Скопируйте ссылку", url);
    }
  };

  return (
    <>
      {compact ? (
        <IconButton
          size="sm"
          label={`Показать QR-код: ${title}`}
          onClick={() => dialogRef.current?.showModal()}
        >
          <IoQrCodeOutline aria-hidden />
        </IconButton>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => dialogRef.current?.showModal()}
        >
          <IoQrCodeOutline aria-hidden />
          {triggerLabel}
        </Button>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[min(92vw,400px)] max-w-none border-0 bg-transparent p-0 backdrop:bg-black/45"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <Card padding="lg" content="md" className="shadow-xl">
          <Stack gap="md" align="center" className="w-full min-w-0">
            <div className="grid min-h-10 w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-xs">
              <span aria-hidden />
              <Heading
                id={titleId}
                level={2}
                align="center"
                className="min-w-0 break-words leading-tight"
                style={{ fontSize: "clamp(14px, 4.2vw, 18px)" }}
              >
                {title}
              </Heading>
              <IconButton
                label="Закрыть QR-код"
                className="shrink-0"
                onClick={() => dialogRef.current?.close()}
              >
                <IoCloseOutline aria-hidden />
              </IconButton>
            </div>

            <div
              className="box-border w-full max-w-[296px] bg-white p-sm"
              // A QR code has square corners, so the plate's radius is its
              // padding and nothing more.
              style={{ borderRadius: cardRadius("sm", "0px") }}
            >
              <QRCodeSVG
                value={url}
                title={title}
                size={272}
                level="Q"
                bgColor="#ffffff"
                fgColor="#081520"
                style={{ display: "block", width: "100%", height: "auto" }}
              />
            </div>

            {isLocalhost && (
              <Notice tone="warning" size="sm">
                Телефон не откроет localhost компьютера. Откройте страницу
                ведущего по Network-адресу Vite или задайте VITE_PUBLIC_URL.
              </Notice>
            )}

            <Text
              as="p"
              size="xs"
              tone="muted"
              align="center"
              className="w-full break-all select-all"
            >
              {url}
            </Text>
            <Button block className="max-w-full" onClick={() => void copyLink()}>
              Скопировать ссылку
            </Button>
          </Stack>
        </Card>
      </dialog>
    </>
  );
};

export type { InviteQrDialogProps };
export default InviteQrDialog;
