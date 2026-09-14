import { Badge, Button, Stack, Text } from "../../../atoms";
import {
  DECK_IMPORT_EXAMPLE,
  DECK_LIMITS_NOTE,
  DECK_SCHEMA,
  downloadJson,
} from "../../../../utils/quizDeck";
import { showToast } from "../../../../utils/toast";

/** Справка по формату импорта: поля, ограничения и готовый пример. */
const DeckSchemaDoc = () => {
  const copyExample = async () => {
    try {
      await navigator.clipboard.writeText(DECK_IMPORT_EXAMPLE);
      showToast.success("Пример скопирован.");
    } catch {
      window.prompt("Скопируйте пример", DECK_IMPORT_EXAMPLE);
    }
  };

  return (
    <Stack gap="md">
      <Text as="p" size="sm" tone="muted">
        Неизвестные поля игнорируются, отсутствующие заполняются пустыми значениями —
        колоду можно собрать скриптом и дописать в редакторе.
      </Text>

      <div className="scroll-panel overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-xs pr-sm font-semibold">Поле</th>
              <th className="py-xs pr-sm font-semibold">Тип</th>
              <th className="py-xs font-semibold">Смысл</th>
            </tr>
          </thead>
          <tbody>
            {DECK_SCHEMA.map((field) => (
              <tr key={field.path} className="border-b border-border-subtle">
                <td className="py-xs pr-sm align-top font-mono text-[13px]">
                  {field.path}
                  {field.required && (
                    <Badge tone="danger" className="ml-2xs align-middle">
                      обяз.
                    </Badge>
                  )}
                </td>
                <td className="py-xs pr-sm align-top text-muted-foreground">
                  {field.type}
                </td>
                <td className="py-xs align-top">{field.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Stack gap="2xs">
        <Text size="sm" weight={600}>
          Ограничения
        </Text>
        {DECK_LIMITS_NOTE.map((note) => (
          <Text key={note} size="sm" tone="muted">
            · {note}
          </Text>
        ))}
      </Stack>

      <Stack gap="sm">
        <Stack direction="row" gap="sm" align="center" wrap>
          <Text size="sm" weight={600}>
            Пример файла
          </Text>
          <Button size="sm" variant="neutral" onClick={() => void copyExample()}>
            Скопировать
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => downloadJson("deck-example.json", DECK_IMPORT_EXAMPLE)}
          >
            Скачать пример
          </Button>
        </Stack>
        <pre className="ui-surface scroll-panel max-h-[320px] overflow-auto border border-border bg-surface-muted p-md text-left text-[12px] leading-[1.5]">
          {DECK_IMPORT_EXAMPLE}
        </pre>
      </Stack>

      <Text as="p" size="sm" tone="muted">
        В <code>media.url</code> можно указать: внешний адрес (https://…), имя файла —
        тогда приложите сам файл к импорту, base64 (<code>data:image/png;base64,…</code>)
        или <code>/media/files/…</code> — уже загруженный в эту игру файл.
      </Text>
    </Stack>
  );
};

export default DeckSchemaDoc;
