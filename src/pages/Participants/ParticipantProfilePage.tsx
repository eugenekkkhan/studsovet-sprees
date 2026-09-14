import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { fetchParticipant, updateParticipant, type ParticipantProfile } from "../../api/participantsApi";
import { ApiError } from "../../api/http";
import { Button, Card, Heading, Input, LoadingSpinner, Notice, Select, Stack, Text } from "../../components/atoms";
import { CourseScale, educationCourseLimits, educationLabels } from "../../components/molecules/CourseScale/CourseScale";
import { PageContainer } from "../../components/templates";
import { showToast } from "../../utils/toast";
import { facultyLabels } from "../../constants/faculties";

const initials = (profile: ParticipantProfile) =>
  (profile.telegramName || profile.name).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("ru-RU");

const ParticipantProfilePage = () => {
  const userId = Number(useParams().id);
  const [profile, setProfile] = useState<ParticipantProfile | null>(null);
  const [draft, setDraft] = useState<ParticipantProfile | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetchParticipant(userId)
      .then((result) => {
        const [fallbackFirst = "", ...fallbackLast] = result.participant.name.split(/\s+/);
        const hydrated = {
          ...result.participant,
          firstName: result.participant.firstName || fallbackFirst,
          lastName: result.participant.lastName || fallbackLast.join(" "),
        };
        setProfile(hydrated);
        setDraft(hydrated);
        setCanEdit(result.canEdit);
      })
      .catch((cause) => setError(cause instanceof ApiError ? cause.message : "Не удалось открыть профиль."));
  }, [userId]);

  const save = async () => {
    if (!draft) return;
    try {
      const updated = await updateParticipant(draft.userId, draft);
      const next = { ...draft, ...updated };
      setProfile(next);
      setDraft(next);
      setEditing(false);
      showToast.success("Профиль сохранён.");
    } catch (cause) {
      showToast.error(cause instanceof ApiError ? cause.message : "Не удалось сохранить профиль.");
    }
  };

  if (error) return <PageContainer maxWidth={760}><Notice tone="error">{error}</Notice></PageContainer>;
  if (!profile || !draft) return <PageContainer maxWidth={760}><Stack align="center"><LoadingSpinner label="Загружаем профиль" /></Stack></PageContainer>;

  return (
    <PageContainer maxWidth={760}>
      <Stack gap="lg">
        <Link className="text-sm text-primary hover:underline" to="/participants">← Все участники</Link>
        <Card padding="lg">
          <Stack gap="lg" align="center">
            {profile.photoUrl ? (
              <img className="size-32 rounded-full border border-border object-cover" src={profile.photoUrl} alt="" />
            ) : (
              <div className="flex size-32 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
                {initials(profile)}
              </div>
            )}
            <Stack gap="xs" align="center">
              <Heading level={1} align="center">{profile.name}</Heading>
              {profile.telegramName && <Text tone="muted">В Telegram: {profile.telegramName}</Text>}
              {profile.username && <a className="text-primary hover:underline" href={`https://t.me/${profile.username}`} target="_blank" rel="noreferrer">@{profile.username}</a>}
            </Stack>

            {editing ? (
              <Stack gap="sm" block>
                <label className="grid gap-1 text-sm text-muted-foreground">Имя<Input value={draft.firstName} placeholder="Имя" aria-label="Имя" onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} /></label>
                <label className="grid gap-1 text-sm text-muted-foreground">Фамилия<Input value={draft.lastName} placeholder="Фамилия" aria-label="Фамилия" onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} /></label>
                <Select value={draft.faculty ?? ""} aria-label="Факультет" onChange={(event) => setDraft({ ...draft, faculty: event.target.value ? event.target.value as ParticipantProfile["faculty"] : null })}>
                  <option value="">Факультет не указан</option>
                  {Object.entries(facultyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
                <Select value={draft.educationLevel ?? ""} aria-label="Форма обучения" onChange={(event) => setDraft({ ...draft, educationLevel: event.target.value ? event.target.value as ParticipantProfile["educationLevel"] : null, course: null })}>
                  <option value="">Форма обучения</option>
                  {Object.entries(educationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
                <Select value={draft.course ?? ""} aria-label="Курс" disabled={!draft.educationLevel} onChange={(event) => setDraft({ ...draft, course: event.target.value ? Number(event.target.value) : null })}>
                  <option value="">Курс не указан</option>
                  {draft.educationLevel && Array.from({ length: educationCourseLimits[draft.educationLevel] }, (_, index) => index + 1).map((course) => <option key={course} value={course}>{course} курс</option>)}
                </Select>
                <Input type="date" value={draft.birthday ?? ""} aria-label="Дата рождения" onChange={(event) => setDraft({ ...draft, birthday: event.target.value || null })} />
                <Stack direction="row" gap="sm">
                  <Button onClick={() => void save()}>Сохранить</Button>
                  <Button variant="ghost" onClick={() => { setDraft(profile); setEditing(false); }}>Отмена</Button>
                </Stack>
              </Stack>
            ) : (
              <Stack gap="md" block>
                <Text><strong>Факультет:</strong> {profile.faculty ? facultyLabels[profile.faculty] : "не указан"}</Text>
                <Card padding="sm" tone="muted"><CourseScale level={profile.educationLevel} course={profile.course} /></Card>
                <Text><strong>День рождения:</strong> {profile.birthday ? new Date(`${profile.birthday}T00:00:00`).toLocaleDateString("ru-RU") : "не указан"}</Text>
                {canEdit && <Button onClick={() => setEditing(true)}>Редактировать профиль</Button>}
              </Stack>
            )}
          </Stack>
        </Card>
      </Stack>
    </PageContainer>
  );
};

export default ParticipantProfilePage;
