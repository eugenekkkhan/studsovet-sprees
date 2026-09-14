import { useState, type ReactNode } from "react";
import {
  IoAddOutline,
  IoCheckmarkOutline,
  IoRemoveOutline,
  IoSettingsOutline,
  IoTrashBinOutline,
} from "react-icons/io5";
import {
  Button,
  ColorInput,
  Divider,
  IconButton,
  Input,
  Stack,
} from "../../../atoms";
import { InviteSplitButton, TeamCard } from "../../../molecules";
import { showToast } from "../../../../utils/toast";

interface TeamAdminCardProps {
  name: string;
  color: string;
  score: number;
  /** Show the sign on positive scores — «Своя игра» goes negative. */
  signed?: boolean;
  /** Личный ключ капитана, если сервер его выдал. */
  joinKey?: string | null;
  /** Персональная ссылка капитана — копирование и QR. */
  inviteUrl?: string | null;
  badges?: ReactNode;
  note?: ReactNode;
  online?: boolean;
  /** Команда вне игры на этом вопросе — попытка уже использована. */
  dimmed?: boolean;
  highlighted?: boolean;
  /** Кнопки конкретной игры: «Передать ход» и подобные. */
  actions?: ReactNode;
  /** Состав правят только между раундами. */
  removeDisabled?: boolean;
  onSave: (name: string, color: string) => void;
  onScore: (score: number) => void;
  onRemove: () => void;
}

/**
 * Карточка команды в консоли ведущего — одна и та же во всех играх.
 * Показывает то же, что видит зал, и прячет правку под шестерёнку.
 */
const TeamAdminCard = ({
  name,
  color,
  score,
  signed = false,
  joinKey,
  inviteUrl,
  badges,
  note,
  online,
  dimmed,
  highlighted,
  actions,
  removeDisabled = false,
  onSave,
  onScore,
  onRemove,
}: TeamAdminCardProps) => {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftColor, setDraftColor] = useState(color);
  const [draftScore, setDraftScore] = useState(String(score));

  const nameChanged = draftName.trim() !== "" && draftName.trim() !== name;
  const colorChanged = draftColor !== color;
  const parsedScore = Number(draftScore);
  const scoreChanged =
    draftScore.trim() !== "" &&
    Number.isFinite(parsedScore) &&
    parsedScore !== score;

  const toggleEditing = () => {
    // Drafts are seeded on open, so a score the server changed meanwhile is
    // never overwritten by a stale field.
    if (!editing) {
      setDraftName(name);
      setDraftColor(color);
      setDraftScore(String(score));
    }
    setEditing(!editing);
  };

  const saveName = () => {
    if (!nameChanged && !colorChanged) return;
    onSave(draftName.trim() || name, draftColor);
  };

  const saveScore = () => {
    if (!scoreChanged) return;
    onScore(parsedScore);
  };

  const nudge = (delta: number) =>
    setDraftScore(String((Number.isFinite(parsedScore) ? parsedScore : score) + delta));

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast.success(message);
    } catch {
      window.prompt(message, text);
    }
  };

  const remove = () => {
    if (window.confirm(`Удалить команду «${name}»?`)) {
      onRemove();
    }
  };

  return (
    <TeamCard
      name={name}
      color={color}
      score={score}
      size="md"
      signed={signed}
      badges={badges}
      note={note}
      online={online}
      dimmed={dimmed}
      highlighted={highlighted}
    >
      <Stack gap="sm">
        {actions && (
          <Stack direction="row" gap="xs" justify="center" wrap>
            {actions}
          </Stack>
        )}

        {joinKey && (
          <Stack direction="row" gap="2xs" align="center" justify="center" wrap>
            <Button
              size="sm"
              variant="ghost"
              className="font-mono tracking-[0.08em]"
              aria-label={`Скопировать ключ команды «${name}»`}
              onClick={() => void copy(joinKey, `Ключ команды «${name}» скопирован.`)}
            >
              {joinKey}
            </Button>
            {inviteUrl && (
              <>
                <InviteSplitButton
                  url={inviteUrl}
                  label="Капитан"
                  title={`Капитан «${name}»`}
                />
              </>
            )}
          </Stack>
        )}

        <Stack direction="row" gap="xs" justify="center">
          <IconButton
            label={editing ? "Скрыть настройки команды" : "Настроить команду"}
            aria-expanded={editing}
            onClick={toggleEditing}
          >
            <IoSettingsOutline aria-hidden />
          </IconButton>
          <IconButton
            tone="danger"
            label="Удалить команду"
            disabled={removeDisabled}
            onClick={remove}
          >
            <IoTrashBinOutline aria-hidden />
          </IconButton>
        </Stack>

        {editing && (
          <Stack gap="sm">
            <Divider />

            <form
              className="flex w-full items-center gap-xs"
              onSubmit={(event) => {
                event.preventDefault();
                saveName();
              }}
            >
              <ColorInput
                value={draftColor}
                aria-label={`Цвет команды «${name}»`}
                onChange={(event) => setDraftColor(event.target.value)}
              />
              <Input
                value={draftName}
                aria-label={`Название команды «${name}»`}
                placeholder="Название команды"
                className="min-w-0 flex-1"
                onChange={(event) => setDraftName(event.target.value)}
              />
              <IconButton
                type="submit"
                label="Сохранить название и цвет"
                disabled={!nameChanged && !colorChanged}
              >
                <IoCheckmarkOutline aria-hidden />
              </IconButton>
            </form>

            {/* The field is a draft of the final score: ± nudge it, «Записать»
                commits. Nothing here changes the score behind the host's back. */}
            <form
              className="flex w-full items-center gap-xs"
              onSubmit={(event) => {
                event.preventDefault();
                saveScore();
              }}
            >
              <IconButton label="Убавить очко" onClick={() => nudge(-1)}>
                <IoRemoveOutline aria-hidden />
              </IconButton>
              <Input
                type="number"
                value={draftScore}
                aria-label={`Очки команды «${name}»`}
                className="min-w-0 flex-1 text-center"
                onChange={(event) => setDraftScore(event.target.value)}
              />
              <IconButton label="Прибавить очко" onClick={() => nudge(1)}>
                <IoAddOutline aria-hidden />
              </IconButton>
              <Button type="submit" disabled={!scoreChanged}>
                Записать
              </Button>
            </form>
          </Stack>
        )}
      </Stack>
    </TeamCard>
  );
};

export type { TeamAdminCardProps };
export default TeamAdminCard;
