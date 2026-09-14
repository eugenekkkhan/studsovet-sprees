import { useState } from "react";
import { Button, Stack, Text } from "../../atoms";
import FilePickerButton from "../FilePickerButton/FilePickerButton";
import MediaPreview from "../MediaPreview/MediaPreview";
import type { Media, MediaType } from "../../../types/quiz";

interface MediaFieldProps {
  label: string;
  value: Media | null;
  onChange: (media: Media | null) => void;
  /** Загружает файл на игровой сервер и отдаёт ссылку для колоды. */
  upload: (file: File) => Promise<{ url: string; type: MediaType }>;
}

/** Медиа к вопросу или ответу: обычный файловый контрол без ручного URL. */
const MediaField = ({ label, value, onChange, upload }: MediaFieldProps) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const handleSelect = async (file: File) => {
    const previewUrl = file.type.startsWith("video/") ? URL.createObjectURL(file) : null;
    setUploading(true);
    setError("");
    setUploadPreview(previewUrl);
    try {
      const media = await upload(file);
      onChange({ url: media.url, type: media.type });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить файл.");
    }
    setUploadPreview(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setUploading(false);
  };

  return (
    <Stack gap="2xs">
      <Stack direction="row" gap="xs" align="center" justify="between" wrap>
        <Text size="sm" weight={600}>
          {label}
        </Text>
        <FilePickerButton
          accept="image/*,audio/*,video/mp4,video/webm,video/quicktime,video/ogg"
          disabled={uploading}
          loading={uploading}
          onSelect={(file) => void handleSelect(file)}
        >
          {uploading ? "Загрузка…" : value ? "Заменить файл" : "Выбрать файл"}
        </FilePickerButton>
        {value && (
          <Button variant="danger" onClick={() => onChange(null)}>
            Удалить файл
          </Button>
        )}
      </Stack>

      {!value && !uploading && (
        <Text size="xs" tone="muted">
          Картинка, аудио или видео (MP4, WebM, MOV) до 64 МБ
        </Text>
      )}

      {error && (
        <Text size="xs" tone="danger">
          {error}
        </Text>
      )}

      {uploadPreview && (
        <MediaPreview
          url={uploadPreview}
          type="video"
          maxHeight="min(46dvh, 440px)"
          bordered
          style={{ width: "100%" }}
        />
      )}

      {value && !uploadPreview && (
        <MediaPreview
          url={value.url}
          type={value.type}
          maxHeight={value.type === "video" ? "min(34dvh, 320px)" : 90}
          bordered
          style={value.type === "video" ? { width: "100%" } : undefined}
        />
      )}
    </Stack>
  );
};

export type { MediaFieldProps };
export default MediaField;
