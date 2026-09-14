import { useEffect, useId, useRef, useState } from "react";
import { IoCloseOutline, IoLinkOutline } from "react-icons/io5";
import { QRCodeSVG } from "qrcode.react";
import {
  issueDeckShare,
  revokeDeckShare,
  setDeckShareOptions,
} from "../../../../api/decksApi";
import { publicUrl } from "../../../../api/backendUrl";
import {
  Badge,
  Button,
  Card,
  Divider,
  Heading,
  IconButton,
  Notice,
  Stack,
  Text,
} from "../../../atoms";
import { cardRadius } from "../../../../styles/tokens";
import { showToast } from "../../../../utils/toast";

interface DeckShareDialogProps {
  deckId: string;
  deckName: string;
  active: boolean;
  allowCopy: boolean;
  views: number;
  copies: number;
  lastViewedAt?: number | null;
  onChanged: () => void;
}

/**
 * Сервер хранит только хеш кода, поэтому показать выданную ссылку второй раз
 * он не может. Код запоминает браузер автора — на своём устройстве ссылка
 * остаётся под рукой, а утечка базы всё так же не открывает ни одной колоды.
 */
const codeKey = (deckId: string) => `quizDeckShareCode:${deckId}`;

const rememberCode = (deckId: string, code: string | null) => {
  try {
    if (code) localStorage.setItem(codeKey(deckId), code);
    else localStorage.removeItem(codeKey(deckId));
  } catch {
    // Приватный режим: ссылка проживёт до закрытия окна, и ладно.
  }
};

const recallCode = (deckId: string) => {
  try {
    return localStorage.getItem(codeKey(deckId)) ?? "";
  } catch {
    return "";
  }
};

const shareUrl = (code: string) =>
  `${publicUrl}/quiz/decks/access/${encodeURIComponent(code)}`;

const formatDate = (value: number) =>
  new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Доступ к колоде по секретной ссылке: выдача, смена кода и отзыв. */
const DeckShareDialog = ({
  deckId,
  deckName,
  active,
  allowCopy,
  views,
  copies,
  lastViewedAt,
  onChanged,
}: DeckShareDialogProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [code, setCode] = useState(() => recallCode(deckId));
  const [busy, setBusy] = useState(false);
  // Свежий код появляется раньше, чем библиотека успевает перечитаться с
  // сервера. Без этой отметки эффект ниже стёр бы только что выданную ссылку,
  // приняв ещё не обновившийся `active` за отзыв доступа.
  const justIssued = useRef(false);

  // Доступ могли отозвать со второго устройства — тогда местный код мёртв.
  useEffect(() => {
    if (active || justIssued.current || !code) return;
    rememberCode(deckId, null);
    setCode("");
  }, [active, code, deckId]);

  const issue = async () => {
    setBusy(true);
    try {
      const result = await issueDeckShare(deckId, allowCopy);
      justIssued.current = true;
      rememberCode(deckId, result.code);
      setCode(result.code);
      onChanged();
      showToast.success(
        active ? "Код сменён — старые ссылки больше не работают." : "Ссылка доступа создана.",
      );
    } catch {
      showToast.error("Не удалось выдать ссылку доступа.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!window.confirm(`Отключить доступ к колоде «${deckName}»?`)) return;
    setBusy(true);
    try {
      await revokeDeckShare(deckId);
      justIssued.current = false;
      rememberCode(deckId, null);
      setCode("");
      onChanged();
      showToast.success("Доступ по ссылке отключён.");
    } catch {
      showToast.error("Не удалось отключить доступ.");
    } finally {
      setBusy(false);
    }
  };

  const toggleCopying = async (next: boolean) => {
    setBusy(true);
    try {
      await setDeckShareOptions(deckId, next);
      onChanged();
      showToast.success(
        next ? "Копирование разрешено." : "Копирование запрещено: только просмотр.",
      );
    } catch {
      showToast.error("Не удалось изменить разрешение.");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    const url = shareUrl(code);
    try {
      await navigator.clipboard.writeText(url);
      showToast.success("Ссылка скопирована.");
    } catch {
      window.prompt("Скопируйте ссылку", url);
    }
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => dialog.current?.showModal()}>
        <IoLinkOutline aria-hidden />
        Доступ по ссылке
      </Button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[min(92vw,420px)] max-w-none border-0 bg-transparent p-0 backdrop:bg-black/45"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <Card padding="lg" content="md" className="shadow-xl">
          <Stack gap="md" align="center" className="w-full min-w-0">
            <div className="grid min-h-10 w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-xs">
              <span aria-hidden />
              <Heading id={titleId} level={2} align="center" className="min-w-0 break-words">
                Доступ по ссылке
              </Heading>
              <IconButton
                label="Закрыть"
                className="shrink-0"
                onClick={() => dialog.current?.close()}
              >
                <IoCloseOutline aria-hidden />
              </IconButton>
            </div>

            <Stack gap="2xs" align="center" className="w-full">
              <Text weight={600} align="center" className="break-words">
                {deckName}
              </Text>
              <Badge tone={active ? "success" : "neutral"}>
                {active ? "доступ открыт" : "доступ закрыт"}
              </Badge>
            </Stack>

            <Text as="p" size="sm" tone="muted" align="center">
              Открытий: {views} · копий: {copies}
              {lastViewedAt ? ` · последнее ${formatDate(lastViewedAt)}` : ""}
            </Text>

            <label className="flex w-full cursor-pointer items-center justify-center gap-xs text-sm">
              <input
                type="checkbox"
                checked={allowCopy}
                disabled={busy}
                onChange={(event) => void toggleCopying(event.target.checked)}
              />
              Разрешить забрать копию себе
            </label>

            {code && (
              <>
                <div
                  className="box-border w-full max-w-[264px] bg-white p-sm"
                  style={{ borderRadius: cardRadius("sm", "0px") }}
                >
                  <QRCodeSVG
                    value={shareUrl(code)}
                    title={`Доступ к колоде «${deckName}»`}
                    size={240}
                    level="Q"
                    bgColor="#ffffff"
                    fgColor="#081520"
                    style={{ display: "block", width: "100%", height: "auto" }}
                  />
                </div>
                <Text
                  as="p"
                  size="xs"
                  tone="muted"
                  align="center"
                  className="w-full break-all select-all"
                >
                  {shareUrl(code)}
                </Text>
                <Button block onClick={() => void copyLink()}>
                  Скопировать ссылку
                </Button>
              </>
            )}

            {active && !code && (
              <Notice tone="info" size="sm">
                Ссылка была выдана на другом устройстве. Сервер хранит только её
                отпечаток и показать её снова не может — смените код, чтобы
                получить новую.
              </Notice>
            )}

            <Divider />

            <Stack gap="xs" className="w-full">
              <Button block loading={busy} onClick={() => void issue()}>
                {active ? "Сменить код" : "Создать ссылку доступа"}
              </Button>
              {active && (
                <Button block variant="danger" disabled={busy} onClick={() => void revoke()}>
                  Отключить доступ
                </Button>
              )}
            </Stack>

            <Text as="p" size="xs" tone="muted" align="center">
              По ссылке колоду можно посмотреть и запустить у себя. Править
              оригинал получатель не сможет.
            </Text>
          </Stack>
        </Card>
      </dialog>
    </>
  );
};

export default DeckShareDialog;
