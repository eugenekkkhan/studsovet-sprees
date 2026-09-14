import { Card, LoadingSpinner, Stack, Text } from "../../atoms";
import InviteSplitButton from "../InviteSplitButton/InviteSplitButton";

interface GameSessionInviteCardProps {
  sessionCode: string;
  connectionStatus: "connected" | "connecting" | "disconnected";
  connectionError?: string | null;
  connectedText: string;
  hostUrl?: string | null;
  captainUrl?: string | null;
  boardUrl?: string | null;
}

/** Один и тот же блок кода и приглашений для обеих командных игр. */
const GameSessionInviteCard = ({
  sessionCode,
  connectionStatus,
  connectionError,
  connectedText,
  hostUrl,
  captainUrl,
  boardUrl,
}: GameSessionInviteCardProps) => {
  const statusText = connectionStatus === "connected"
    ? connectedText
    : connectionStatus === "connecting"
      ? "Подключаем игровой сервер…"
      : connectionError ?? "Соединение потеряно — переподключаемся…";

  return (
    <Card
      padding={["md", "sm", "sm", "sm"]}
      content="sm"
      tone={connectionStatus === "connected" ? "muted" : "primary"}
    >
      <Stack gap="sm" align="center">
        <div className="flex w-full flex-col items-center justify-center gap-xs text-center sm:flex-row sm:gap-sm">
          <span className="inline-flex min-w-0 items-center justify-center gap-xs">
            {connectionStatus !== "connected" && <LoadingSpinner size="sm" />}
            <Text
              as="span"
              size="sm"
              weight={600}
              align="center"
              role="status"
              aria-live="polite"
            >
              {statusText}
            </Text>
          </span>
          {sessionCode && (
            <Text
              as="span"
              size="sm"
              weight={700}
              tone="neutral"
              className="block shrink-0 tracking-[0.08em]"
            >
              {sessionCode}
            </Text>
          )}
        </div>

        <Stack direction="row" gap="sm" justify="center" wrap>
          {hostUrl && <InviteSplitButton url={hostUrl} label="Водящий" title={`Пульт ведущего · ${sessionCode}`} />}
          {captainUrl && <InviteSplitButton url={captainUrl} label="Капитаны" title={`Вход капитанов · ${sessionCode}`} />}
          {boardUrl && <InviteSplitButton url={boardUrl} label="Табло" title={`Табло · ${sessionCode}`} />}
        </Stack>
      </Stack>
    </Card>
  );
};

export type { GameSessionInviteCardProps };
export default GameSessionInviteCard;
