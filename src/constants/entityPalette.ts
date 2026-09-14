import { TEAM_COLORS } from "./teamColors";

/**
 * Colours for wheel entries. Handed out round-robin rather than at random, so
 * neighbouring sectors are always distinguishable and every colour is a known
 * hex the contrast maths can read.
 */
export const ENTITY_COLORS = [
  ...TEAM_COLORS,
  "#ea580c",
  "#0d9488",
  "#c026d3",
  "#4f46e5",
] as const;

export const nextEntityColor = (index: number) =>
  ENTITY_COLORS[index % ENTITY_COLORS.length];
