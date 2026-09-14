import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Button,
  Card,
  Heading,
  Input,
  LoadingSpinner,
  Stack,
  Text,
} from "../../components/atoms";
import FieldGameProvider, {
  type RemoteHostCredentials,
} from "../../context/FieldGameProvider";
import { useGameContext } from "../../hooks/useGameContext";
import { FieldOfMiraclesHostContent } from "./FieldOfMiraclesPage";


const RemoteHostGate = ({ onReset }: { onReset: () => void }) => {
  const { connectionStatus, connectionError } = useGameContext();

  if (connectionStatus === "connecting") {
    return (
      <Card padding="lg">
        <Stack direction="row" gap="xs" align="center" justify="center">
          <LoadingSpinner size="sm" />
          <Text align="center" role="status">
            Подключаем пульт ведущего…
          </Text>
        </Stack>
      </Card>
    );
  }

  if (connectionStatus === "disconnected") {
    return (
      <Card padding="lg" tone="primary">
        <Stack gap="md" align="center">
          <Heading level={1} size={26} align="center">
            Не удалось подключить пульт
          </Heading>
          <Text tone="danger" align="center">
            {connectionError ?? "Проверьте код комнаты и ключ ведущего."}
          </Text>
          <Button variant="ghost" onClick={onReset}>
            Ввести данные заново
          </Button>
        </Stack>
      </Card>
    );
  }

  return <FieldOfMiraclesHostContent />;
};

/** Full host console authenticated by a shareable key on a second device. */
const FieldOfMiraclesRemoteHostPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const roomFromUrl = searchParams.get("room")?.trim().toUpperCase() ?? "";
  const keyFromUrl = searchParams.get("key")?.trim().toUpperCase() ?? "";
  const [roomDraft, setRoomDraft] = useState(roomFromUrl);
  const [keyDraft, setKeyDraft] = useState(keyFromUrl);
  const credentials = useMemo<RemoteHostCredentials | undefined>(
    () =>
      roomFromUrl && keyFromUrl
        ? { code: roomFromUrl, hostJoinKey: keyFromUrl }
        : undefined,
    [keyFromUrl, roomFromUrl],
  );

  if (!credentials) {
    return (
      <main className="field-remote-host-page mx-auto w-full max-w-[480px]">
        {/* The lg submit button holds the bottom corners. */}
        <Card padding="lg" content="lg">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const room = roomDraft.trim().toUpperCase();
              const key = keyDraft.trim().toUpperCase();
              if (room && key) setSearchParams({ room, key }, { replace: true });
            }}
          >
            <Stack gap="md">
              <Heading level={1} size={28} align="center">
                Пульт ведущего
              </Heading>
              <Text as="p" size="sm" tone="muted" align="center">
                Отсканируйте QR ведущего или введите данные с основного экрана.
              </Text>
              <Input
                autoFocus
                value={roomDraft}
                placeholder="Код комнаты"
                autoCapitalize="characters"
                onChange={(event) =>
                  setRoomDraft(event.target.value.toUpperCase())
                }
              />
              <Input
                value={keyDraft}
                placeholder="Ключ ведущего"
                autoCapitalize="characters"
                autoComplete="off"
                onChange={(event) => setKeyDraft(event.target.value.toUpperCase())}
              />
              <Button
                type="submit"
                size="lg"
                disabled={!roomDraft.trim() || !keyDraft.trim()}
              >
                Подключиться
              </Button>
            </Stack>
          </form>
        </Card>
      </main>
    );
  }

  return (
    <main className="field-remote-host-page w-full">
      <FieldGameProvider remoteCredentials={credentials}>
        <RemoteHostGate onReset={() => setSearchParams({}, { replace: true })} />
      </FieldGameProvider>
    </main>
  );
};

export default FieldOfMiraclesRemoteHostPage;
