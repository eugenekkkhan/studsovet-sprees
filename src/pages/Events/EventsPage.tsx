import { useCallback, useEffect, useState, type FormEvent } from "react";
import { withHaptic } from "../../api/telegram";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Heading,
  Input,
  LoadingSpinner,
  Notice,
  Select,
  Stack,
  Text,
  TextArea,
} from "../../components/atoms";
import { PageContainer } from "../../components/templates";
import {
  createEvent,
  confirmAttendance,
  fetchEvents,
  finalizeEvent,
  generateAttendanceCode,
  setEventCoordinators,
  setManualAttendance,
  updateEvent,
  respondToEvent,
  type CommunityEvent,
  type ReminderRule,
  type RsvpStatus,
} from "../../api/eventsApi";
import { ApiError } from "../../api/http";
import { showToast } from "../../utils/toast";
import { cardRadius } from "../../styles/tokens";

const labels: Record<RsvpStatus, string> = {
  going: "Иду",
  declined: "Не иду",
  maybe: "Пока думаю",
};

const parseTelegramIds = (value: string) => value
  .split(/[\s,;]+/)
  .map(Number)
  .filter((id) => Number.isSafeInteger(id) && id > 0);

const defaultGoingReminders: ReminderRule[] = [
  { type: "relative", minutesBefore: 24 * 60 },
  { type: "relative", minutesBefore: 3 * 60 },
];
const defaultMaybeReminders: ReminderRule[] = [
  { type: "relative", minutesBefore: 72 * 60 },
  ...defaultGoingReminders,
];

const ruleKey = (rule: ReminderRule) => rule.type === "absolute"
  ? `at:${rule.at}`
  : `before:${rule.minutesBefore}`;

const ruleLabel = (rule: ReminderRule) => {
  if (rule.type === "absolute") {
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(rule.at));
  }
  if (rule.minutesBefore % 1440 === 0) return `за ${rule.minutesBefore / 1440} дн.`;
  if (rule.minutesBefore % 60 === 0) return `за ${rule.minutesBefore / 60} ч.`;
  return `за ${rule.minutesBefore} мин.`;
};

const ReminderBuilder = ({ label, value, onChange }: {
  label: string;
  value: ReminderRule[];
  onChange: (value: ReminderRule[]) => void;
}) => {
  const [type, setType] = useState<"relative" | "absolute">("relative");
  const [amount, setAmount] = useState("3");
  const [unit, setUnit] = useState("hours");
  const [at, setAt] = useState("");
  const add = () => {
    const multiplier = unit === "days" ? 1440 : unit === "hours" ? 60 : 1;
    const rule: ReminderRule | null = type === "absolute"
      ? at ? { type, at: new Date(at).toISOString() } : null
      : Number(amount) > 0 ? { type, minutesBefore: Math.round(Number(amount) * multiplier) } : null;
    if (rule && !value.some((item) => ruleKey(item) === ruleKey(rule))) onChange([...value, rule]);
  };
  return (
    <Stack gap="sm">
      <Text tone="muted">{label}</Text>
      <Stack direction="row" gap="2xs" wrap>
        {value.map((rule) => (
          <Badge key={ruleKey(rule)} tone="neutral">
            {ruleLabel(rule)}{" "}
            <button
              type="button"
              aria-label={`Удалить ${ruleLabel(rule)}`}
              onClick={withHaptic("failure", () =>
                onChange(value.filter((item) => ruleKey(item) !== ruleKey(rule))),
              )}
            >
              ×
            </button>
          </Badge>
        ))}
        {value.length === 0 && <Text tone="muted">Без уведомлений</Text>}
      </Stack>
      <Stack direction="row" gap="sm" wrap>
        <Select value={type} onChange={(e) => setType(e.target.value as "relative" | "absolute")}>
          <option value="relative">До начала</option>
          <option value="absolute">Точная дата</option>
        </Select>
        {type === "relative" ? <>
          <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Количество" />
          <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="minutes">Минут</option>
            <option value="hours">Часов</option>
            <option value="days">Дней</option>
          </Select>
        </> : (
          <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        )}
        <Button type="button" variant="ghost" onClick={add}>Добавить</Button>
      </Stack>
    </Stack>
  );
};

