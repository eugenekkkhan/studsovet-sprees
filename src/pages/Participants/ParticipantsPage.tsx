import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { fetchParticipants, updateParticipant, type ParticipantChat, type ParticipantProfile } from "../../api/participantsApi";
import { ApiError } from "../../api/http";
import { Button, EmptyState, Heading, LoadingSpinner, Notice, Stack, Text } from "../../components/atoms";
import { PageContainer } from "../../components/templates";
import { CourseScale, educationLabels } from "../../components/molecules/CourseScale/CourseScale";
import { ParticipantEditDialog } from "../../components/organisms";
import { useAuth } from "../../hooks/useAuth";
import { useTableState } from "../../hooks/useTableState";
import { showToast } from "../../utils/toast";
import { facultyLabels, facultyShortLabels } from "../../constants/faculties";
import { DataTable, SortRow, TableFilters, applyFilters, matchesSearch, type DataTableColumn } from "../../components/molecules/DataTable";

const chatLabel = (title: string) =>
  title.toLocaleUpperCase("ru-RU").includes("ФЛУД") ? "Флуд" : "Важное";

const facultyOptions = Object.entries(facultyLabels).map(([value, label]) => ({ value, label }));
const educationOptions = Object.entries(educationLabels).map(([value, label]) => ({ value, label }));
const defaultSort = [{ key: "name", direction: "asc" as const }];

const day = 24 * 60 * 60 * 1000;
const formatDate = (at: number) => new Date(at).toLocaleDateString("ru-RU");

