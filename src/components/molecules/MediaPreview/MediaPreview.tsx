import { useCallback, useState } from "react";
import { AudioPlayer, MediaImage, VideoPlayer } from "../../atoms";
import ImageLightbox from "../ImageLightbox/ImageLightbox";
import { withHaptic } from "../../../api/telegram";
import { resolveMediaUrl } from "../../../api/mediaApi";
import type { MediaType } from "../../../types/quiz";

interface MediaPreviewProps {
  url?: string | null;
  type?: MediaType | null;
  maxHeight?: number | string;
  bordered?: boolean;
  /** Картинку можно раскрыть во весь экран и рассмотреть с увеличением. */
  zoomable?: boolean;
  style?: React.CSSProperties;
}

/**
 * Renders an image or an audio player depending on the media type. Uploaded
 * files are stored as `/media/files/…`, so the backend origin is added here —
 * one place for every screen that shows deck media.
 */
const MediaPreview = ({
  url,
  type,
  maxHeight = 200,
  bordered = false,
  zoomable = false,
  style,
}: MediaPreviewProps) => {
  const [opened, setOpened] = useState(false);
  const close = useCallback(() => setOpened(false), []);
  const src = resolveMediaUrl(url);
  if (!src || !type) {
    return null;
  }

  if (type === "image") {
    const image = (
      <MediaImage src={src} maxHeight={maxHeight} bordered={bordered} style={style} />
    );
    if (!zoomable) return image;

    return (
      <>
        <button
          type="button"
          aria-label="Открыть изображение во весь экран"
          onClick={withHaptic("tap", () => setOpened(true))}
          className="block w-full cursor-zoom-in appearance-none border-0 bg-transparent p-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {image}
        </button>
        {opened && <ImageLightbox src={src} onClose={close} />}
      </>
    );
  }

  return type === "audio" ? (
    <AudioPlayer src={src} style={style} />
  ) : (
    <VideoPlayer
      src={src}
      maxHeight={maxHeight}
      bordered={bordered}
      style={style}
    />
  );
};

export type { MediaPreviewProps };
export default MediaPreview;
