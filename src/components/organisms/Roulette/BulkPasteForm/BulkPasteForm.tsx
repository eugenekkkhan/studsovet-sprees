import { useState } from "react";
import { Button, Notice, Stack, TextArea } from "../../../atoms";
import { parseBulkList } from "../../../../utils/rouletteList";

interface BulkPasteFormProps {
  disabled: boolean;
  onAdd: (items: { title: string; weight: number }[], merge: boolean) => void;
}

/** Paste a list, one name per line, with an optional `×N` count. */
const BulkPasteForm = ({ disabled, onAdd }: BulkPasteFormProps) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const parsed = parseBulkList(draft);

  const submit = (merge: boolean) => {
    onAdd(parsed, merge);
    setDraft("");
    setOpen(false);
  };

  if (!open) {
    return (
      <Button variant="dashed" block disabled={disabled} onClick={() => setOpen(true)}>
        Вставить списком
      </Button>
    );
  }

  return (
    <Stack gap="sm" block>
      <TextArea
        rows={6}
        value={draft}
        placeholder={"Аня\nБоря ×3\nВика х2"}
        onChange={(event) => setDraft(event.target.value)}
      />

      <Notice>
        Одно имя в строке. Чтобы добавить несколько копий, допишите ×3, x3 или х3.
        Распознано: {parsed.length}.
      </Notice>

      <Stack direction="row" gap="sm" wrap>
        <Button disabled={parsed.length === 0} onClick={() => submit(false)}>
          Добавить отдельно
        </Button>
        <Button
          variant="ghost"
          disabled={parsed.length === 0}
          onClick={() => submit(true)}
        >
          Объединить одинаковые
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </Stack>
    </Stack>
  );
};

export type { BulkPasteFormProps };
export default BulkPasteForm;