const ParticipantsPage = () => {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<ParticipantProfile[]>([]);
  const [chats, setChats] = useState<ParticipantChat[]>([]);
  const [canManageAll, setCanManageAll] = useState(false);
  const [editing, setEditing] = useState<ParticipantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const table = useTableState({ name: "participants", defaultSort });

  useEffect(() => {
    void fetchParticipants()
      .then((result) => {
        setParticipants(result.participants);
        setChats(result.chats);
        setCanManageAll(result.canManageAll);
      })
      .catch((cause) => setError(cause instanceof ApiError ? cause.message : "Не удалось загрузить участников."))
      .finally(() => setLoading(false));
  }, []);

  const save = async (draft: ParticipantProfile) => {
    try {
      const updated = await updateParticipant(draft.userId, draft);
      setParticipants((current) => current.map((item) => item.userId === updated.userId ? { ...item, ...updated } : item));
      setEditing(null);
      showToast.success("Профиль участника сохранён.");
    } catch (cause) {
      showToast.error(cause instanceof ApiError ? cause.message : "Не удалось сохранить профиль.");
    }
  };

  const columns: DataTableColumn<ParticipantProfile>[] = useMemo(() => [
    { key: "name", label: "Участник", hideable: false, width: 230, sortAccessor: (profile) => profile.name, searchAccessor: (profile) => `${profile.name} ${profile.telegramName} ${profile.username}`, csv: (profile) => profile.name, render: (profile) => <Link className="font-semibold text-text underline-offset-2 hover:text-primary hover:underline" to={`/participants/${profile.userId}`}>{profile.name}</Link> },
    { key: "telegramName", label: "Имя в Telegram", width: 190, sortAccessor: (profile) => profile.telegramName || null, csv: (profile) => profile.telegramName, render: (profile) => profile.telegramName || "—" },
    { key: "telegram", label: "Telegram", width: 150, sortAccessor: (profile) => profile.username || null, csv: (profile) => profile.username, render: (profile) => profile.username ? <a className="text-primary underline-offset-2 hover:underline" href={`https://t.me/${profile.username}`} target="_blank" rel="noreferrer">@{profile.username}</a> : "—" },
    ...chats.map((chat): DataTableColumn<ParticipantProfile> => {
      const inChat = (profile: ParticipantProfile) => profile.chats.some((item) => item.chatId === chat.chatId && item.active);
      return {
        key: `chat-${chat.chatId}`, label: chatLabel(chat.title), align: "center", width: 100,
        sortAccessor: (profile) => inChat(profile) ? 1 : 0,
        filter: { kind: "boolean", get: inChat, yes: "Состоит", no: "Не состоит" },
        csv: (profile) => inChat(profile) ? "Да" : "Нет",
        render: (profile) => inChat(profile) ? "✓" : "—",
      };
    }),
    { key: "faculty", label: "Факультет", width: 210, sortAccessor: (profile) => profile.faculty ? facultyShortLabels[profile.faculty] : null, filter: { kind: "multiselect", get: (profile) => profile.faculty ? [profile.faculty] : [], options: facultyOptions }, csv: (profile) => profile.faculty ? facultyLabels[profile.faculty] : "", render: (profile) => profile.faculty ? facultyShortLabels[profile.faculty] : "—" },
    { key: "education", label: "Форма обучения", width: 180, sortAccessor: (profile) => profile.educationLevel ? educationLabels[profile.educationLevel] : null, filter: { kind: "multiselect", get: (profile) => profile.educationLevel ? [profile.educationLevel] : [], options: educationOptions }, csv: (profile) => profile.educationLevel ? educationLabels[profile.educationLevel] : "", render: (profile) => profile.educationLevel ? educationLabels[profile.educationLevel] : "—" },
    { key: "course", label: "Курс", width: 260, sortAccessor: (profile) => profile.course ?? null, filter: { kind: "range", get: (profile) => profile.course ?? null }, csv: (profile) => profile.course, render: (profile) => <CourseScale level={profile.educationLevel} course={profile.course} /> },
    { key: "birthday", label: "День рождения", width: 180, sortAccessor: (profile) => profile.birthday ?? null, filter: { kind: "dateRange", get: (profile) => profile.birthday ?? null }, csv: (profile) => profile.birthday, render: (profile) => profile.birthday ? new Date(`${profile.birthday}T00:00:00`).toLocaleDateString("ru-RU") : "—" },
    { key: "recent", label: "Активность", width: 170, sortAccessor: (profile) => profile.lastSeenAt, filter: { kind: "range", get: (profile) => Math.floor((Date.now() - profile.lastSeenAt) / day), unit: "дн. назад" }, csv: (profile) => formatDate(profile.lastSeenAt), render: (profile) => formatDate(profile.lastSeenAt) },
    { key: "actions", label: "Действия", hideable: false, align: "right", width: 150, render: (profile) =>
      (canManageAll || profile.userId === user?.id)
        ? <Button size="sm" variant="ghost" onClick={() => setEditing(profile)}>Изменить</Button>
        : null },
  ], [canManageAll, chats, user?.id]);

  const visibleParticipants = useMemo(
    () => applyFilters(participants, columns, table.filters).filter((profile) => matchesSearch(profile, columns, table.search)),
    [columns, participants, table.filters, table.search]);

  return (
    <PageContainer className="table-page" maxWidth={1600}>
      <Stack gap="lg">
        <div>
          <Heading level={1}>Участники</Heading>
          <Text tone="muted">Единый реестр экосистемы «Важное» и «Флуд».</Text>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {loading ? <Stack align="center"><LoadingSpinner label="Загружаем участников" /></Stack> :
          participants.length === 0 ? <EmptyState>Участники появятся после импорта или вступления в чат.</EmptyState> : (
            <Stack gap="sm">
              <TableFilters
                columns={columns}
                values={table.filters}
                onChange={table.setFilters}
                search={table.search}
                onSearch={table.setSearch}
                searchPlaceholder="Поиск по имени или Telegram"
                shown={visibleParticipants.length}
                total={participants.length}
                collapsed={table.collapsed}
                onCollapsed={table.setCollapsed}
                onReset={table.reset}
                views={table.views}
                onSaveView={table.saveView}
                onApplyView={table.applyView}
                onRemoveView={table.removeView}
                sortRow={<SortRow columns={columns} sort={table.sort} onSort={table.setSort} />}
              />
              <DataTable
                name="participants"
                label="Участники"
                rows={visibleParticipants}
                columns={columns}
                rowKey={(profile) => profile.userId}
                sort={table.sort}
                onSort={table.setSort}
                tiebreak={(profile) => profile.name}
                emptyText="По выбранным условиям никого не найдено."
                onResetFilters={table.reset}
              />
            </Stack>
          )}
        <ParticipantEditDialog participant={editing} onClose={() => setEditing(null)} onSave={save} />
      </Stack>
    </PageContainer>
  );
};

export default ParticipantsPage;
