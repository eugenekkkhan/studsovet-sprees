import {
  IoAdd,
  IoCall,
  IoDocumentText,
  IoGift,
  IoLayers,
  IoSkull,
  IoStar,
} from "react-icons/io5";
import type { Sector, SectorType } from "../types/fieldOfMiracles";
import type { IconType } from "react-icons";

interface SectorConfig {
  label: string;
  type: SectorType;
  value?: number;
  icon?: IconType;
  image?: string;
  /** Overrides the alternating fill. Reserved for the one punishing wedge. */
  color?: string;
}

const DEATH_IMAGE = "/poordeath.jpg";
/** Sector colours are data, not chrome, so they sit here as values. */
const DEATH_COLOR = "#cb4d4d";

const sectorItems: SectorConfig[] = [
  { label: "0", type: "lose-turn" },
  { label: "+500", type: "points", value: 500 },
  { label: "+100", type: "points", value: 100 },
  { label: "+100", type: "points", value: 100 },
  { label: "+400", type: "points", value: 400 },
  { label: "+200", type: "points", value: 200 },
  { label: "+300", type: "points", value: 300 },
  { label: "+200", type: "points", value: 200 },
  { label: "+400", type: "points", value: 400 },
  { label: "+300", type: "points", value: 300 },
  { label: "Задание", type: "task", value: 500, icon: IoDocumentText },
  { label: "+500", type: "points", value: 500 },
  {
    label: "+1000",
    type: "points",
    value: 1000,
    icon: IoStar,
  },
  {
    label: "Б",
    type: "bankrupt",
    icon: IoSkull,
    color: DEATH_COLOR,
    image: DEATH_IMAGE,
  },
  { label: "Друг", type: "friend", icon: IoCall },
  { label: "×2", type: "double", icon: IoLayers },
  { label: "ПРИЗ", type: "prize", value: 500, icon: IoGift },
  { label: "+", type: "plus", icon: IoAdd },
];

/** Game accent stays recognisable regardless of Telegram's UI button colour. */
export const FORTUNE_ACCENT_COLOR = "#2563eb";

// Neutral wedges are UI surfaces and therefore follow the Telegram theme;
// the blue wedges are game data and retain the Field of Miracles identity.
const palette = ["var(--color-surface)", FORTUNE_ACCENT_COLOR];

export const FORTUNE_SECTORS: Sector[] = sectorItems.map((item, index) => ({
  id: `sector-${index}`,
  label: item.label,
  type: item.type,
  value: item.value,
  color: item.color ?? palette[index % palette.length],
  icon: item.icon,
  image: item.image,
}));

/** Банкрот и потеря хода — единственные сектора, отнимающие ход или очки. */
export const isPunishingSector = (sector: Sector) =>
  sector.type === "bankrupt" || sector.type === "lose-turn";

export const getFortuneSector = (id: string | null) =>
  FORTUNE_SECTORS.find((sector) => sector.id === id) ?? null;
