import { useState } from "react";
import { Button, Stack, Text } from "../../atoms";
import FilePickerButton from "../FilePickerButton/FilePickerButton";
import MediaPreview from "../MediaPreview/MediaPreview";
import type { MediaType } from "../../../types/quiz";

interface MediaUploaderProps {
  url: string | null;
  type: MediaType | null;
  /** Uploads the file and resolves with the stored media descriptor. */
  upload: (file: File) => Promise<{ url: string; type: MediaType }>;
  onChange: (url: string, type: MediaType) => void;
  onRemove: () => void;
}

/** Upload-or-preview control for a single image, audio or video attachment. */
const MediaUploader = ({
  url,
  type,
  upload,
  onChange,
  onRemove,
}: MediaUploaderProps) => {
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
      onChange(media.url, media.type);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка загрузки");
    }
    setUploadPreview(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setUploading(false);
  };

  if (uploadPreview) {
    return (
      <Stack gap="sm">
        <MediaPreview
          url={uploadPreview}
          type="video"
          maxHeight="min(46dvh, 440px)"
          bordered
          style={{ width: "100%" }}
        />
        <Text size="xs" tone="muted" align="center">
          Видео загружается…
        </Text>
      </Stack>
    );
  }

  if (url && type) {
    return (
      <Stack gap="sm">
        <MediaPreview
          url={url}
          type={type}
          maxHeight={type === "video" ? "min(34dvh, 320px)" : 100}
          bordered
          style={type === "video" ? { width: "100%" } : undefined}
        />
        <Button variant="danger" size="sm" onClick={onRemove}>
          Удалить медиа
        </Button>
      </Stack>
    );
  }

  return (
    <Stack direction="row" gap="sm" align="center">
      <FilePickerButton
        accept="image/*,audio/*,video/mp4,video/webm,video/quicktime,video/ogg"
        disabled={uploading}
        loading={uploading}
        onSelect={handleSelect}
      >
        {uploading ? "Загрузка..." : "+ Фото / звук / видео"}
      </FilePickerButton>
      {error && (
        <Text size="xs" tone="danger">
          {error}
        </Text>
      )}
    </Stack>
  );
};

export type { MediaUploaderProps };
export default MediaUploader;
