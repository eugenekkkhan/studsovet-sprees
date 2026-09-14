import { useEffect, useState } from "react";
import { Badge, Button, Card, Heading, Input, Notice, Stack, Text } from "../../../atoms";
import { useQuizGame } from "../../../../hooks/useQuizGame";

/** Торги за аукционный вопрос: ставку подаёт команда, чья очередь. */
const HostBiddingPanel = () => {
  const { game, send } = useQuizGame();
  const bidding = game.bidding;
  const [amount, setAmount] = useState("");

  const turnTeam = game.teams.find((team) => team.id === bidding?.turnTeamId) ?? null;

  useEffect(() => {
    if (!bidding) return;
    const step = game.settings.bidStep;
    const next = Math.ceil((bidding.highestBid + 1) / step) * step;
    setAmount(String(next));
  }, [bidding, bidding?.highestBid, bidding?.turnTeamId, game.settings.bidStep]);

  if (!bidding) return null;

  const teamName = (teamId: string | null) =>
    game.teams.find((team) => team.id === teamId)?.name ?? "—";
  const parsed = Number(amount);
  const canBid =
    turnTeam !== null &&
    Number.isFinite(parsed) &&
    parsed > bidding.highestBid &&
    parsed <= turnTeam.score &&
    (!bidding.allIn || parsed >= turnTeam.score) &&
    (parsed >= turnTeam.score || parsed % game.settings.bidStep === 0);

  return (
    <Card padding="lg" tone="primary">
      <Stack gap="md">
        <Stack direction="row" gap="sm" align="center" wrap>
          <Heading level={2} size={22}>
            Аукцион
          </Heading>
          <Badge tone="neutral">номинал {bidding.nominal}</Badge>
          <Badge tone={bidding.allIn ? "danger" : "primary"}>
            {bidding.allIn ? "Ва-банк" : "Ставка"} {bidding.highestBid} ·{" "}
            {teamName(bidding.highestTeamId)}
          </Badge>
        </Stack>

        <Text as="p" size="sm" tone="muted">
          Открывшая клетку команда пасовать не может — за ней уже стоит номинал.
          Ва-банк перебивается только бо́льшим ва-банком.
        </Text>

        {turnTeam ? (
          <Stack gap="sm">
            <Notice tone="info">
              Слово команде «{turnTeam.name}» — на счету {turnTeam.score}.
            </Notice>
            <Stack direction="row" gap="sm" align="center" wrap>
              <Input
                type="number"
                inputMode="numeric"
                step={game.settings.bidStep}
                value={amount}
                aria-label="Сумма ставки"
                className="max-w-[160px]"
                onChange={(event) => setAmount(event.target.value)}
              />
              <Button
                disabled={!canBid}
                onClick={() =>
                  send({
                    type: "PLACE_BID",
                    teamId: turnTeam.id,
                    action: "bid",
                    amount: parsed,
                  })
                }
              >
                Ставка
              </Button>
              <Button
                variant="danger"
                disabled={turnTeam.score <= bidding.highestBid}
                onClick={() =>
                  send({
                    type: "PLACE_BID",
                    teamId: turnTeam.id,
                    action: "all-in",
                    amount: turnTeam.score,
                  })
                }
              >
                Ва-банк ({turnTeam.score})
              </Button>
              <Button
                variant="neutral"
                onClick={() =>
                  send({
                    type: "PLACE_BID",
                    teamId: turnTeam.id,
                    action: "pass",
                    amount: 0,
                  })
                }
              >
                Пас
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Notice tone="warning">Ждём завершения торгов…</Notice>
        )}

        {bidding.passedTeamIds.length > 0 && (
          <Text size="sm" tone="muted">
            Пас: {bidding.passedTeamIds.map((id) => `«${teamName(id)}»`).join(", ")}
          </Text>
        )}
      </Stack>
    </Card>
  );
};

export default HostBiddingPanel;
