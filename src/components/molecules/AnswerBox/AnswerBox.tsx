import { Stack, Text } from "../../atoms";
import { InnerRadiusContext } from "../../atoms/Card/innerRadius";
import MediaPreview from "../MediaPreview/MediaPreview";
import { answerBoxRadius, type AnswerBoxSize } from "./answerBoxRadius";
import { color as token, radius, spacing } from "../../../styles/tokens";
import type { MediaType } from "../../../types/quiz";

interface AnswerBoxProps {
  answer: string;
  mediaUrl?: string | null;
  mediaType?: MediaType | null;
  size?: AnswerBoxSize;
  /** Картинку ответа можно раскрыть во весь экран. */
  zoomable?: boolean;
}

/** The "ОТВЕТ" card shown on the board, in the admin panel and to the answering captain. */
const AnswerBox = ({
  answer,
  mediaUrl,
  mediaType,
  size = "sm",
  zoomable = false,
}: AnswerBoxProps) => (
  <div
    style={{
      background: token.surface,
      border: `1px solid ${token.primaryBorder}`,
      // Even padding around the media preview's own 12px corner, so the box
      // and the image it holds share one corner centre.
      borderRadius: answerBoxRadius(size),
      padding: spacing(size === "md" ? "md" : "sm"),
    }}
  >
    <InnerRadiusContext.Provider value={radius.md}>
      <Stack gap="2xs">
        <Text size={size === "md" ? "xs" : "xxs"} tone="primaryMuted" weight={600}>
          ОТВЕТ
        </Text>
        <Text
          tone="primaryStrong"
          weight={600}
          style={{ fontSize: size === "md" ? "16px" : "15px" }}
        >
          {answer}
        </Text>
        <MediaPreview
          url={mediaUrl}
          type={mediaType}
          maxHeight={size === "md" ? "min(46vh, 420px)" : "min(38vh, 340px)"}
          zoomable={zoomable}
        />
      </Stack>
    </InnerRadiusContext.Provider>
  </div>
);

export type { AnswerBoxProps };
export default AnswerBox;
