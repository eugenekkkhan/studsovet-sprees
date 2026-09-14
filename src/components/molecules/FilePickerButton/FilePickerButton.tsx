import { useRef } from "react";
import { Button } from "../../atoms";

interface FilePickerButtonProps {
  onSelect: (file: File) => void;
  accept?: string;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

/** A dashed button that opens a hidden file input. */
const FilePickerButton = ({
  onSelect,
  accept,
  disabled,
  loading,
  children,
}: FilePickerButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onSelect(file);
          }
          event.target.value = "";
        }}
      />
      <Button
        variant="dashed"
        loading={loading}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        style={{ minWidth: "150px" }}
      >
        {children}
      </Button>
    </>
  );
};

export type { FilePickerButtonProps };
export default FilePickerButton;
