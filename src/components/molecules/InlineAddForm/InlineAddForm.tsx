import { Button, Input, Stack } from "../../atoms";
import type { ButtonSize } from "../../atoms";

interface InlineAddFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  disabled?: boolean;
  size?: ButtonSize;
  autoFocus?: boolean;
}

/** One-line "type a name, press add" form used for rounds, categories and entities. */
const InlineAddForm = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  submitLabel = "Добавить",
  cancelLabel = "Отмена",
  onCancel,
  disabled = false,
  size = "md",
  autoFocus = false,
}: InlineAddFormProps) => {
  const canSubmit = value.trim().length > 0 && !disabled;

  return (
    <Stack direction="row" gap="sm" block>
      <Input
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && canSubmit) {
            onSubmit();
          }
        }}
      />
      <Button size={size} onClick={onSubmit} disabled={!canSubmit}>
        {submitLabel}
      </Button>
      {onCancel && (
        <Button size={size} variant="neutral" onClick={onCancel}>
          {cancelLabel}
        </Button>
      )}
    </Stack>
  );
};

export type { InlineAddFormProps };
export default InlineAddForm;
