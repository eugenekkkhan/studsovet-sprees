import { Stack, Text } from "../../atoms";
import { font } from "../../../styles/tokens";

interface StatBlockProps {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  valueSize?: number;
  align?: "left" | "right";
}

/** A small caption above a large display-font value (team name, score). */
const StatBlock = ({
  label,
  value,
  valueColor,
  valueSize = 20,
  align = "left",
}: StatBlockProps) => (
  <Stack gap="2xs" style={{ textAlign: align }}>
    <Text size="sm" tone="muted">
      {label}
    </Text>
    <div
      style={{
        fontFamily: font.display,
        fontSize: `${valueSize}px`,
        fontWeight: 700,
        color: valueColor,
      }}
    >
      {value}
    </div>
  </Stack>
);

export type { StatBlockProps };
export default StatBlock;