const localDateTime = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const EventCard = ({ event, onChange }: {
  event: CommunityEvent;
  onChange: (event: CommunityEvent) => void;
}) => {
  const [busy, setBusy] = useState<RsvpStatus | null>(null);
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [attendanceCode, setAttendanceCode] = useState("");
  const [coordinatorIds, setCoordinatorIds] = useState(event.coordinatorIds.join(", "));
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(event.title);
  const [editStartsAt, setEditStartsAt] = useState(localDateTime(event.startsAt));
  const [editLocation, setEditLocation] = useState(event.location);
  const [editDescription, setEditDescription] = useState(event.description);
  const [editTags, setEditTags] = useState(event.tags.join(", "));
  const [editAttendance, setEditAttendance] = useState(event.attendanceRequired);
  const [editGoingReminders, setEditGoingReminders] = useState(event.goingReminders);
  const [editMaybeReminders, setEditMaybeReminders] = useState(event.maybeReminders);
  const [editStatus, setEditStatus] = useState(event.status);
  const [editCategory, setEditCategory] = useState(event.category);
  const [editDuration, setEditDuration] = useState(String(event.durationMinutes));
  const respond = async (status: RsvpStatus) => {
    let reason = "";
    if (status === "declined") {
      reason = window.prompt("Почему не получается прийти? Можно не отвечать.") ?? "";
    }
    setBusy(status);
    try {
      onChange(await respondToEvent(event.id, status, reason));
    } catch (cause) {
      showToast.error(cause instanceof ApiError ? cause.message : "Не удалось сохранить ответ.");
    } finally {
      setBusy(null);
    }
  };
  const openAttendance = async () => {
    setAttendanceBusy(true);
    try {
      onChange(await generateAttendanceCode(event.id));
    } catch (cause) {
      showToast.error(cause instanceof ApiError ? cause.message : "Не удалось создать код.");
    } finally {
      setAttendanceBusy(false);
    }
  };
  const markPresent = async () => {
    setAttendanceBusy(true);
    try {
      onChange(await confirmAttendance(event.id, attendanceCode));
      setAttendanceCode("");
      showToast.success("Присутствие подтверждено.");
    } catch (cause) {
      showToast.error(cause instanceof ApiError ? cause.message : "Не удалось подтвердить присутствие.");
    } finally {
      setAttendanceBusy(false);
    }
  };
  const saveCoordinators = async () => {
    setAttendanceBusy(true);
    try {
      const changed = await setEventCoordinators(event.id, parseTelegramIds(coordinatorIds));
      onChange(changed);
      setCoordinatorIds(changed.coordinatorIds.join(", "));
      showToast.success("Координаторы сохранены.");
    } catch (cause) {
      showToast.error(cause instanceof ApiError ? cause.message : "Не удалось назначить координаторов.");
    } finally {
      setAttendanceBusy(false);
    }
  };
  const startsAt = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(event.startsAt));

  const saveEvent = async () => {
    setAttendanceBusy(true);
    try {
      const changed = await updateEvent(event.id, {
        title: editTitle,
        startsAt: new Date(editStartsAt).toISOString(),
        location: editLocation,
        description: editDescription,
        tags: editTags.split(",").map((tag) => tag.trim()).filter(Boolean),
        attendanceRequired: editAttendance,
        goingReminderHours: editGoingReminders.filter((rule) => rule.type === "relative").map((rule) => rule.minutesBefore / 60),
        maybeReminderHours: editMaybeReminders.filter((rule) => rule.type === "relative").map((rule) => rule.minutesBefore / 60),
        goingReminders: editGoingReminders,
        maybeReminders: editMaybeReminders,
        status: editStatus,
        category: editCategory,
        durationMinutes: Number(editDuration),
      });
      onChange(changed);
      setEditing(false);
      showToast.success("Мероприятие обновлено.");
    } catch (cause) {
      showToast.error(cause instanceof ApiError ? cause.message : "Не удалось обновить мероприятие.");
    } finally {
      setAttendanceBusy(false);
    }
  };
  const toggleAttendance = async (userId: number, name: string, present: boolean) => {
    setAttendanceBusy(true);
    try {
      onChange(await setManualAttendance(event.id, userId, name, present));
    } catch (cause) {
      showToast.error(cause instanceof ApiError ? cause.message : "Не удалось изменить явку.");
    } finally {
      setAttendanceBusy(false);
    }
  };
  const finalize = async () => {
    if (!window.confirm("Зафиксировать итог? После этого изменить явку будет нельзя.")) return;
    setAttendanceBusy(true);
    try {
      const result = await finalizeEvent(event.id);
      onChange(result.event);
      showToast.success("Итоги зафиксированы, надёжность пересчитана.");
    } catch (cause) {
      showToast.error(cause instanceof ApiError ? cause.message : "Не удалось завершить мероприятие.");
    } finally {
      setAttendanceBusy(false);
    }
  };

  return (
    <Card padding="lg" content={cardRadius("md")}>
      <Stack gap="md">
        {event.canManage && !event.finalizedAt && (
          <Stack direction="row" justify="flex-end">
            <Button variant="ghost" onClick={() => setEditing((value) => !value)}>
              {editing ? "Закрыть редактор" : "Редактировать"}
            </Button>
          </Stack>
        )}
        {editing && (
          <Card padding="md" tone="muted">
            <Stack gap="sm">
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Название" />
              <Input type="datetime-local" value={editStartsAt} onChange={(e) => setEditStartsAt(e.target.value)} />
              <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="Место" />
              <TextArea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Описание" />
              <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="Теги через запятую" />
              <Select value={editCategory} onChange={(e) => setEditCategory(e.target.value as CommunityEvent["category"])}>
                <option value="volunteer">Волонтёрское</option>
                <option value="entertainment">Развлекательное</option>
                <option value="other">Другое</option>
              </Select>
              <Input type="number" min="30" max="1440" step="30" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} placeholder="Продолжительность, минут" />
              <label><input type="checkbox" checked={editAttendance} onChange={(e) => setEditAttendance(e.target.checked)} /> Подтверждать присутствие кодом</label>
              <ReminderBuilder label="Напоминать тем, кто идёт" value={editGoingReminders} onChange={setEditGoingReminders} />
              <ReminderBuilder label="Спрашивать тех, кто думает" value={editMaybeReminders} onChange={setEditMaybeReminders} />
              <label>
                Статус:{" "}
                <Select value={editStatus} onChange={(e) => setEditStatus(e.target.value as CommunityEvent["status"])}>
                  <option value="published">Опубликовано</option>
                  <option value="cancelled">Отменено</option>
                  <option value="draft">Черновик</option>
                </Select>
              </label>
              <Button loading={attendanceBusy} onClick={() => void saveEvent()}>Сохранить изменения</Button>
            </Stack>
          </Card>
        )}
        <Stack gap="2xs">
          <Heading level={2}>{event.title}</Heading>
          <Text weight={600}>{startsAt}</Text>
          <Text tone="muted">Продолжительность: {Math.round(event.durationMinutes / 60 * 10) / 10} ч.</Text>
          {event.location && <Text tone="muted">{event.location}</Text>}
        </Stack>
        {event.description && <Text>{event.description}</Text>}
        {event.tags.length > 0 && (
          <Stack direction="row" gap="2xs" wrap>
            {event.tags.map((tag) => <Badge key={tag} tone="neutral">{tag}</Badge>)}
          </Stack>
        )}
        <Stack direction="row" gap="sm" wrap>
          {(["going", "declined", "maybe"] as const).map((status) => (
            <Button
              key={status}
              variant={event.myRsvp === status ? "primary" : "ghost"}
              loading={busy === status}
              disabled={busy !== null}
              onClick={() => void respond(status)}
            >
              {labels[status]} · {event.counts[status]}
            </Button>
          ))}
        </Stack>
        {event.attendanceRequired && (
          <Card padding="md" tone="muted">
            <Stack gap="sm">
              <Text weight={600}>
                Присутствие: {event.attendanceCount}
                {event.isPresent ? " · вы на месте" : ""}
              </Text>
              {event.canManage ? (
                <Stack direction="row" gap="sm" align="center" wrap>
                  {event.attendanceCode && <Badge tone="neutral">Код: {event.attendanceCode}</Badge>}
                  <Button variant="ghost" loading={attendanceBusy} onClick={() => void openAttendance()}>
                    {event.attendanceCode ? "Сменить код" : "Открыть отметку"}
                  </Button>
                </Stack>
              ) : event.isPresent ? (
                <Text tone="muted">Отметка сохранена.</Text>
              ) : event.attendanceOpen && event.myRsvp === "going" ? (
                <Stack direction="row" gap="sm" wrap>
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    value={attendanceCode}
                    onChange={(e) => setAttendanceCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="Код координатора"
                  />
                  <Button
                    loading={attendanceBusy}
                    disabled={attendanceCode.length !== 6}
                    onClick={() => void markPresent()}
                  >
                    Я на месте
                  </Button>
                </Stack>
              ) : (
                <Text tone="muted">
                  {event.myRsvp === "going"
                    ? "Координатор откроет отметку на мероприятии."
                    : "Чтобы отметиться на месте, сначала нажмите «Иду»."}
                </Text>
              )}
            </Stack>
          </Card>
        )}
        {event.canAssignCoordinators && (
          <Stack gap="2xs">
            <Text tone="muted">Telegram ID координаторов</Text>
            <Stack direction="row" gap="sm" wrap>
              <Input
                value={coordinatorIds}
                onChange={(e) => setCoordinatorIds(e.target.value)}
                placeholder="Например: 123456789, 987654321"
              />
              <Button variant="ghost" loading={attendanceBusy} onClick={() => void saveCoordinators()}>
                Сохранить
              </Button>
            </Stack>
          </Stack>
        )}
        {event.canManage && event.responses && event.responses.length > 0 && (
          <Card padding="md" tone="muted">
            <Stack gap="sm">
              <Text weight={600}>Сверка участников</Text>
              {event.responses.map((response) => {
                const present = event.attendance?.some((item) => item.userId === response.userId) ?? false;
                return (
                  <Stack key={response.userId} direction="row" justify="space-between" align="center" gap="sm">
                    <Text>{response.name} · {labels[response.status]}</Text>
                    <label>
                      <input
                        type="checkbox"
                        checked={present}
                        disabled={attendanceBusy || Boolean(event.finalizedAt)}
                        onChange={(e) => void toggleAttendance(response.userId, response.name, e.target.checked)}
                      />{" "}Был на месте
                    </label>
                  </Stack>
                );
              })}
              {!event.finalizedAt && (
                <Button loading={attendanceBusy} onClick={() => void finalize()}>
                  Зафиксировать итог
                </Button>
              )}
              {event.finalizedAt && <Badge tone="success">Итоги зафиксированы</Badge>}
            </Stack>
          </Card>
        )}
      </Stack>
    </Card>
  );
};

