import type { VideoHTMLAttributes } from "react";
import { cn } from "cn";
import { useInnerRadius } from "../Card/innerRadius";

interface VideoPlayerProps extends VideoHTMLAttributes<HTMLVideoElement> {
  maxHeight?: number | string;
  bordered?: boolean;
}

const VideoPlayer = ({ maxHeight = 200, bordered = false, className, style, ...rest }: VideoPlayerProps) => {
  const innerRadius = useInnerRadius();

  return (
    <video
      controls
      playsInline
      preload="metadata"
      className={cn(
        "mx-auto block h-auto max-w-full object-contain",
        bordered && "border border-border",
        className,
      )}
      style={{
        maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
        borderRadius: innerRadius,
        ...style,
      }}
      {...rest}
    >
      Ваш браузер не поддерживает воспроизведение видео.
    </video>
  );
};

export type { VideoPlayerProps };
export default VideoPlayer;
