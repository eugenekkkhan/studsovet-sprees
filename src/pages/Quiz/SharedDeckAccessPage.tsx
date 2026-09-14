import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { accessDeckShare, copyDeckShare } from "../../api/decksApi";
import { ApiError } from "../../api/http";
import {
  Badge,
  Button,
  Card,
  Heading,
  LoadingSpinner,
  Notice,
  Stack,
  Text,
} from "../../components/atoms";
import { PageContainer } from "../../components/templates";
import type { SharedDeckView } from "../../types/quiz";
import { deckStats, hasBlockingIssues } from "../../utils/quizDeck";
import { showToast } from "../../utils/toast";

/**
 * Колода, открытая по секретной ссылке. Отсюда её можно посмотреть, запустить
 * у себя ведущим и — если автор разрешил — забрать независимую копию.
 * Оригинал остаётся у автора: правок этот экран не предлагает.
 */
const SharedDeckAccessPage = () => {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<SharedDeckView | null>(null);
  const [allowCopy, setAllowCopy] = useState(false);
  const [error, setError] = useState("");
  const [copying, setCopying] = useState(false);
  // Каждый заход по коду сервер считает открытием, поэтому запрашиваем колоду
  // ровно один раз на код: повторный прогон эффекта не должен накручивать счёт.
  const requested = useRef("");

  useEffect(() => {
    if (requested.current === code) return;
    requested.current = code;

    let active = true;
    void accessDeckShare(code)
      .then((result) => {
        if (!active) return;
        setEntry(result.deck);
        setAllowCopy(result.allowCopy);
      })
      .catch((cause) => {
        if (!active) return;
        setError(
          cause instanceof ApiError ? cause.message : "Не удалось открыть колоду.",
        );
      });
    return () => {
      active = false;
    };
  }, [code]);

  const copy = async () => {
    setCopying(true);
    try {
      const saved = await copyDeckShare(code);
      showToast.success(`Колода «${saved.deck.name}» добавлена в вашу библиотеку.`);
      void navigate("/quiz");
    } catch (cause) {
      showToast.error(
        cause instanceof ApiError ? cause.message : "Не удалось скопировать колоду.",
      );
    } finally {
      setCopying(false);
    }
  };

  // Колода уходит в игру на консоли ведущего: там живёт комната и сокет.
  const play = () => {
    void navigate(`/quiz?share=${encodeURIComponent(code)}`);
  };

  const stats = entry ? deckStats(entry.deck) : null;
  const blocked = entry ? hasBlockingIssues(entry.deck) : false;

  return (
    <PageContainer maxWidth={720}>
      {!entry && !error && (
        <Stack align="center">
          <LoadingSpinner label="Открываем колоду" />
        </Stack>
      )}

      {error && (
        <Stack gap="md">
          <Notice tone="danger">{error}</Notice>
          <Button variant="ghost" onClick={() => void navigate("/quiz")}>
            Вернуться в «Свою игру»
          </Button>
        </Stack>
      )}

      {entry && stats && (
        <Card padding="lg">
          <Stack gap="md" align="center">
            <Badge tone="neutral">доступ по ссылке</Badge>
            <Heading level={1} align="center">
              {entry.deck.name}
            </Heading>
            <Text tone="muted" align="center">
              Автор: {entry.deck.author || entry.author.name}
            </Text>
            <Text align="center">
              {stats.rounds} раунда · {stats.themes} тем · {stats.questions} вопросов
            </Text>

            {stats.incomplete > 0 && (
              <Notice tone="warning">
                В колоде не дописано элементов: {stats.incomplete}.
              </Notice>
            )}

            <Stack gap="xs" className="w-full">
              <Button block disabled={blocked} onClick={play}>
                Запустить в своей игре
              </Button>
              {allowCopy ? (
                <Button block variant="neutral" loading={copying} onClick={() => void copy()}>
                  Забрать копию себе
                </Button>
              ) : (
                <Notice tone="info" size="sm">
                  Автор открыл колоду только для просмотра и игры — копировать её нельзя.
                </Notice>
              )}
              <Button block variant="ghost" onClick={() => void navigate("/quiz")}>
                Перейти в «Свою игру»
              </Button>
            </Stack>

            <Text as="p" size="xs" tone="muted" align="center">
              Правки останутся у автора: по ссылке колода доступна только на чтение.
              {allowCopy && " Копия будет вашей — её можно менять как угодно."}
            </Text>
          </Stack>
        </Card>
      )}
    </PageContainer>
  );
};

export default SharedDeckAccessPage;
