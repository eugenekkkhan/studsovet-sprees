import type { HTMLAttributes } from "react";
import { cn } from "cn";
import { spacing, type SpaceValue } from "../../../styles/tokens";

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  maxWidth?: number | string;
  padding?: SpaceValue;
}

/** Centred page column shared by every screen. */
const PageContainer = ({
  maxWidth = 720,
  padding = "xl",
  className,
  style,
  ...rest
}: PageContainerProps) => (
  <div
    className={cn("page-container", className)}
    style={{
      width: "100%",
      maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth,
      margin: "0 auto",
      padding: spacing(padding),
      boxSizing: "border-box",
      ...style,
    }}
    {...rest}
  />
);

export type { PageContainerProps };
export default PageContainer;
