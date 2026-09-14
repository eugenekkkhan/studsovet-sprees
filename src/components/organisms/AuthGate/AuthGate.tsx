import { useState, type FormEvent, type ReactNode } from "react";
import {
  Button,
  Card,
  Heading,
  Input,
  LoadingSpinner,
  Notice,
  Stack,
  Text,
} from "../../atoms";
import { useAuth } from "../../../hooks/useAuth";
import { insideTelegram } from "../../../api/telegram";
import TelegramLoginButton from "./TelegramLoginButton";

const Screen = ({ children }: { children: ReactNode }) => (
  // Класс виден снаружи: пока вход не состоялся, шапки нет, и странице незачем
  // держать под неё место — правило лежит в index.css рядом с такими же.
  <div className="auth-screen flex min-h-[70vh] items-center justify-center p-lg">
    <Card padding="lg" className="w-full max-w-[420px]">
      <Stack gap="md">{children}</Stack>
    </Card>
  </div>
);

/** Вход по имени: нужен, пока бота нет или приложение крутится локально. */
const DeveloperForm = () => {
  const { signInAsDeveloper } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await signInAsDeveloper(name);
    } catch {
      // Сообщение уже показано провайдером.
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit}>
      <Stack gap="sm">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Как вас зовут"
          autoFocus
        />
        <Button type="submit" block disabled={busy}>
          {busy ? "Входим…" : "Войти"}
        </Button>
      </Stack>
    </form>
  );
};

const TesterForm = () => {
  const { signInAsTester } = useAuth();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await signInAsTester(key, "Тестировщик");
    } catch {
      // Сообщение уже показано провайдером.
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit}>
      <Stack gap="sm">
        <Input
          type="password"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="Ключ тестового входа"
          autoComplete="off"
        />
        <Button type="submit" block disabled={busy || !key.trim()}>
          {busy ? "Входим…" : "Тестовый вход"}
        </Button>
      </Stack>
    </form>
  );
};

/**
 * Пускает внутрь только вошедшего. Открытые экраны участников — доска, капитан,
 * пульт — этой стеной не закрыты: туда входят по ключу комнаты.
 */
const AuthGate = ({ children }: { children: ReactNode }) => {
  const { status, config, error, retry } = useAuth();

  if (status === "authorized") return <>{children}</>;

  if (status === "loading") {
    return (
      <Screen>
        <Stack gap="sm" align="center">
          <LoadingSpinner size="lg" label="Проверяем доступ" />
          <Text tone="muted">Проверяем доступ…</Text>
        </Stack>
      </Screen>
    );
  }

  if (status === "offline") {
    return (
      <Screen>
        <Heading level={2}>Сервер не отвечает</Heading>
        <Notice tone="error">{error}</Notice>
        <Button onClick={retry} block>
          Попробовать снова
        </Button>
      </Screen>
    );
  }

  if (status === "denied") {
    return (
      <Screen>
        <Heading level={2}>Доступа пока нет</Heading>
        <Notice tone="warning">{error}</Notice>
        {config?.chats.length ? (
          <Stack gap="2xs">
            <Text size="sm" tone="muted">
              Доступ открыт участникам чатов:
            </Text>
            {config.chats.map((chat) => (
              <Text key={chat.id} size="sm">
                • {chat.title}
              </Text>
            ))}
          </Stack>
        ) : (
          <Text size="sm" tone="muted">
            Бота ещё не добавили ни в один чат. Добавьте его в свой чат и
            напишите там /app.
          </Text>
        )}
        <Button onClick={retry} block>
          Проверить снова
        </Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <Heading level={2}>
        {config?.requiresTelegram ? "Вход через Telegram" : "Вход в приложение"}
      </Heading>
      <Text tone="muted" size="sm">
        Колоды хранятся за автором, поэтому приложение открывается из Telegram —
        так сервер понимает, чьи они.
      </Text>
      {error && <Notice tone="warning">{error}</Notice>}
      {config?.botUsername && (
        insideTelegram() ? (
          <Button
            onClick={() =>
              window.open(`https://t.me/${config.botUsername}`, "_blank", "noopener")
            }
            block
          >
            Открыть бота @{config.botUsername}
          </Button>
        ) : (
          <TelegramLoginButton botUsername={config.botUsername} />
        )
      )}
      {config?.devAuth && (
        <>
          <Text size="sm" tone="muted">
            Локальный вход — без Telegram, колоды всё равно лягут на сервер.
          </Text>
          <DeveloperForm />
        </>
      )}
      {config?.testAuth && (
        <>
          <Text size="sm" tone="muted">
            Временный доступ для проверки публичной сборки.
          </Text>
          <TesterForm />
        </>
      )}
      <Button variant="ghost" onClick={retry} block>
        Повторить вход
      </Button>
    </Screen>
  );
};

export default AuthGate;
