import { Card, EmptyState, Stack, Text } from "../../../atoms";
import { cn } from "cn";
import { withHaptic } from "../../../../api/telegram";
import { cardBorderWidth, radius as radiusToken } from "../../../../styles/tokens";

// `clip` cuts the cells to the corner instead of insetting them, so nothing
// here has a corner to stay concentric with and the board's own radius is a
// free choice — the one place in the app that picks a radius outright.
const BOARD_RADIUS = radiusToken.xxl;

// The curve the clip actually cuts by: `overflow` clips at the padding box, so
// it is the card's radius less its border. The corner cells take exactly this
// and nothing else — a hair more and the cell bites deeper than the clip,
// opening a wedge of background; a hair less and it pokes out. They need it at
// all because a cell paints things that follow its own box (the active ring,
// the focus ring), and a square ring in a rounded corner is cut off mid-stroke.
const BOARD_CLIP_RADIUS = `calc(${BOARD_RADIUS} - ${cardBorderWidth})`;
import type { PublicBoard, Team } from "../../../../types/quiz";

interface QuizBoardProps {
  board: PublicBoard | null;
  teams: Team[];
  /** Открытая сейчас клетка подсвечивается на всех экранах. */
  activeQuestionId?: string | null;
  onPick?: (questionId: string) => void;
  disabled?: boolean;
  /** `lg` — размер для проектора. */
  size?: "md" | "lg";
  /** Растянуть табло на всю высоту родителя — режим игрового экрана. */
  fill?: boolean;
  className?: string;
}

const cellBase =
  "flex items-center justify-center border-b border-l border-border font-display font-bold transition-colors";

/** Табло: темы строками, номиналы столбцами. */
const QuizBoard = ({
  board,
  teams,
  activeQuestionId = null,
  onPick,
  disabled = false,
  size = "md",
  fill = false,
  className,
}: QuizBoardProps) => {
  if (!board || board.themes.length === 0) {
    return (
      <Card
        radius={BOARD_RADIUS}
        className={cn(fill && "flex min-h-0 flex-1 items-center justify-center", className)}
      >
        <EmptyState paddingY="xl">Раунд ещё не начат.</EmptyState>
      </Card>
    );
  }

  const columns = Math.max(...board.themes.map((theme) => theme.cells.length));
  const gridTemplateColumns = `minmax(${size === "lg" ? "180px" : "140px"}, 1.4fr) repeat(${columns}, minmax(0, 1fr))`;
  const cellSize =
    size === "lg"
      ? "min-h-[82px] px-xs py-lg text-2xl"
      : "min-h-[58px] px-2xs py-md text-[15px]";
  const minWidth =
    (size === "lg" ? 220 : 160) + columns * (size === "lg" ? 112 : 72);

  return (
    <Card
      clip
      padding="none"
      radius={BOARD_RADIUS}
      className={cn(fill && "flex min-h-0 flex-1 flex-col", className)}
    >
      <div
        className={cn(
          "overflow-x-auto overscroll-x-contain",
          fill && "flex min-h-0 flex-1 flex-col",
        )}
      >
        <div
          role="grid"
          aria-label={`Раунд «${board.roundName}»`}
          style={{ minWidth }}
          className={cn(fill && "flex min-h-0 flex-1 flex-col")}
        >
          {board.themes.map((theme, themeIndex) => {
            const last = themeIndex === board.themes.length - 1;
            return (
              <div
                key={theme.id}
                className={cn("grid", fill && "min-h-0 flex-1")}
                style={{ gridTemplateColumns }}
                role="row"
              >
                <div
                  role="rowheader"
                  title={theme.name || "Без названия"}
                  className={cn(
                    cellBase,
                    "justify-start border-l-0 bg-[#1e40af] px-sm py-md text-left leading-snug tracking-[0.03em] text-white uppercase",
                    size === "lg" ? "text-base" : "text-[13px]",
                    last && "border-b-0",
                  )}
                  style={
                    themeIndex === 0
                      ? { borderTopLeftRadius: BOARD_CLIP_RADIUS }
                      : undefined
                  }
                >
                  <span className="line-clamp-2">{theme.name || "Без названия"}</span>
                </div>

                {Array.from({ length: columns }, (_, index) => {
                  const cell = theme.cells[index];
                  if (!cell) {
                    return (
                      <div
                        key={index}
                        role="gridcell"
                        className={cn(
                          cellBase,
                          cellSize,
                          "bg-surface-muted",
                          last && "border-b-0",
                        )}
                      />
                    );
                  }

                  const winner = teams.find(
                    (team) => team.id === cell.winnerTeamId,
                  );
                  const isActive = activeQuestionId === cell.questionId;
                  const playable = !cell.played && Boolean(onPick) && !disabled;
                  const topRight = themeIndex === 0 && index === columns - 1;

                  return (
                    <button
                      key={cell.questionId}
                      type="button"
                      role="gridcell"
                      disabled={!playable}
                      onClick={withHaptic("tap", () => onPick?.(cell.questionId))}
                      aria-label={`${theme.name}, ${cell.price}${cell.played ? ", сыграно" : ""}`}
                      className={cn(
                        cellBase,
                        cellSize,
                        last && "border-b-0",
                        isActive
                          ? "bg-[#eff6ff] text-[#1e40af] ring-2 ring-inset ring-[#2563eb]"
                          : cell.played
                            ? "bg-surface-muted text-muted-foreground"
                            : "bg-[#2563eb] text-white",
                        playable &&
                          "cursor-pointer hover:bg-[#1e40af] focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-white",
                        !playable && "cursor-default",
                      )}
                      style={{
                        borderTopRightRadius: topRight
                          ? BOARD_CLIP_RADIUS
                          : undefined,
                        color: winner?.color,
                      }}
                    >
                      {winner ? "✓" : cell.played && !isActive ? "—" : cell.price}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <Stack
        direction="row"
        gap="sm"
        justify="space-between"
        wrap
        className={cn("border-t border-border px-md py-xs", fill && "shrink-0")}
      >
        <Text size="sm" tone="muted">
          {board.roundName} · раунд {board.roundIndex + 1} из {board.roundCount}
        </Text>
        <Text size="sm" tone="muted">
          Осталось вопросов: {board.remaining}
        </Text>
      </Stack>
    </Card>
  );
};

export type { QuizBoardProps };
export default QuizBoard;
