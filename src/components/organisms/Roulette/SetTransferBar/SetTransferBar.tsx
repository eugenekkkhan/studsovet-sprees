import { useState } from "react";
import { Button, Notice, Stack } from "../../../atoms";
import { FilePickerButton } from "../../../molecules";
import { showToast } from "../../../../utils/toast";
import {
  MAX_SHARE_URL_LENGTH,
  buildShareUrl,
  parseTransferSet,
  toTransferSet,
  type ListItem,
} from "../../../../utils/rouletteList";

interface SetTransferBarProps {
  items: ListItem[];
  disabled: boolean;
  onReplace: (items: ListItem[]) => void;
  onMerge: (items: ListItem[]) => void;
}

/** Export the set as JSON, import one back, or hand it over as a link. */
const SetTransferBar = ({
  items,
  disabled,
  onReplace,
  onMerge,
}: SetTransferBarProps) => {
  const [pending, setPending] = useState<ListItem[] | null>(null);

  const shareUrl = buildShareUrl(
    items,
    window.location.origin,
    window.location.pathname,
  );
  const shareable = items.length > 0 && shareUrl.length <= MAX_SHARE_URL_LENGTH;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(toTransferSet(items), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "wheel-set.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    const parsed = parseTransferSet(await file.text());
    if (!parsed?.length) {
      showToast.error("Не удалось прочитать файл");
      return;
    }
    setPending(parsed);
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast.success("Ссылка скопирована");
    } catch {
      showToast.error("Не удалось скопировать ссылку");
    }
  };

  return (
    <Stack gap="sm" block align="flex-start">
      <Stack direction="row" gap="sm" wrap>
        <Button
          variant="ghost"
          disabled={disabled || items.length === 0}
          onClick={exportJson}
        >
          Выгрузить JSON
        </Button>

        <FilePickerButton
          accept=".json,application/json"
          disabled={disabled}
          onSelect={importJson}
        >
          Загрузить JSON
        </FilePickerButton>

        <Button variant="ghost" disabled={disabled || !shareable} onClick={share}>
          {shareable ? "Скопировать ссылку" : "Ссылка: список велик"}
        </Button>
      </Stack>

      {items.length > 0 && !shareable && (
        <Notice>
          Список слишком длинный для ссылки — выгрузите его файлом.
        </Notice>
      )}

      {pending && (
        <Notice>
          <Stack gap="sm">
            <span>Загружено {pending.length} записей. Что с ними сделать?</span>
            <Stack direction="row" gap="sm" wrap>
              <Button
                onClick={() => {
                  onReplace(pending);
                  setPending(null);
                }}
              >
                Заменить список
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  onMerge(pending);
                  setPending(null);
                }}
              >
                Добавить к текущему
              </Button>
              <Button variant="ghost" onClick={() => setPending(null)}>
                Отмена
              </Button>
            </Stack>
          </Stack>
        </Notice>
      )}
    </Stack>
  );
};

export type { SetTransferBarProps };
export default SetTransferBar;