const CreateEventForm = ({ onCreated }: { onCreated: (event: CommunityEvent) => void }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [attendanceRequired, setAttendanceRequired] = useState(false);
  const [coordinatorIds, setCoordinatorIds] = useState("");
  const [goingReminders, setGoingReminders] = useState<ReminderRule[]>(defaultGoingReminders);
  const [maybeReminders, setMaybeReminders] = useState<ReminderRule[]>(defaultMaybeReminders);
  const [category, setCategory] = useState<CommunityEvent["category"]>("other");
  const [duration, setDuration] = useState("120");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await createEvent({
        title,
        startsAt: new Date(startsAt).toISOString(),
        location,
        description,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        attendanceRequired,
        coordinatorIds: parseTelegramIds(coordinatorIds),
        goingReminderHours: goingReminders.filter((rule) => rule.type === "relative").map((rule) => rule.minutesBefore / 60),
        maybeReminderHours: maybeReminders.filter((rule) => rule.type === "relative").map((rule) => rule.minutesBefore / 60),
        goingReminders,
        maybeReminders,
        category,
        durationMinutes: Number(duration),
      });
      onCreated(created);
      setTitle("");
      setStartsAt("");
      setLocation("");
      setDescription("");
      setTags("");
      setAttendanceRequired(false);
      setCoordinatorIds("");
      setGoingReminders(defaultGoingReminders);
      setMaybeReminders(defaultMaybeReminders);
      setCategory("other");
      setDuration("120");
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось создать мероприятие.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return <Button onClick={() => setOpen(true)}>Создать мероприятие</Button>;
  return (
    <Card padding="lg" tone="muted">
      <form onSubmit={submit}>
        <Stack gap="sm">
          <Heading level={2}>Новое мероприятие</Heading>
          {error && <Notice tone="error">{error}</Notice>}
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название" required />
          <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Место" />
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание и инструкции" />
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Теги через запятую" />
          <Input
            value={coordinatorIds}
            onChange={(e) => setCoordinatorIds(e.target.value)}
            placeholder="Telegram ID координаторов через запятую"
          />
          <Select value={category} onChange={(e) => setCategory(e.target.value as CommunityEvent["category"])}>
            <option value="volunteer">Волонтёрское</option>
            <option value="entertainment">Развлекательное</option>
            <option value="other">Другое</option>
          </Select>
          <Input type="number" min="30" max="1440" step="30" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Продолжительность, минут" />
          <label>
            <input
              type="checkbox"
              checked={attendanceRequired}
              onChange={(e) => setAttendanceRequired(e.target.checked)}
            />{" "}
            Подтверждать присутствие кодом координатора
          </label>
          <ReminderBuilder label="Напоминать тем, кто идёт" value={goingReminders} onChange={setGoingReminders} />
          <ReminderBuilder label="Спрашивать тех, кто думает" value={maybeReminders} onChange={setMaybeReminders} />
          <Stack direction="row" gap="sm">
            <Button type="submit" loading={busy}>Опубликовать</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
          </Stack>
        </Stack>
      </form>
    </Card>
  );
};

