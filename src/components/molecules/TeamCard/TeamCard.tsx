import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "cn";
import { Card, Stack, Text } from "../../atoms";
import {
  font,
  type ContentRadius,
  type SpaceValue,
} from "../../../styles/tokens";
import { ensureContrast } from "../../../utils/color";
import { useSurfaceBackdrop } from "../../../hooks/useSurfaceBackdrop";

type TeamCardSize = "sm" | "md" | "lg";

interface SizeSpec {
  padding: SpaceValue;
  content: ContentRadius;
  minWidth: string;
  name: string;
  score: string;
}

// Three sizes, one card: the scoreboard strip, the host's own console and the
// hall screen. Each keeps a control size in its corners, which is what the
// card's own radius is then built from.
const SIZES: Record<TeamCardSize, SizeSpec> = {
  sm: {
    padding: "sm",
    content: "sm",
    minWidth: "150px",
    name: "text-sm",
    score: "24px",
  },
  md: {
    padding: "md",
    content: "md",
    minWidth: "180px",
    name: "text-base",
    score: "30px",
  },
  lg: {
    padding: "md",
    content: "md",
    minWidth: "180px",
    name: "text-[clamp(15px,1.5vw,24px)]",
    score: "clamp(26px, 2.4vw, 40px)",
  },
};

// Team colours are chosen for the wheel, not for type, so the score is moved
// until it clears 4.5:1 against the card it is printed on — светлую тему
// затемняем, тёмную тему Telegram, наоборот, осветляем.

interface TeamCardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "color" | "children"> {
  name: string;
  color: string;
  score: number;
  size?: TeamCardSize;
  /** Show the sign on positive scores — «Своя игра» goes negative. */
  signed?: boolean;
  /** Status pills: «Выбирает», «Отвечает», «Ходит». */
  badges?: ReactNode;
  /** Muted line under the score — «+40 в раунде». */
  note?: ReactNode;
  /** Captain presence. Left out entirely where nobody joins by key. */
  online?: boolean;
  /** Marks the captain's own team on their phone. */
  own?: boolean;
  /** Out of play: locked in on this question, or already drawn. */
  dimmed?: boolean;
  /** Ring in the team's colour — answering, or holding the turn. */
  highlighted?: boolean;
  /** Controls under the score: invite key, editing, per-game actions. */
  children?: ReactNode;
}

/**
 * Сидит ли за командой капитан. Пока этого не было видно, ведущий узнавал
 * о неподключённой команде только когда доходила её очередь ходить.
 */
const PresenceDot = ({ online }: { online: boolean }) => (
  <span
    className="absolute top-md right-md z-10 inline-flex items-center"
    title={online ? "Капитан на связи" : "Капитан не подключён"}
  >
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 rounded-pill",
        online ? "bg-success" : "bg-neutral opacity-40",
      )}
    />
    <span className="sr-only">
      {online ? "Капитан на связи" : "Капитан не подключён"}
    </span>
  </span>
);

/**
 * The one team card in the app: name, score, status. Every game hangs its own
 * controls under it through `children` instead of drawing a card of its own.
 */
const TeamCard = ({
  name,
  color,
  score,
  size = "sm",
  signed = false,
  badges,
  note,
  online,
  own = false,
  dimmed = false,
  highlighted = false,
  children,
  className,
  ...rest
}: TeamCardProps) => {
  const spec = SIZES[size];
  const backdrop = useSurfaceBackdrop();

  return (
    <Card
      borderColor={color}
      padding={spec.padding}
      content={spec.content}
      className={cn("relative flex", className)}
      style={{
        // Highlighting thickens the border rather than adding a ring around
        // it: a same-colour box-shadow is a second shape, and where the two
        // meet on the corner arc both edges are antialiased and composite —
        // the corner then reads heavier than the straight sides.
        borderWidth: highlighted ? "4px" : "2px",
        minWidth: spec.minWidth,
        opacity: dimmed ? 0.55 : 1,
        background: own ? "var(--color-surface-tint)" : undefined,
      }}
      {...rest}
    >
      {online !== undefined && <PresenceDot online={online} />}

      <Stack gap="2xs" align="center" className="w-full">
        <Text
          weight={600}
          align="center"
          className={cn("max-w-full truncate", spec.name)}
          title={name}
        >
          {name}
          {own ? " · вы" : ""}
        </Text>

        <div
          style={{
            fontFamily: font.display,
            fontSize: spec.score,
            fontWeight: 700,
            lineHeight: 1.1,
            color:
              score < 0
                ? "var(--color-danger)"
                : ensureContrast(color, backdrop),
          }}
        >
          {signed && score > 0 ? `+${score}` : score}
        </div>

        {badges !== undefined && (
          <Stack
            direction="row"
            gap="2xs"
            wrap
            justify="center"
            className="min-h-7 items-center"
          >
            {badges}
          </Stack>
        )}

        {note !== undefined && (
          <Text as="p" size="xs" tone="muted" align="center">
            {note}
          </Text>
        )}

        {children && <div className="mt-2xs w-full">{children}</div>}
      </Stack>
    </Card>
  );
};

export type { TeamCardProps, TeamCardSize };
export default TeamCard;
