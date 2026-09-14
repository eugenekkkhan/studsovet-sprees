import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminDashboard,
  grantAdmin,
  revokeAdmin,
  setSessionCreationBlocked,
  setFeatureEnabled,
  terminateGameSession,
  type AdminDashboard,
  type FeatureKey,
} from "../../api/adminApi";
import { ApiError } from "../../api/http";
import { Button, Card, EmptyState, Heading, LoadingSpinner, Notice, Select, Stack, Text } from "../../components/atoms";
import { PageContainer } from "../../components/templates";
import { showToast } from "../../utils/toast";

const featureLabels: Record<FeatureKey, string> = {
  events: "Мероприятия",
  rating: "Рейтинг",
  participants: "Участники",
  roulette: "Колесо удачи",
  fieldOfMiracles: "Поле чудес",
  quiz: "Своя игра",
};

const gameLabels = {
  quiz: "Своя игра",
  fieldOfMiracles: "Поле чудес",
} as const;

const dateTime = (value: number) => new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
}).format(new Date(value));

const AdminPage = () => {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [selected, setSelected] = useState("");
  const [restrictionTarget, setRestrictionTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () => void fetchAdminDashboard()
      .then(setData)
      .catch((cause) => setError(cause instanceof ApiError ? cause.message : "Не удалось открыть админку."));
    load();
    const timer = window.setInterval(load, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const adminIds = useMemo(() => new Set(data?.admins.map((item) => item.userId)), [data]);
  const candidates = data?.candidates.filter((item) => !adminIds.has(item.userId)) ?? [];
  const blockedIds = useMemo(() => new Set(data?.blockedCreatorIds ?? []), [data]);
  const restrictionCandidates = data?.candidates.filter((item) => !blockedIds.has(item.userId)) ?? [];

  const changeCreationAccess = async (userId: number, blocked: boolean) => {
    if (!data) return;
    setBusy(true);
    try {
      await setSessionCreationBlocked(userId, blocked);
      setData({
        ...data,
        blockedCreatorIds: blocked
          ? [...data.blockedCreatorIds, userId]
          : data.blockedCreatorIds.filter((id) => id !== userId),
      });
      setRestrictionTarget("");
      showToast.success(blocked ? "Создание комнат запрещено." : "Создание комнат снова разрешено.");
    } catch (cause) {
      showToast.error(cause instanceof ApiError ? cause.message : "Не удалось изменить ограничение.");
    } finally {
      setBusy(false);
    }
  };

  const terminate = async (game: "quiz" | "fieldOfMiracles", code: string) => {
    if (!data) return;
    setBusy(true);
    try {
      await terminateGameSession(game, code);
      setData({ ...data, sessions: data.sessions.filter((session) => session.game !== game || session.code !== code) });
      showToast.success("Игровая сессия завершена.");
    } catch (cause) {
      showToast.error(cause instanceof ApiError ? cause.message : "Не удалось завершить сессию.");
    } finally {
      setBusy(false);
    }
  };

  const changeFeature = async (key: FeatureKey, enabled: boolean) => {
    if (!data) return;
    setBusy(true);
    try {
      const result = await setFeatureEnabled(key, enabled);
      setData({ ...data, features: result.features });
      window.dispatchEvent(new Event("sprees:features-changed"));
      showToast.success(enabled ? "Вкладка включена." : "Вкладка скрыта для пользователей.");
    } catch (cause) {
      showToast.error(cause instanceof ApiError ? cause.message : "Не удалось изменить вкладку.");
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      setData(await grantAdmin(Number(selected)));
      setSelected("");
      showToast.success("Администратор добавлен.");
    } catch (cause) {
      showToast.error(cause instanceof ApiError ? cause.message : "Не удалось добавить администратора.");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <PageContainer maxWidth={860}><Notice tone="error">{error}</Notice></PageContainer>;
  if (!data) return <PageContainer maxWidth={860}><Stack align="center"><LoadingSpinner label="Загружаем админку" /></Stack></PageContainer>;

  return (
    <PageContainer maxWidth={860}>
      <Stack gap="lg">
        <div>
          <Heading level={1}>Админка</Heading>
          <Text tone="muted">Управление доступными разделами и администраторами платформы.</Text>
        </div>

        <Card padding="md">
          <Stack gap="sm">
            <Heading level={2}>Вкладки для пользователей</Heading>
            {(Object.keys(featureLabels) as FeatureKey[]).map((key) => (
              <Stack key={key} direction="row" gap="sm" align="center" justify="between">
                <Text weight={600}>{featureLabels[key]}</Text>
                <Button
                  size="sm"
                  variant={data.features[key] ? "success" : "neutral"}
                  disabled={busy}
                  onClick={() => void changeFeature(key, !data.features[key])}
                >
                  {data.features[key] ? "Включена" : "Выключена"}
                </Button>
              </Stack>
            ))}
          </Stack>
        </Card>

        <Card padding="md">
          <Stack gap="md">
            <Stack direction="row" align="center" justify="between" gap="sm" wrap>
              <div>
                <Heading level={2}>Активные игровые сессии</Heading>
                <Text tone="muted">Список обновляется автоматически раз в 15 секунд.</Text>
              </div>
              <Button size="sm" variant="neutral" disabled={busy} onClick={() => void fetchAdminDashboard().then(setData)}>
                Обновить
              </Button>
            </Stack>
            {data.sessions.length === 0 ? <EmptyState>Активных комнат нет.</EmptyState> : (
              <Stack gap="sm">
                {data.sessions.map((session) => (
                  <Card key={`${session.game}:${session.code}`} padding="sm" tone="muted">
                    <Stack direction="row" align="center" justify="between" gap="sm" wrap>
                      <Stack gap="2xs">
                        <Text weight={700}>{gameLabels[session.game]} · {session.code}</Text>
                        <Text size="sm">
                          {session.ownerUsername ? `@${session.ownerUsername} · ` : ""}{session.ownerName} · команд: {session.teamCount}
                        </Text>
                        <Text size="xs" tone="muted">
                          Создана {dateTime(session.createdAt)} · активность {dateTime(session.lastActivityAt)}
                        </Text>
                      </Stack>
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => void terminate(session.game, session.code)}>
                        Завершить
                      </Button>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>

        <Card padding="md">
          <Stack gap="md">
            <div>
              <Heading level={2}>Запрет создания игровых сессий</Heading>
              <Text tone="muted">Ограничение действует одновременно на «Свою игру» и «Поле чудес».</Text>
            </div>
            <Stack direction="row" gap="sm" align="center" wrap>
              <Select className="min-w-[260px] flex-1" value={restrictionTarget} onChange={(event) => setRestrictionTarget(event.target.value)}>
                <option value="">Выберите участника</option>
                {restrictionCandidates.map((person) => (
                  <option key={person.userId} value={person.userId}>
                    {person.username ? `@${person.username} · ` : ""}{person.name}
                  </option>
                ))}
              </Select>
              <Button variant="danger" disabled={!restrictionTarget || busy} onClick={() => void changeCreationAccess(Number(restrictionTarget), true)}>
                Запретить
              </Button>
            </Stack>
            {data.blockedCreatorIds.length === 0 ? <EmptyState>Ограничений нет.</EmptyState> : (
              <Stack gap="xs">
                {data.blockedCreatorIds.map((userId) => {
                  const person = data.candidates.find((item) => item.userId === userId);
                  return (
                    <Stack key={userId} direction="row" align="center" justify="between" gap="sm">
                      <Text>{person?.username ? `@${person.username} · ` : ""}{person?.name ?? `id${userId}`}</Text>
                      <Button size="sm" variant="neutral" disabled={busy} onClick={() => void changeCreationAccess(userId, false)}>
                        Разрешить
                      </Button>
                    </Stack>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </Card>

        <Card padding="md">
          <Stack gap="md">
            <Heading level={2}>Администраторы</Heading>
            <Stack direction="row" gap="sm" align="center" wrap>
              <Select className="min-w-[260px] flex-1" value={selected} onChange={(event) => setSelected(event.target.value)}>
                <option value="">Выберите участника</option>
                {candidates.map((person) => (
                  <option key={person.userId} value={person.userId}>
                    {person.username ? `@${person.username} · ` : ""}{person.name}
                  </option>
                ))}
              </Select>
              <Button disabled={!selected || busy} onClick={() => void add()}>Добавить</Button>
            </Stack>
            {data.admins.length === 0 ? <EmptyState>Назначенных администраторов нет.</EmptyState> : (
              <Stack gap="xs">
                {data.admins.map((person) => (
                  <Stack key={person.userId} direction="row" gap="sm" align="center" justify="between">
                    <Text>{person.username ? `@${person.username} · ` : ""}{person.name}</Text>
                    {person.root ? (
                      <Text size="xs" tone="muted">Корневой администратор</Text>
                    ) : (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy}
                        onClick={() => void (async () => {
                          setBusy(true);
                          try { setData(await revokeAdmin(person.userId)); }
                          finally { setBusy(false); }
                        })()}
                      >
                        Убрать
                      </Button>
                    )}
                  </Stack>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>
      </Stack>
    </PageContainer>
  );
};

export default AdminPage;
