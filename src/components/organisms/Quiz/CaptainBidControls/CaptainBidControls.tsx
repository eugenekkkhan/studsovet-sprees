import { useEffect, useState } from "react";
import { Badge, Button, Card, Input, Stack, Text } from "../../../atoms";
import type { ParticipantCommand, PublicGameState } from "../../../../types/quiz";

interface CaptainBidControlsProps {
  game: PublicGameState;
  teamId: string;
  pending: boolean;
  onCommand: (command: ParticipantCommand) => void;
}

/** Ставка капитана на аукционе — со своего телефона. */
const CaptainBidControls = ({
  game,
  teamId,
  pending,
  onCommand,
}: CaptainBidControlsProps) => {
  const bidding = game.bidding;
  const team = game.teams.find((item) => item.id === teamId);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!bidding) return;
    const step = game.settings.bidStep;
    setAmount(String(Math.ceil((bidding.highestBid + 1) / step) * step));
  }, [bidding, bidding?.highestBid, game.settings.bidStep]);

  if (!bidding || !team) return null;

  const leader = game.teams.find((item) => item.id === bidding.highestTeamId);
  const myTurn = bidding.turnTeamId === teamId;
  const parsed = Number(amount);
  const canBid =
    myTurn &&
    !pending &&
    Number.isFinite(parsed) &&
    parsed > bidding.highestBid &&
    parsed <= team.score &&
    (!bidding.allIn || parsed >= team.score) &&
    (parsed >= team.score || parsed % game.settings.bidStep === 0);

  return (
    <Card padding="md" tone="primary">
      <Stack gap="sm">
        <Stack direction="row" gap="xs" align="center" wrap>
          <Text weight={600}>Аукцион</Text>
          <Badge tone={bidding.allIn ? "danger" : "neutral"}>
            {bidding.highestBid} · «{leader?.name ?? "—"}»
          </Badge>
        </Stack>

        {myTurn ? (
          <Stack gap="sm">
            <Text size="sm">
              Ваше слово. На счету {team.score}
              {bidding.allIn ? " — перебить ва-банк можно только большим ва-банком." : ""}
            </Text>
            <Stack direction="row" gap="xs" wrap>
              <Input
                type="number"
                inputMode="numeric"
                step={game.settings.bidStep}
                value={amount}
                aria-label="Сумма ставки"
                className="max-w-[140px]"
                onChange={(event) => setAmount(event.target.value)}
              />
              <Button
                disabled={!canBid}
                onClick={() =>
                  onCommand({ type: "PLACE_BID", action: "bid", amount: parsed })
                }
              >
                Ставка
              </Button>
            </Stack>
            <Stack direction="row" gap="xs" wrap>
              <Button
                variant="danger"
                disabled={pending || team.score <= bidding.highestBid}
                onClick={() =>
                  onCommand({ type: "PLACE_BID", action: "all-in", amount: team.score })
                }
              >
                Ва-банк ({team.score})
              </Button>
              <Button
                variant="neutral"
                disabled={pending}
                onClick={() =>
                  onCommand({ type: "PLACE_BID", action: "pass", amount: 0 })
                }
              >
                Пас
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Text size="sm" tone="muted">
            {bidding.passedTeamIds.includes(teamId)
              ? "Вы спасовали — ждём остальных."
              : "Ждём ставку другой команды."}
          </Text>
        )}
      </Stack>
    </Card>
  );
};

export type { CaptainBidControlsProps };
export default CaptainBidControls;
