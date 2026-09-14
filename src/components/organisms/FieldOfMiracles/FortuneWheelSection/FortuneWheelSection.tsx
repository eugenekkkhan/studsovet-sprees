import { useMemo } from "react";
import { Button, MediaImage, Stack, Text } from "../../../atoms";
import { Wheel } from "../../../molecules";
import { haptic } from "../../../../api/telegram";
import { useGameContext } from "../../../../hooks/useGameContext";
import { useAuthoritativeSpin } from "../../../../hooks/useAuthoritativeSpin";
import { useWheelSpin } from "../../../../hooks/useWheelSpin";
import {
  FORTUNE_ACCENT_COLOR,
  FORTUNE_SECTORS,
  isPunishingSector,
} from "../../../../constants/fortuneSectors";
import type { Sector } from "../../../../types/fieldOfMiracles";
import { equalBoundaries } from "../../../../utils/wheel";
import { showToast } from "../../../../utils/toast";

const showSectorToast = (sector: Sector) => {
  const Icon = sector.icon;

  // Wrapped in a function: react-toastify injects `closeToast` into whatever
  // it is handed, and injecting it into a DOM element makes React complain
  // about an unknown attribute.
  showToast.message(() => (
    <Stack direction="row" gap="sm" align="center">
      {sector.image && (
        <MediaImage
          src={sector.image}
          alt={sector.label}
          reserve={false}
          style={{ width: "34px", height: "34px" }}
        />
      )}
      <div>
        <Text as="div" size="xs" tone="inherit" style={{ opacity: 0.9 }}>
          Результат барабана
        </Text>
        <Text as="div" tone="inherit" weight={700}>
          <Stack direction="row" gap="2xs" align="center">
            {Icon && <Icon aria-hidden />}
            {sector.label}
          </Stack>
        </Text>
      </div>
    </Stack>
  ));
};

/** The Field of Miracles drum: spin, announce the sector, pass the turn on. */
const FortuneWheelSection = () => {
  const { game, activeTeam, beginSpin } = useGameContext();
  const boundaries = useMemo(
    () => equalBoundaries(FORTUNE_SECTORS.length),
    [],
  );

  const {
    rotation,
    spinning,
    winnerIndex,
    effectiveDurationMs,
    easing,
    spinRef,
    spinToAngle,
    snapToAngle,
    reset,
  } =
    useWheelSpin({
      boundaries,
      durationMs: game.spin?.durationMs,
      onSettle: (index) => {
        const sector = FORTUNE_SECTORS[index];
        // Банкрот и «0» — потеря, и рука узнаёт об этом раньше, чем глаз
        // дочитает подпись сектора.
        if (isPunishingSector(sector)) haptic.failure();
        showSectorToast(sector);
      },
    });
  useAuthoritativeSpin(game.spin, { spinToAngle, snapToAngle, reset });

  const winner = winnerIndex !== null ? FORTUNE_SECTORS[winnerIndex] : null;

  return (
    <Stack
      gap="sm"
      align="center"
      style={{ width: "100%", maxWidth: "620px", margin: "0 auto" }}
    >
      <Button
        size="lg"
        block
        disabled={spinning || game.phase !== "ready"}
        onClick={() => {
          beginSpin();
        }}
      >
        {spinning
          ? "Крутится..."
          : game.phase === "ready"
            ? `Крутит «${activeTeam?.name ?? "команда"}»`
            : "Крутить барабан"}
      </Button>

      <Text as="p" weight={700} align="center" aria-live="polite">
        {winner ? `Выпало: ${winner.label}` : " "}
      </Text>

      {game.spin && (
        <details className="w-full text-left text-xs text-muted-foreground">
          <summary className="cursor-pointer text-center">Seed вращения</summary>
          <code className="mt-2xs block break-all">{game.spin.seed}</code>
        </details>
      )}

      <Wheel
        sectors={FORTUNE_SECTORS}
        rotation={rotation}
        size="min(88vw, 92vmin, 420px)"
        spinDurationMs={effectiveDurationMs}
        easing={easing}
        spinRef={spinRef}
        winnerIndex={winnerIndex}
        hub
        rim
        hubColor={FORTUNE_ACCENT_COLOR}
        ariaLabel="Барабан «Поля чудес»"
      />
    </Stack>
  );
};

export default FortuneWheelSection;
