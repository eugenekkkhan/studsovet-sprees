import type { ImgHTMLAttributes } from "react";
import { cn } from "cn";
import { useInnerRadius } from "../Card/innerRadius";

interface MediaImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Число — пиксели, строка — любое CSS-значение (`min(56vh, 520px)`). */
  maxHeight?: number | string;
  bordered?: boolean;
  /**
   * Holds the full box before the image loads, so decoding never pushes the
   * surrounding content around. Turn off for inline icons with fixed dimensions.
   */
  reserve?: boolean;
}

const size = (value: number | string) =>
  typeof value === "number" ? `${value}px` : value;

const MediaImage = ({
  maxHeight = 200,
  bordered = false,
  reserve = true,
  alt = "",
  className,
  style,
  ...rest
}: MediaImageProps) => {
  const innerRadius = useInnerRadius();
  // Фиксированная высота нужна спискам редактора: превью не должны прыгать,
  // пока грузятся. Экранам игры она вредит — картинка вопроса встаёт в
  // коробку своего размера и не оставляет пустых полей сверху и снизу.
  const fluid = typeof maxHeight === "string";

  return (
    <img
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn(
        // Картинка стоит по центру, а не жмётся к левому краю.
        "mx-auto block max-w-full object-contain",
        bordered && "border border-border",
        fluid ? "h-auto w-auto" : reserve && "w-full",
        className,
      )}
      style={{
        maxHeight: size(maxHeight),
        borderRadius: innerRadius,
        ...(!fluid && reserve ? { height: size(maxHeight) } : null),
        ...style,
      }}
      {...rest}
    />
  );
};

export type { MediaImageProps };
export default MediaImage;
