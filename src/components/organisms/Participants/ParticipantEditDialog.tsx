import { useEffect, useState, type ReactNode } from "react";
import { Dialog } from "radix-ui";
import { TbX } from "react-icons/tb";
import { Button, Card, Heading, IconButton, Input, Select, Stack } from "../../atoms";
import { educationCourseLimits, educationLabels } from "../../molecules/CourseScale/CourseScale";
import { facultyLabels } from "../../../constants/faculties";
import type { ParticipantProfile } from "../../../api/participantsApi";

interface ParticipantEditDialogProps {
  participant: ParticipantProfile | null;
  onClose: () => void;
  onSave: (draft: ParticipantProfile) => Promise<void>;
}

/**
 * Правка профиля отдельным окном, а не прямо в строке: развёрнутая строка
 * меняла высоту, уводила соседние ячейки и зажимала поля в ширину колонки.
 */
const ParticipantEditDialog = ({ participant, onClose, onSave }: ParticipantEditDialogProps) => {
  const [draft, setDraft] = useState<ParticipantProfile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!participant) {
      setDraft(null);
      return;
    }
    const [fallbackFirst = "", ...fallbackLast] = participant.name.split(/\s+/);
    setDraft({
      ...participant,
      firstName: participant.firstName || fallbackFirst,
      lastName: participant.lastName || fallbackLast.join(" "),
    });
  }, [participant]);

  const field = (label: string, control: ReactNode) => (
    <label className="grid gap-2xs text-sm text-muted-foreground">{label}{control}</label>
  );

  return (
    <Dialog.Root open={Boolean(participant)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-text/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 focus:outline-none">
          <Card padding="lg" radius="var(--radius-2xl)" className="max-h-[85vh] overflow-y-auto scroll-panel">
            {draft && <Stack gap="md">
              <Stack direction="row" align="center" justify="between" gap="sm">
                <Dialog.Title asChild><Heading level={2}>Профиль участника</Heading></Dialog.Title>
                <Dialog.Close asChild>
                  <IconButton size="sm" label="Закрыть"><TbX aria-hidden /></IconButton>
                </Dialog.Close>
              </Stack>
              <Dialog.Description className="sr-only">Имя, факультет, курс и дата рождения участника.</Dialog.Description>

              {field("Имя", <Input value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} />)}
              {field("Фамилия", <Input value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} />)}
              {field("Факультет", <Select value={draft.faculty ?? ""} onChange={(event) => setDraft({ ...draft, faculty: event.target.value ? event.target.value as ParticipantProfile["faculty"] : null })}>
                <option value="">Не указан</option>
                {Object.entries(facultyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>)}
              {field("Форма обучения", <Select value={draft.educationLevel ?? ""} onChange={(event) => setDraft({ ...draft, educationLevel: event.target.value ? event.target.value as ParticipantProfile["educationLevel"] : null, course: null })}>
                <option value="">Не указана</option>
                {Object.entries(educationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>)}
              {field("Курс", <Select value={draft.course ?? ""} disabled={!draft.educationLevel} onChange={(event) => setDraft({ ...draft, course: event.target.value ? Number(event.target.value) : null })}>
                <option value="">Курс не указан</option>
                {draft.educationLevel && Array.from({ length: educationCourseLimits[draft.educationLevel] }, (_, index) => index + 1)
                  .map((course) => <option key={course} value={course}>{course} курс</option>)}
              </Select>)}
              {field("Дата рождения", <Input type="date" value={draft.birthday ?? ""} onChange={(event) => setDraft({ ...draft, birthday: event.target.value || null })} />)}

              <Stack direction="row" gap="xs" justify="end">
                <Dialog.Close asChild><Button variant="ghost">Отмена</Button></Dialog.Close>
                <Button loading={saving} onClick={() => { setSaving(true); void onSave(draft).finally(() => setSaving(false)); }}>Сохранить</Button>
              </Stack>
            </Stack>}
          </Card>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export type { ParticipantEditDialogProps };
export default ParticipantEditDialog;
