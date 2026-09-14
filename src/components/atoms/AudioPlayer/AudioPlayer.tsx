import type { AudioHTMLAttributes } from "react";
import { cn } from "cn";
import { useInnerRadius } from "../Card/innerRadius";

type AudioPlayerProps = AudioHTMLAttributes<HTMLAudioElement>;

const AudioPlayer = ({ className, style, ...rest }: AudioPlayerProps) => {
  const innerRadius = useInnerRadius();

  return (
    <audio
      controls
      className={cn("w-full", className)}
      style={{ borderRadius: innerRadius, ...style }}
      {...rest}
    />
  );
};

export type { AudioPlayerProps };
export default AudioPlayer;
