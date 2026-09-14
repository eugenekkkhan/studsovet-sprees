import { createContext } from "react";
import type { UploadedMedia } from "../api/mediaApi";
import type { HostCommand, HostGameState } from "../types/quiz";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export const EMPTY_HOST_STATE: HostGameState = {
  deck: null,
  teams: [],
  phase: "lobby",
  roundIndex: -1,
  playedQuestionIds: [],
  questionOutcomes: {},
  pickerTeamId: null,
  activeQuestion: null,
  bidding: null,
  final: null,
  settings: { penalty: true, falseStartLockMs: 2000, bidStep: 100 },
  statusMessage: "Подключаемся к игровому серверу…",
  statusTone: "info",
  history: [],
  undoAvailable: false,
  revision: 0,
  serverNow: 0,
};

export interface QuizGameContextType {
  game: HostGameState;
  sessionCode: string;
  /** Ссылка капитана: код комнаты плюс личный ключ команды. */
  captainUrl: (teamKey?: string) => string;
  hostJoinUrl: string;
  boardUrl: string;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  /** Пульт на втором устройстве: только там ответ показывается сразу. */
  isRemoteHost: boolean;
  send: (command: HostCommand) => void;
  /** Загружает картинку или звук в комнату и возвращает ссылку для колоды. */
  uploadMedia: (file: File) => Promise<UploadedMedia>;
}

const QuizGameContext = createContext<QuizGameContextType | null>(null);

export default QuizGameContext;
