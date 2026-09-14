export interface Entity {
  id: string;
  title: string;
  /** Canonical `#rrggbb`. */
  color: string;
  /**
   * Share of the wheel, and equally the number of copies on it: three rows
   * named "Аня" and one row "Аня ×3" subtend the same arc with the same odds,
   * so duplicates and weights are one field rather than two.
   */
  weight: number;
  /** Copies already drawn out. Only counts in the "remove" draw mode. */
  drawn: number;
}

export type DrawMode = "replace" | "remove";

export interface SpinRecord {
  id: string;
  entityId: string;
  /** Denormalised: history has to survive the entity being deleted. */
  title: string;
  color: string;
  at: number;
}

export interface RouletteState {
  version: 2;
  entities: Entity[];
  drawMode: DrawMode;
  history: SpinRecord[];
}

/** What is left of an entity on the wheel right now. */
export const effectiveWeight = (entity: Entity, mode: DrawMode) =>
  Math.max(0, entity.weight - (mode === "remove" ? entity.drawn : 0));
