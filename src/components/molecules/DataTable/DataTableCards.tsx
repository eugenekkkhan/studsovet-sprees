import { useState } from "react";
import { TbChevronDown, TbChevronUp } from "react-icons/tb";
import { Button, Card, Stack, Text } from "../../atoms";
import type { DataTableColumn } from "./DataTable";

interface DataTableCardsProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string | number;
}

/**
 * Таблица на узком экране. Тринадцать колонок в мини-приложении Telegram
 * означали горизонтальную прокрутку внутри вертикальной, а горизонтальный
 * свайп там спорит с жестом закрытия приложения. Поэтому строка становится
 * карточкой: заголовок, короткая сводка и всё остальное под раскрытием.
 *
 * Роли берутся из самих колонок, а без явного указания выводятся из порядка:
 * первая — заголовок, следующие две — сводка, прочие — подробности.
 */
const roleOf = <T,>(column: DataTableColumn<T>, index: number) =>
  column.mobile ?? (index === 0 ? "primary" : index <= 2 ? "summary" : "detail");

const Field = <T,>({ column, row }: { column: DataTableColumn<T>; row: T }) => (
  <Stack direction="row" gap="sm" align="baseline" justify="between" className="min-w-0">
    <Text size="sm" tone="muted" className="shrink-0">{column.label}</Text>
    <span className="min-w-0 text-right text-sm">{column.render(row)}</span>
  </Stack>
);

function RowCard<T>({ row, columns }: { row: T; columns: DataTableColumn<T>[] }) {
  const [open, setOpen] = useState(false);
  const primary = columns.filter((column, index) => roleOf(column, index) === "primary");
  const summary = columns.filter((column, index) => roleOf(column, index) === "summary");
  const details = columns.filter((column, index) => roleOf(column, index) === "detail");

  return (
    <Card padding="sm">
      <Stack gap="xs">
        {primary.map((column) => <div key={column.key} className="min-w-0 font-semibold">{column.render(row)}</div>)}
        {summary.map((column) => <Field key={column.key} column={column} row={row} />)}
        {details.length > 0 && (
          <>
            {open && details.map((column) => <Field key={column.key} column={column} row={row} />)}
            <Button size="sm" variant="ghost" block aria-expanded={open} onClick={() => setOpen((value) => !value)}>
              {open ? <>Свернуть <TbChevronUp aria-hidden /></> : <>Ещё {details.length} <TbChevronDown aria-hidden /></>}
            </Button>
          </>
        )}
      </Stack>
    </Card>
  );
}

export function DataTableCards<T>({ rows, columns, rowKey }: DataTableCardsProps<T>) {
  return (
    <Stack gap="xs" role="list">
      {rows.map((row) => (
        <div key={rowKey(row)} role="listitem">
          <RowCard row={row} columns={columns} />
        </div>
      ))}
    </Stack>
  );
}
