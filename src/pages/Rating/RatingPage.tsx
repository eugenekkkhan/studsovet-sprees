import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { Badge, EmptyState, Heading, LoadingSpinner, Notice, Stack, Text } from "../../components/atoms";
import { PageContainer } from "../../components/templates";
import { fetchReliability, type ReliabilityProfile } from "../../api/eventsApi";
import { ApiError } from "../../api/http";
import { facultyLabels } from "../../constants/faculties";
import { ratingPlaces } from "../../utils/rating";
import { useTableState } from "../../hooks/useTableState";
import { DataTable, SortRow, TableFilters, applyFilters, matchesSearch, type DataTableColumn } from "../../components/molecules/DataTable";

const reasonLabels = {
  attended: "Участие подтверждено",
  late_cancel: "Поздний отказ",
  no_show: "Неявка",
};

const facultyOptions = Object.entries(facultyLabels).map(([value, label]) => ({ value, label }));
const reasonOptions = Object.entries(reasonLabels).map(([value, label]) => ({ value, label }));
const defaultSort = [{ key: "rating", direction: "desc" as const }];

const RatingPage = () => {
  const [profiles, setProfiles] = useState<ReliabilityProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadingRef = useRef(false);
  const table = useTableState({ name: "rating", defaultSort });

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const result = await fetchReliability();
      setProfiles(result.profiles);
      setError("");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось загрузить рейтинг.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    const refreshVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [load]);

  // Место — ранг по всему рейтингу, а не номер строки на экране: иначе фильтр
  // по факультету поднимал бы каждого в первую десятку.
  const places = useMemo(() => ratingPlaces(profiles), [profiles]);

  const columns: DataTableColumn<ReliabilityProfile>[] = useMemo(() => [
    { key: "place", label: "Место", numeric: true, width: 85, sortAccessor: (profile) => places.get(profile.userId) ?? null, csv: (profile) => places.get(profile.userId) ?? "", render: (profile) => places.get(profile.userId) ?? "—" },
    { key: "name", label: "Участник", hideable: false, width: 220, sortAccessor: (profile) => profile.name, searchAccessor: (profile) => `${profile.name} ${profile.username ?? ""}`, csv: (profile) => profile.name, render: (profile) => <Stack gap="2xs"><Link className="font-semibold text-text underline-offset-2 hover:text-primary hover:underline" to={`/participants/${profile.userId}`}>{profile.name}</Link>{profile.username && <a className="text-xs text-primary hover:underline" href={`https://t.me/${profile.username}`} target="_blank" rel="noreferrer">@{profile.username}</a>}</Stack> },
    { key: "rating", label: "Рейтинг", numeric: true, width: 125, sortAccessor: (profile) => profile.rating ?? null, filter: { kind: "range", get: (profile) => profile.rating ?? null }, csv: (profile) => profile.rating ?? 0, render: (profile) => <Badge tone="primary">{profile.rating ?? 0}</Badge> },
    { key: "eventPoints", label: "Баллы мероприятий", numeric: true, width: 170, sortAccessor: (profile) => profile.eventPoints ?? null, filter: { kind: "range", get: (profile) => profile.eventPoints ?? null }, csv: (profile) => profile.eventPoints ?? 0, render: (profile) => profile.eventPoints ?? 0 },
    { key: "reliability", label: "Надёжность", numeric: true, width: 145, sortAccessor: (profile) => profile.reliability, filter: { kind: "range", get: (profile) => profile.reliability, unit: "из 100" }, csv: (profile) => profile.reliability, render: (profile) => <Badge tone={profile.reliability >= 80 ? "success" : profile.reliability < 50 ? "danger" : "neutral"}>{profile.reliability}/100</Badge> },
    { key: "messages", label: "Сообщения", numeric: true, width: 130, sortAccessor: (profile) => profile.activity?.messages ?? null, filter: { kind: "range", get: (profile) => profile.activity?.messages ?? null }, csv: (profile) => profile.activity?.messages ?? 0, render: (profile) => profile.activity?.messages ?? 0 },
    { key: "reactions", label: "Реакции получил", numeric: true, width: 155, sortAccessor: (profile) => profile.activity?.reactionsReceived ?? null, filter: { kind: "range", get: (profile) => profile.activity?.reactionsReceived ?? null }, csv: (profile) => profile.activity?.reactionsReceived ?? 0, render: (profile) => profile.activity?.reactionsReceived ?? 0 },
    { key: "reactionsGiven", label: "Реакции поставил", numeric: true, width: 165, sortAccessor: (profile) => profile.activity?.reactionsGiven ?? null, filter: { kind: "range", get: (profile) => profile.activity?.reactionsGiven ?? null }, csv: (profile) => profile.activity?.reactionsGiven ?? 0, render: (profile) => profile.activity?.reactionsGiven ?? 0 },
    { key: "streak", label: "Стрик", numeric: true, width: 115, sortAccessor: (profile) => profile.activity?.currentStreak ?? null, filter: { kind: "range", get: (profile) => profile.activity?.currentStreak ?? null, unit: "дн." }, csv: (profile) => profile.activity?.currentStreak ?? 0, render: (profile) => <Badge tone={(profile.activity?.currentStreak ?? 0) >= 7 ? "success" : "neutral"}>{profile.activity?.currentStreak ?? 0} дн.</Badge> },
    { key: "faculty", label: "Факультет", width: 200, sortAccessor: (profile) => profile.faculty ? facultyLabels[profile.faculty] : null, filter: { kind: "multiselect", get: (profile) => profile.faculty ? [profile.faculty] : [], options: facultyOptions }, csv: (profile) => profile.faculty ? facultyLabels[profile.faculty] : "", render: (profile) => profile.faculty ? facultyLabels[profile.faculty].split(" — ")[0] : "—" },
    { key: "course", label: "Курс", numeric: true, width: 90, sortAccessor: (profile) => profile.course ?? null, filter: { kind: "range", get: (profile) => profile.course ?? null }, csv: (profile) => profile.course, render: (profile) => profile.course ?? "—" },
    { key: "recovery", label: "Восстановление", numeric: true, width: 160, sortAccessor: (profile) => profile.recoveryProgress, csv: (profile) => profile.recoveryProgress, render: (profile) => `${profile.recoveryProgress}/3` },
    // Сортируем по дате изменения, а отбираем по его причине: «когда» и «что»
    // — единственное, что в этой колонке упорядочивается и отбирается осмысленно.
    { key: "latest", label: "Последнее изменение", width: 230, sortAccessor: (profile) => profile.entries?.at(-1)?.createdAt ?? null, filter: { kind: "select", get: (profile) => profile.entries?.at(-1)?.reason ?? null, options: reasonOptions }, csv: (profile) => { const latest = profile.entries?.at(-1); return latest ? `${reasonLabels[latest.reason]} (${latest.delta >= 0 ? "+" : ""}${latest.delta})` : ""; }, render: (profile) => { const latest = profile.entries?.at(-1); return latest ? `${reasonLabels[latest.reason]} (${latest.delta >= 0 ? "+" : ""}${latest.delta})` : "—"; } },
  ], [places]);

  const visibleProfiles = useMemo(
    () => applyFilters(profiles, columns, table.filters).filter((profile) => matchesSearch(profile, columns, table.search)),
    [columns, profiles, table.filters, table.search]);

  return (
    <PageContainer className="table-page" maxWidth={1600}>
      <Stack gap="lg">
        <div>
          <Heading level={1}>Рейтинг участников</Heading>
          <Text tone="muted">Баллы за мероприятия с поправкой на срочность, курс и надёжность.</Text>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {loading ? <Stack align="center"><LoadingSpinner label="Загружаем рейтинг" /></Stack> :
          profiles.length === 0 ? <EmptyState>Рейтинг появится после завершения первого мероприятия.</EmptyState> : (
            <Stack gap="sm">
              <TableFilters
                columns={columns}
                values={table.filters}
                onChange={table.setFilters}
                search={table.search}
                onSearch={table.setSearch}
                searchPlaceholder="Поиск по имени или Telegram"
                shown={visibleProfiles.length}
                total={profiles.length}
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
                name="rating"
                label="Рейтинг участников"
                rows={visibleProfiles}
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
      </Stack>
    </PageContainer>
  );
};

export default RatingPage;
