import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { EmptyState, Heading, Notice, Stack, Text, Button } from "../../components/atoms";
import { InlineAddForm, Wheel } from "../../components/molecules";
import {
  BulkPasteForm,
  EntityList,
  SetTransferBar,
  SpinControls,
  SpinHistory,
} from "../../components/organisms";
import { PageContainer } from "../../components/templates";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { useRouletteEntities } from "../../hooks/useRouletteEntities";
import { useWheelSpin } from "../../hooks/useWheelSpin";
import { parseShareParam, type ListItem } from "../../utils/rouletteList";
import type { Entity } from "../../types/roulette";

const CHAIN_PAUSE_MS = 900;

/** "The most honest random roulette" — a spinnable wheel of user-entered names. */
const RoulettePage = () => {
  const {
    entities,
    drawMode,
    history,
    active,
    sectors,
    boundaries,
    totalWeight,
    add,
    addMany,
    remove,
    clearAll,
    setWeight,
    setColor,
    reorder,
    restoreAll,
    setDrawMode,
    recordWin,
    clearHistory,
    replaceSet,
    mergeSet,
  } = useRouletteEntities();

  const [draft, setDraft] = useState("");
  const [riggedId, setRiggedId] = useState<string | null>(null);
  const [picks, setPicks] = useState(1);
  const [winner, setWinner] = useState<Entity | null>(null);
  const [incoming, setIncoming] = useState<ListItem[] | null>(null);

  const prefersReducedMotion = usePrefersReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeRef = useRef(active);
  activeRef.current = active;
  const remainingSpins = useRef(0);
  const chainTimer = useRef<number | null>(null);

  const handleSettle = useCallback(
    (index: number) => {
      const won = activeRef.current[index];
      if (!won) {
        return;
      }

      setWinner(won);
      recordWin(won);
    },
    [recordWin],
  );

  // Alt+R clears the rig. The marker is gone, so this is the only way back to
  // a fair wheel — same modifier as the Alt+click that sets it. Silent by
  // design: any confirmation would announce the feature to the room.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.altKey && event.code === "KeyR") {
        event.preventDefault();
        setRiggedId(null);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // The rig names an id, so it survives anything happening to other entries.
  // It is dropped only when its own entry leaves the wheel — deleted, drawn
  // out, or replaced — which is the one case where it has no wedge to hit.
  useEffect(() => {
    if (riggedId && !active.some((entity) => entity.id === riggedId)) {
      setRiggedId(null);
    }
  }, [active, riggedId]);

  const { rotation, spinning, winnerIndex, effectiveDurationMs, easing, spinRef, spin, reset } =
    useWheelSpin({ boundaries, onSettle: handleSettle });

  // `sectors` only holds entries that still have a wedge, so a rigged id has
  // to be looked up there — `entities` indexes would award the wrong person.
  const startSpin = useCallback(() => {
    const target = riggedId
      ? sectors.findIndex((sector) => sector.id === riggedId)
      : -1;
    spin(target >= 0 ? target : null);
  }, [riggedId, sectors, spin]);

  // Chaining several winners is page policy, not the spin hook's business.
  useEffect(() => {
    if (spinning || remainingSpins.current <= 0) {
      return;
    }

    remainingSpins.current -= 1;
    if (remainingSpins.current <= 0 || activeRef.current.length === 0) {
      remainingSpins.current = 0;
      return;
    }

    chainTimer.current = window.setTimeout(
      startSpin,
      prefersReducedMotion ? 0 : CHAIN_PAUSE_MS,
    );

    return () => {
      if (chainTimer.current !== null) {
        window.clearTimeout(chainTimer.current);
        chainTimer.current = null;
      }
    };
  }, [spinning, startSpin, prefersReducedMotion]);

  // A shared set never overwrites a list silently.
  useEffect(() => {
    const param = searchParams.get("set");
    if (!param) {
      return;
    }

    const parsed = parseShareParam(param);
    setSearchParams({}, { replace: true });
    if (!parsed?.length) {
      return;
    }

    if (entities.length === 0) {
      replaceSet(parsed);
    } else {
      setIncoming(parsed);
    }
    // Runs once per arriving link; `entities` is read, not tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleReset = () => {
    remainingSpins.current = 0;
    setWinner(null);
    reset();
  };

  const handleClear = () => {
    handleReset();
    clearAll();
  };

  const handleSpin = () => {
    remainingSpins.current = drawMode === "remove" ? Math.max(1, picks) : 1;
    setWinner(null);
    startSpin();
  };

  const transferItems: ListItem[] = entities.map((entity) => ({
    title: entity.title,
    color: entity.color,
    weight: entity.weight,
  }));

  return (
    <PageContainer>
      <Stack gap="sm" align="center" block>
        <Heading level={1}>Колесо Удачи</Heading>

        <InlineAddForm
          value={draft}
          onChange={setDraft}
          onSubmit={() => {
            add(draft.trim());
            setDraft("");
          }}
          placeholder="Кого добавить?"
        />

        <BulkPasteForm
          disabled={spinning}
          onAdd={(items, merge) => addMany(items, merge)}
        />

        {incoming && (
          <Notice>
            <Stack gap="sm">
              <span>По ссылке пришло {incoming.length} записей.</span>
              <Stack direction="row" gap="sm" wrap>
                <Button
                  onClick={() => {
                    replaceSet(incoming);
                    setIncoming(null);
                  }}
                >
                  Заменить список
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    mergeSet(incoming);
                    setIncoming(null);
                  }}
                >
                  Добавить к текущему
                </Button>
                <Button variant="ghost" onClick={() => setIncoming(null)}>
                  Отмена
                </Button>
              </Stack>
            </Stack>
          </Notice>
        )}

        {entities.length === 0 ? (
          <EmptyState>Добавьте участников, и колесо оживёт.</EmptyState>
        ) : (
          <>
            <SpinControls
              drawMode={drawMode}
              onDrawMode={setDrawMode}
              picks={picks}
              onPicks={setPicks}
              remaining={active.length}
              spinning={spinning}
              onSpin={handleSpin}
              onReset={handleReset}
            />

            <Text
              as="p"
              weight={700}
              tone="inherit"
              aria-live="polite"
              style={{ color: winner?.color, minHeight: "24px" }}
            >
              {winner ? `Победитель: ${winner.title}` : " "}
            </Text>

            <Wheel
              sectors={sectors}
              rotation={rotation}
              size="min(88vw, 92vmin, 520px)"
              spinDurationMs={effectiveDurationMs}
              easing={easing}
              spinRef={spinRef}
              winnerIndex={winnerIndex}
              ariaLabel="Колесо удачи"
            />

            <EntityList
              entities={entities}
              drawMode={drawMode}
              totalWeight={totalWeight}
              disabled={spinning}
              onRig={(id) => setRiggedId((current) => (current === id ? null : id))}
              onRemove={remove}
              onWeight={setWeight}
              onColor={setColor}
              onReorder={reorder}
              onRestoreAll={restoreAll}
              onClear={handleClear}
            />

            <SetTransferBar
              items={transferItems}
              disabled={spinning}
              onReplace={replaceSet}
              onMerge={mergeSet}
            />

            <SpinHistory records={history} onClear={clearHistory} />
          </>
        )}
      </Stack>
    </PageContainer>
  );
};

export default RoulettePage;
