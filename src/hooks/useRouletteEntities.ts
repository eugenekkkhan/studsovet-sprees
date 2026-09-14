import { useCallback, useEffect, useMemo, useState } from "react";
import { hslStringToHex, normalizeHex } from "../utils/color";
import { weightBoundaries } from "../utils/wheel";
import { nextEntityColor } from "../constants/entityPalette";
import {
  effectiveWeight,
  type DrawMode,
  type Entity,
  type RouletteState,
  type SpinRecord,
} from "../types/roulette";

/** The pre-`id` payload. Left in place so a migration bug cannot destroy a list. */
const V1_KEY = "wheelEntities";
const V2_KEY = "rouletteState";
const HISTORY_LIMIT = 50;

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const emptyState = (): RouletteState => ({
  version: 2,
  entities: [],
  drawMode: "replace",
  history: [],
});

const isEntity = (value: unknown): value is Entity => {
  const entity = value as Entity | null;
  return (
    typeof entity?.id === "string" &&
    typeof entity.title === "string" &&
    typeof entity.color === "string" &&
    Number.isFinite(entity.weight) &&
    Number.isFinite(entity.drawn)
  );
};

const isRouletteState = (value: unknown): value is RouletteState => {
  const state = value as RouletteState | null;
  return (
    state?.version === 2 &&
    Array.isArray(state.entities) &&
    state.entities.every(isEntity) &&
    (state.drawMode === "replace" || state.drawMode === "remove") &&
    Array.isArray(state.history)
  );
};

const toHex = (value: unknown, index: number) =>
  (typeof value === "string"
    ? (normalizeHex(value) ?? hslStringToHex(value))
    : null) ?? nextEntityColor(index);

/** v2, else v1 converted, else empty. Every branch is guarded — old payloads must not throw. */
const readState = (): RouletteState => {
  try {
    const stored = JSON.parse(localStorage.getItem(V2_KEY) ?? "null");
    if (isRouletteState(stored)) {
      return stored;
    }
  } catch {
    /* fall through to v1 */
  }

  try {
    const legacy = JSON.parse(localStorage.getItem(V1_KEY) ?? "null");
    if (Array.isArray(legacy)) {
      return {
        ...emptyState(),
        entities: legacy
          .filter(
            (entry): entry is { title: string; color?: unknown } =>
              typeof entry?.title === "string",
          )
          .map((entry, index) => ({
            id: newId(),
            title: entry.title,
            color: toHex(entry.color, index),
            weight: 1,
            drawn: 0,
          })),
      };
    }
  } catch {
    /* fall through to empty */
  }

  return emptyState();
};

/**
 * Owns the roulette's list, draw mode and history, so the page stays wiring.
 * `sectors` and `boundaries` are derived here so the wheel and the spin hook
 * can never disagree about what is on the wheel.
 */