const EventsPage = () => {
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchEvents();
      setEvents(result.events);
      setCanCreate(result.canCreate);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось загрузить мероприятия.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const replace = (changed: CommunityEvent) => {
    setEvents((current) => current.map((event) => event.id === changed.id ? changed : event));
  };

  return (
    <PageContainer maxWidth={820}>
      <Stack gap="lg">
        <Stack align="center" gap="sm">
          <Stack align="center" gap="2xs">
            <Heading level={1} align="center">Мероприятия</Heading>
            <Text as="p" tone="muted" align="center">
              Записывайтесь и следите за ближайшими событиями.
            </Text>
          </Stack>
          {canCreate && <CreateEventForm onCreated={(event) => setEvents((current) => [...current, event])} />}
        </Stack>
        {error && <Notice tone="error">{error}</Notice>}
        {loading ? (
          <Stack align="center"><LoadingSpinner label="Загружаем мероприятия" /></Stack>
        ) : events.length === 0 ? (
          <EmptyState>Опубликованных мероприятий пока нет.</EmptyState>
        ) : (
          <Stack gap="md">{events.map((event) => (
            <EventCard key={event.id} event={event} onChange={replace} />
          ))}</Stack>
        )}
      </Stack>
    </PageContainer>
  );
};

export default EventsPage;
