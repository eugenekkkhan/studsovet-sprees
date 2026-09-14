import { useRef, useState } from "react";
import { IoCloseOutline } from "react-icons/io5";
import {
  Badge,
  Button,
  Card,
  Heading,
  IconButton,
  Inset,
  Notice,
  Stack,
  Text,
} from "../../../atoms";
import DeckSchemaDoc from "./DeckSchemaDoc";
import { useQuizGame } from "../../../../hooks/useQuizGame";
import type { Deck } from "../../../../types/quiz";
import {
  attachDeckMedia,
  deckIssues,
  deckStats,
  matchMediaFiles,
  parseDeckJson,
} from "../../../../utils/quizDeck";
import { showToast } from "../../../../utils/toast";
import { cardRadius } from "../../../../styles/tokens";

// The 40px close pill is the rounded child nearest the shell's corner, and the
// header it sits in is padded lg — so that is what the shell's radius is.
const DIALOG_RADIUS = cardRadius("lg", "md");

const isJson = (file: File) =>
  file.type === "application/json" || file.name.toLowerCase().endsWith(".json");

interface DeckImportDialogProps {
  onImported: (deck: Deck) => void;
}

/** Импорт колоды: схема, разбор файла и подгрузка приложенных картинок. */
const DeckImportDialog = ({ onImported }: DeckImportDialogProps) => {
  const { uploadMedia } = useQuizGame();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [jsonName, setJsonName] = useState("");
  const [parseError, setParseError] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  const reset = () => {
    setDeck(null);
    setMediaFiles([]);
    setJsonName("");
    setParseError("");
    setProgress(null);
  };

  const accept = async (files: File[]) => {
    if (files.length === 0) return;
    setParseError("");
    setMediaFiles((current) => [
      ...current.filter((file) => !files.some((next) => next.name === file.name)),
      ...files.filter((file) => !isJson(file)),
    ]);

    const source = files.find(isJson);
    if (!source) return;
    const parsed = parseDeckJson(await source.text());
    setJsonName(source.name);
    if (!parsed) {
      setDeck(null);
      setParseError(
        "Не похоже на колоду: нужен JSON-объект со списком rounds. Схема — ниже.",
      );
      return;
    }
    setDeck(parsed);
  };

  const runImport = async () => {
    if (!deck) return;
    setProgress({ done: 0, total: 0 });
    try {
      const result = await attachDeckMedia(
        deck,
        mediaFiles,
        uploadMedia,
        (done, total) => setProgress({ done, total }),
      );
      onImported(result.deck);
      showToast.success(
        result.uploaded > 0
          ? `Колода «${result.deck.name}» импортирована, файлов загружено: ${result.uploaded}.`
          : `Колода «${result.deck.name}» импортирована.`,
      );
      if (result.missing.length > 0) {
        showToast.warning(
          `Не нашлось файлов: ${result.missing.slice(0, 3).join(", ")}${
            result.missing.length > 3 ? "…" : ""
          }`,
        );
      }
      dialogRef.current?.close();
      reset();
    } catch (cause) {
      setParseError(
        cause instanceof Error ? cause.message : "Не удалось загрузить файлы колоды.",
      );
    }
    setProgress(null);
  };

  const stats = deck ? deckStats(deck) : null;
  const errors = deck ? deckIssues(deck).filter((i) => i.level === "error") : [];
  const media = deck ? matchMediaFiles(deck, mediaFiles) : { matched: [], missing: [] };
  const busy = progress !== null;

  return (
    <>
      <Button size="sm" variant="neutral" onClick={() => dialogRef.current?.showModal()}>
        Импорт JSON
      </Button>

      <dialog
        ref={dialogRef}
        aria-label="Импорт колоды"
        className="m-auto w-[min(94vw,760px)] max-w-none border-0 bg-transparent p-0 backdrop:bg-black/45"
        onClick={(event) => {
          if (event.target === event.currentTarget && !busy) {
            event.currentTarget.close();
          }
        }}
        onClose={reset}
      >
        <Card
          padding="none"
          radius={DIALOG_RADIUS}
          clip
          className="flex max-h-[88vh] flex-col shadow-xl"
        >
          <Inset
            row
            padding="lg"
            className="shrink-0 items-center justify-between gap-sm border-b border-border"
          >
            <Heading level={2} size={22}>
              Импорт колоды
            </Heading>
            <IconButton
              label="Закрыть импорт"
              className="shrink-0"
              disabled={busy}
              onClick={() => dialogRef.current?.close()}
            >
              <IoCloseOutline aria-hidden />
            </IconButton>
          </Inset>

          {/* The scroll box is sized by flex, not by height:100% — a percentage
              height does not resolve against a flex-basis:0 parent, which is why
              this panel used to grow past the dialog instead of scrolling. */}
          <div className="flex min-h-0 flex-1 flex-col px-sm">
            <Inset
              padding="md"
              className="scroll-panel scroll-panel-even min-h-0 flex-1 overflow-y-auto"
            >
            <Stack gap="md">
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void accept([...event.dataTransfer.files]);
                }}
                // Плоская зона: рамка и скругление здесь ничего не объясняли,
                // а только спорили с углом самого диалога. Ронять файлы можно
                // по-прежнему сюда — просто без коробки вокруг.
                className="py-lg text-center"
              >
                <Stack gap="sm" align="center">
                  <Text as="p" weight={600}>
                    Перетащите сюда JSON колоды и картинки к ней
                  </Text>
                  <Text as="p" size="sm" tone="muted">
                    Файлы подхватятся по имени из <code>media.url</code>: «cat.png» в
                    колоде найдёт файл cat.png среди выбранных.
                  </Text>
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept=".json,application/json,image/*,audio/*"
                    className="hidden"
                    onChange={(event) => {
                      void accept([...(event.target.files ?? [])]);
                      event.target.value = "";
                    }}
                  />
                  <Button disabled={busy} onClick={() => inputRef.current?.click()}>
                    Выбрать файлы
                  </Button>
                </Stack>
              </div>

              {parseError && <Notice tone="danger">{parseError}</Notice>}

              {deck && stats && (
                <Card padding="md" tone="primary">
                  <Stack gap="sm">
                    <Stack direction="row" gap="xs" align="center" wrap>
                      <Text weight={600}>{deck.name}</Text>
                      <Badge tone="neutral">{jsonName}</Badge>
                      {errors.length > 0 ? (
                        <Badge tone="danger">ошибок: {errors.length}</Badge>
                      ) : (
                        <Badge tone="success">готова к игре</Badge>
                      )}
                    </Stack>

                    <Text size="sm" tone="muted">
                      Раундов: {stats.rounds} · тем: {stats.themes} · клеток:{" "}
                      {stats.questions} · спецвопросов: {stats.specials} · финальных тем:{" "}
                      {stats.finalThemes}
                      {stats.incomplete > 0 ? ` · без текста или ответа: ${stats.incomplete}` : ""}
                    </Text>

                    {errors.length > 0 && (
                      <Text size="sm" tone="danger">
                        {errors[0].message}
                        {errors.length > 1 ? ` (и ещё ${errors.length - 1})` : ""} — импорт
                        пройдёт, но в игру такую колоду не пустят.
                      </Text>
                    )}

                    {media.matched.length + media.missing.length > 0 && (
                      <Text size="sm" tone={media.missing.length > 0 ? "danger" : "success"}>
                        Файлов к загрузке: {media.matched.length}
                        {media.missing.length > 0
                          ? ` · не приложено: ${media.missing.slice(0, 4).join(", ")}${
                              media.missing.length > 4 ? "…" : ""
                            }`
                          : ""}
                      </Text>
                    )}

                    {mediaFiles.length > 0 && (
                      <Text size="sm" tone="muted">
                        Выбрано файлов: {mediaFiles.length} (
                        {mediaFiles.map((file) => file.name).slice(0, 4).join(", ")}
                        {mediaFiles.length > 4 ? "…" : ""})
                      </Text>
                    )}

                    <Stack direction="row" gap="sm" wrap align="center">
                      <Button loading={busy} disabled={busy} onClick={() => void runImport()}>
                        {busy
                          ? `Загружаем файлы ${progress?.done ?? 0}/${progress?.total ?? 0}`
                          : "Импортировать"}
                      </Button>
                      <Button variant="ghost" disabled={busy} onClick={reset}>
                        Выбрать другой файл
                      </Button>
                    </Stack>
                  </Stack>
                </Card>
              )}

              <details open={!deck}>
                <summary className="cursor-pointer font-semibold">Схема файла</summary>
                <div className="pt-md">
                  <DeckSchemaDoc />
                </div>
              </details>
              </Stack>
            </Inset>
          </div>
        </Card>
      </dialog>
    </>
  );
};

export type { DeckImportDialogProps };
export default DeckImportDialog;