export const useRouletteEntities = () => {
  const [state, setState] = useState<RouletteState>(readState);
  const { entities, drawMode, history } = state;

  useEffect(() => {
    localStorage.setItem(V2_KEY, JSON.stringify(state));
  }, [state]);

  const patch = useCallback(
    (change: (previous: RouletteState) => Partial<RouletteState>) =>
      setState((previous) => ({ ...previous, ...change(previous) })),
    [],
  );

  const mapEntities = useCallback(
    (change: (entity: Entity) => Entity) =>
      patch((previous) => ({ entities: previous.entities.map(change) })),
    [patch],
  );

  /**
   * Only the entities still on the wheel, in wheel order. `winnerIndex` from
   * the spin indexes THIS, not `entities` — resolve winners by `id` from here.
   */
  const active = useMemo(
    () => entities.filter((entity) => effectiveWeight(entity, drawMode) > 0),
    [entities, drawMode],
  );

  const sectors = useMemo(
    () =>
      active.map((entity) => ({
        id: entity.id,
        label:
          entity.weight > 1 ? `${entity.title} ×${entity.weight}` : entity.title,
        color: entity.color,
        weight: effectiveWeight(entity, drawMode),
      })),
    [active, drawMode],
  );

  const boundaries = useMemo(
    () => weightBoundaries(sectors.map((sector) => sector.weight)),
    [sectors],
  );

  const totalWeight = useMemo(
    () =>
      entities.reduce(
        (sum, entity) => sum + effectiveWeight(entity, drawMode),
        0,
      ),
    [entities, drawMode],
  );

  const makeEntity = (title: string, index: number, weight = 1): Entity => ({
    id: newId(),
    title,
    color: nextEntityColor(index),
    weight: Math.max(1, Math.round(weight)),
    drawn: 0,
  });

  const add = useCallback(
    (title: string) =>
      patch((previous) => ({
        entities: [
          ...previous.entities,
          makeEntity(title, previous.entities.length),
        ],
      })),
    [patch],
  );

  const addMany = useCallback(
    (items: { title: string; weight?: number }[], merge: boolean) =>
      patch((previous) => {
        const next = [...previous.entities];

        for (const item of items) {
          const weight = Math.max(1, Math.round(item.weight ?? 1));
          const existing = merge
            ? next.findIndex((entity) => entity.title === item.title)
            : -1;

          if (existing >= 0) {
            next[existing] = {
              ...next[existing],
              weight: next[existing].weight + weight,
            };
          } else {
            next.push(makeEntity(item.title, next.length, weight));
          }
        }

        return { entities: next };
      }),
    [patch],
  );

  const remove = useCallback(
    (id: string) =>
      patch((previous) => ({
        entities: previous.entities.filter((entity) => entity.id !== id),
      })),
    [patch],
  );

  const clearAll = useCallback(
    () => setState((previous) => ({ ...emptyState(), drawMode: previous.drawMode })),
    [],
  );

  const setWeight = useCallback(
    (id: string, weight: number) =>
      mapEntities((entity) =>
        entity.id === id
          ? { ...entity, weight: Math.max(1, Math.round(weight)) }
          : entity,
      ),
    [mapEntities],
  );

  const setColor = useCallback(
    (id: string, color: string) =>
      mapEntities((entity) =>
        entity.id === id
          ? { ...entity, color: normalizeHex(color) ?? entity.color }
          : entity,
      ),
    [mapEntities],
  );

  const reorder = useCallback(
    (fromId: string, toId: string) =>
      patch((previous) => {
        const from = previous.entities.findIndex((e) => e.id === fromId);
        const to = previous.entities.findIndex((e) => e.id === toId);
        if (from < 0 || to < 0 || from === to) {
          return {};
        }

        const next = [...previous.entities];
        next.splice(to, 0, ...next.splice(from, 1));
        return { entities: next };
      }),
    [patch],
  );

  const restoreAll = useCallback(
    () => mapEntities((entity) => ({ ...entity, drawn: 0 })),
    [mapEntities],
  );

  const setDrawMode = useCallback(
    (mode: DrawMode) => patch(() => ({ drawMode: mode })),
    [patch],
  );

  /** Logs the win and, on the "remove" mode, spends one copy of the winner. */
  const recordWin = useCallback(
    (entity: Entity) =>
      patch((previous) => {
        const record: SpinRecord = {
          id: newId(),
          entityId: entity.id,
          title: entity.title,
          color: entity.color,
          at: Date.now(),
        };

        return {
          history: [record, ...previous.history].slice(0, HISTORY_LIMIT),
          entities:
            previous.drawMode === "remove"
              ? previous.entities.map((candidate) =>
                  candidate.id === entity.id
                    ? { ...candidate, drawn: candidate.drawn + 1 }
                    : candidate,
                )
              : previous.entities,
        };
      }),
    [patch],
  );

  const clearHistory = useCallback(
    () => patch(() => ({ history: [] })),
    [patch],
  );

  const replaceSet = useCallback(
    (items: { title: string; color?: string; weight?: number }[]) =>
      patch(() => ({
        entities: items.map((item, index) => ({
          id: newId(),
          title: item.title,
          color: toHex(item.color, index),
          weight: Math.max(1, Math.round(item.weight ?? 1)),
          drawn: 0,
        })),
        history: [],
      })),
    [patch],
  );

  const mergeSet = useCallback(
    (items: { title: string; color?: string; weight?: number }[]) =>
      patch((previous) => ({
        entities: [
          ...previous.entities,
          ...items.map((item, index) => ({
            id: newId(),
            title: item.title,
            color: toHex(item.color, previous.entities.length + index),
            weight: Math.max(1, Math.round(item.weight ?? 1)),
            drawn: 0,
          })),
        ],
      })),
    [patch],
  );

  return {
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
  };
};
