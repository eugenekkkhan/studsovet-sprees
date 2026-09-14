import { getFortuneSector } from "../constants/fortuneSectors";
import type {
  FieldGameCoreState,
  FieldGameState,
  GameMessageTone,
  Sector,
  Team,
} from "../types/fieldOfMiracles";
import {
  countLetter,
  isPlayableLetter,
  isPuzzleComplete,
  normalizeLetter,
  normalizePuzzleText,
} from "../utils/fieldOfMiracles";

const MAX_UNDO_STEPS = 30;
const MAX_HISTORY_ENTRIES = 60;
export const STREAK_BONUS = 500;

export const createInitialGameState = (teams: Team[] = []): FieldGameState => ({
  teams,
  activeTeamId: teams[0]?.id ?? null,
  phase: "setup",
  round: 0,
  puzzle: null,
  currentSectorId: null,
  winnerTeamId: null,
  correctGuessStreak: 0,
  statusMessage: "Добавьте команды и подготовьте первый раунд.",
  statusTone: "info",
  history: [],
  spin: null,
  undoStack: [],
});

export type FieldGameAction =
  | { type: "ADD_TEAM"; team: Team }
  | { type: "REMOVE_TEAM"; teamId: string }
  | {
      type: "UPDATE_TEAM";
      teamId: string;
      name: string;
      color: string;
    }
  | { type: "SET_TEAM_POINTS"; teamId: string; points: number }
  | {
      type: "START_ROUND";
      category: string;
      clue: string;
      answer: string;
    }
  | { type: "BEGIN_SPIN" }
  | { type: "LAND_ON_SECTOR"; sectorId: string }
  | { type: "GUESS_LETTER"; letter: string }
  | { type: "CHOOSE_POSITION"; index: number }
  | { type: "ATTEMPT_SOLVE"; answer: string }
  | { type: "RESOLVE_SPECIAL"; success: boolean }
  | { type: "PASS_TURN" }
  | { type: "NEW_GAME" }
  | { type: "UNDO" };

const toCoreState = (state: FieldGameState): FieldGameCoreState => ({
  teams: state.teams,
  activeTeamId: state.activeTeamId,
  phase: state.phase,
  round: state.round,
  puzzle: state.puzzle,
  currentSectorId: state.currentSectorId,
  winnerTeamId: state.winnerTeamId,
  correctGuessStreak: state.correctGuessStreak,
  statusMessage: state.statusMessage,
  statusTone: state.statusTone,
  history: state.history,
  spin: state.spin,
});

const commit = (
  state: FieldGameState,
  core: FieldGameCoreState,
  checkpoint = true,
): FieldGameState => ({
  ...core,
  undoStack: checkpoint
    ? [...state.undoStack, toCoreState(state)].slice(-MAX_UNDO_STEPS)
    : state.undoStack,
});

const addLog = (
  state: FieldGameCoreState,
  message: string,
  tone: GameMessageTone = "info",
): FieldGameCoreState => {
  const lastId = state.history[state.history.length - 1]?.id ?? 0;
  return {
    ...state,
    statusMessage: message,
    statusTone: tone,
    history: [
      ...state.history,
      { id: lastId + 1, message, tone },
    ].slice(-MAX_HISTORY_ENTRIES),
  };
};

const getActiveTeam = (state: FieldGameCoreState) =>
  state.teams.find((team) => team.id === state.activeTeamId) ?? null;

const getNextTeamId = (state: FieldGameCoreState) => {
  if (state.teams.length === 0) {
    return null;
  }
  const currentIndex = state.teams.findIndex(
    (team) => team.id === state.activeTeamId,
  );
  return state.teams[(currentIndex + 1) % state.teams.length].id;
};

const passTurn = (
  state: FieldGameCoreState,
  reason: string,
  tone: GameMessageTone = "warning",
) => {
  const nextTeamId = getNextTeamId(state);
  const nextTeam = state.teams.find((team) => team.id === nextTeamId);
  return addLog(
    {
      ...state,
      activeTeamId: nextTeamId,
      phase: state.puzzle ? "ready" : "setup",
      currentSectorId: null,
      correctGuessStreak: 0,
    },
    nextTeam ? `${reason} Ход команды «${nextTeam.name}».` : reason,
    tone,
  );
};

const changeActiveTeamPoints = (
  state: FieldGameCoreState,
  amount: number,
) => ({
  ...state,
  teams: state.teams.map((team) =>
    team.id === state.activeTeamId
      ? {
          ...team,
          points: Math.max(0, team.points + amount),
          roundPoints: Math.max(0, team.roundPoints + amount),
        }
      : team,
  ),
});

const completeRound = (
  state: FieldGameCoreState,
  teamName: string,
  message: string,
) =>
  addLog(
    {
      ...state,
      phase: "round-complete",
      currentSectorId: null,
      winnerTeamId: state.activeTeamId,
      correctGuessStreak: 0,
    },
    `${message} Раунд выиграла команда «${teamName}»!`,
    "success",
  );

const sectorInstruction = (sector: Sector) => {
  switch (sector.type) {
    case "points":
      return `Сектор ${sector.label}. Назовите букву.`;
    case "double":
      return "Сектор ×2. Верная буква умножит текущие очки раунда.";
    case "friend":
      return "Сектор «Друг». Можно посоветоваться и назвать букву.";
    case "plus":
      return "Сектор «Плюс». Выберите закрытую позицию на табло.";
    case "task":
      return `Сектор «Задание». Выполнение принесёт ${sector.value ?? 500} очков.`;
    case "prize":
      return `Сектор «Приз». Полученный приз принесёт ${sector.value ?? 500} очков.`;
    case "bankrupt":
      return "Сектор «Банкрот».";
    case "lose-turn":
      return "Сектор 0.";
  }
};

export const fieldOfMiraclesReducer = (
  state: FieldGameState,
  action: FieldGameAction,
): FieldGameState => {
  const core = toCoreState(state);

  switch (action.type) {
    case "ADD_TEAM": {
      if (
        state.teams.some(
          (team) =>
            team.name.toLocaleLowerCase("ru-RU") ===
            action.team.name.toLocaleLowerCase("ru-RU"),
        )
      ) {
        return state;
      }
      const teams = [...state.teams, action.team];
      return commit(state, {
        ...core,
        teams,
        activeTeamId: state.activeTeamId ?? action.team.id,
      });
    }

    case "REMOVE_TEAM": {
      const teams = state.teams.filter((team) => team.id !== action.teamId);
      const activeTeamId =
        state.activeTeamId === action.teamId
          ? (teams[0]?.id ?? null)
          : state.activeTeamId;
      return commit(state, { ...core, teams, activeTeamId });
    }

    case "UPDATE_TEAM": {
      const name = action.name.trim();
      if (
        !name ||
        state.teams.some(
          (team) =>
            team.id !== action.teamId &&
            team.name.toLocaleLowerCase("ru-RU") ===
              name.toLocaleLowerCase("ru-RU"),
        )
      ) {
        return state;
      }
      return commit(state, {
        ...core,
        teams: state.teams.map((team) =>
          team.id === action.teamId
            ? { ...team, name, color: action.color || team.color }
            : team,
        ),
      });
    }

    case "SET_TEAM_POINTS": {
      if (!Number.isFinite(action.points)) {
        return state;
      }
      return commit(state, {
        ...core,
        teams: state.teams.map((team) =>
          team.id === action.teamId
            ? {
                ...team,
                points: Math.max(0, Math.round(action.points)),
                roundPoints: 0,
              }
            : team,
        ),
      });
    }

    case "START_ROUND": {
      const answer = normalizePuzzleText(action.answer);
      if (
        !answer ||
        !Array.from(answer).some(isPlayableLetter) ||
        state.teams.length === 0
      ) {
        return state;
      }
      const activeTeamId = state.teams.some(
        (team) => team.id === state.activeTeamId,
      )
        ? state.activeTeamId
        : state.teams[0].id;
      const activeTeam = state.teams.find((team) => team.id === activeTeamId);
      const next = addLog(
        {
          ...core,
          teams: state.teams.map((team) => ({ ...team, roundPoints: 0 })),
          activeTeamId,
          phase: "ready",
          round: state.round + 1,
          puzzle: {
            category: action.category.trim(),
            clue: action.clue.trim(),
            answer,
            guessedLetters: [],
          },
          currentSectorId: null,
          winnerTeamId: null,
          correctGuessStreak: 0,
        },
        `Раунд ${state.round + 1} начался. Ход команды «${activeTeam?.name ?? "—"}».`,
      );
      return commit(state, next);
    }

    case "BEGIN_SPIN": {
      if (state.phase !== "ready" || !getActiveTeam(core)) {
        return state;
      }
      return commit(
        state,
        addLog(
          { ...core, phase: "spinning", currentSectorId: null },
          "Барабан вращается…",
        ),
      );
    }

    case "LAND_ON_SECTOR": {
      if (state.phase !== "spinning") {
        return state;
      }
      const sector = getFortuneSector(action.sectorId);
      const activeTeam = getActiveTeam(core);
      if (!sector || !activeTeam) {
        return state;
      }

      const landed = addLog(
        { ...core, currentSectorId: sector.id },
        sectorInstruction(sector),
        sector.type === "bankrupt" ? "danger" : "info",
      );

      if (sector.type === "bankrupt") {
        const lostPoints = activeTeam.roundPoints;
        const afterLoss = {
          ...landed,
          teams: landed.teams.map((team) =>
            team.id === activeTeam.id
              ? {
                  ...team,
                  points: Math.max(0, team.points - lostPoints),
                  roundPoints: 0,
                }
              : team,
          ),
        };
        return commit(
          state,
          passTurn(
            afterLoss,
            `«${activeTeam.name}» теряет ${lostPoints} очков текущего раунда.`,
            "danger",
          ),
          false,
        );
      }

      if (sector.type === "lose-turn") {
        return commit(
          state,
          passTurn(landed, `«${activeTeam.name}» пропускает ход.`),
          false,
        );
      }

      const phase =
        sector.type === "plus"
          ? "awaiting-position"
          : sector.type === "task" || sector.type === "prize"
            ? "awaiting-special"
            : "awaiting-letter";
      return commit(state, { ...landed, phase }, false);
    }

    case "GUESS_LETTER": {
      if (state.phase !== "awaiting-letter" || !state.puzzle) {
        return state;
      }
      const letter = normalizeLetter(action.letter);
      if (!isPlayableLetter(letter)) {
        return state;
      }
      const activeTeam = getActiveTeam(core);
      const sector = getFortuneSector(state.currentSectorId);
      if (!activeTeam || !sector) {
        return state;
      }
      if (state.puzzle.guessedLetters.includes(letter)) {
        return commit(
          state,
          passTurn(core, `Буква ${letter} уже называлась.`),
        );
      }

      const occurrences = countLetter(state.puzzle.answer, letter);
      const guessedLetters = [...state.puzzle.guessedLetters, letter];
      let next: FieldGameCoreState = {
        ...core,
        puzzle: { ...state.puzzle, guessedLetters },
      };

      if (occurrences === 0) {
        return commit(
          state,
          passTurn(next, `Буквы ${letter} в слове нет.`),
        );
      }

      let earned = 0;
      if (sector.type === "points") {
        earned = (sector.value ?? 0) * occurrences;
      } else if (sector.type === "double") {
        earned = activeTeam.roundPoints * occurrences;
      }

      let streak = state.correctGuessStreak + 1;
      let streakBonus = 0;
      if (streak >= 3) {
        streak = 0;
        streakBonus = STREAK_BONUS;
      }
      next = changeActiveTeamPoints(next, earned + streakBonus);
      next = {
        ...next,
        phase: "ready",
        currentSectorId: null,
        correctGuessStreak: streak,
      };

      const pointsMessage = earned > 0 ? ` +${earned} очков.` : "";
      const bonusMessage = streakBonus > 0 ? ` Серия из трёх: +${streakBonus}!` : "";
      const resultMessage = `Есть буква ${letter}: ${occurrences}.${pointsMessage}${bonusMessage}`;

      if (isPuzzleComplete(state.puzzle.answer, guessedLetters)) {
        return commit(
          state,
          completeRound(next, activeTeam.name, resultMessage),
        );
      }
      return commit(state, addLog(next, resultMessage, "success"));
    }

    case "CHOOSE_POSITION": {
      if (state.phase !== "awaiting-position" || !state.puzzle) {
        return state;
      }
      const letter = Array.from(state.puzzle.answer)[action.index];
      if (
        !letter ||
        !isPlayableLetter(letter) ||
        state.puzzle.guessedLetters.includes(letter)
      ) {
        return state;
      }
      const activeTeam = getActiveTeam(core);
      if (!activeTeam) {
        return state;
      }
      const guessedLetters = [...state.puzzle.guessedLetters, letter];
      const next: FieldGameCoreState = {
        ...core,
        phase: "ready",
        currentSectorId: null,
        puzzle: { ...state.puzzle, guessedLetters },
      };
      const message = `Сектор «Плюс» открыл букву ${letter}.`;
      if (isPuzzleComplete(state.puzzle.answer, guessedLetters)) {
        return commit(
          state,
          completeRound(next, activeTeam.name, message),
        );
      }
      return commit(state, addLog(next, message, "success"));
    }

    case "ATTEMPT_SOLVE": {
      if (state.phase !== "ready" || !state.puzzle) {
        return state;
      }
      const activeTeam = getActiveTeam(core);
      if (!activeTeam || !action.answer.trim()) {
        return state;
      }
      if (normalizePuzzleText(action.answer) === state.puzzle.answer) {
        const allLetters = Array.from(state.puzzle.answer).filter(isPlayableLetter);
        return commit(
          state,
          completeRound(
            {
              ...core,
              puzzle: {
                ...state.puzzle,
                guessedLetters: Array.from(new Set(allLetters)),
              },
            },
            activeTeam.name,
            `«${activeTeam.name}» верно называет слово.`,
          ),
        );
      }
      return commit(
        state,
        passTurn(core, `«${activeTeam.name}» называет слово неверно.`),
      );
    }

    case "RESOLVE_SPECIAL": {
      if (state.phase !== "awaiting-special") {
        return state;
      }
      const sector = getFortuneSector(state.currentSectorId);
      const activeTeam = getActiveTeam(core);
      if (!sector || !activeTeam) {
        return state;
      }
      if (!action.success) {
        return commit(
          state,
          passTurn(
            core,
            sector.type === "task"
              ? `«${activeTeam.name}» не выполняет задание.`
              : `«${activeTeam.name}» отказывается от приза.`,
          ),
        );
      }
      const reward = sector.value ?? 500;
      const next = changeActiveTeamPoints(
        { ...core, phase: "ready", currentSectorId: null },
        reward,
      );
      return commit(
        state,
        addLog(
          next,
          sector.type === "task"
            ? `Задание выполнено: +${reward} очков. Ход остаётся у «${activeTeam.name}».`
            : `Приз получен: +${reward} очков. Ход остаётся у «${activeTeam.name}».`,
          "success",
        ),
      );
    }

    case "PASS_TURN": {
      if (
        state.phase === "setup" ||
        state.phase === "spinning" ||
        state.phase === "round-complete"
      ) {
        return state;
      }
      return commit(state, passTurn(core, "Ведущий передал ход."));
    }

    case "NEW_GAME": {
      const reset = createInitialGameState(
        state.teams.map((team) => ({ ...team, points: 0, roundPoints: 0 })),
      );
      return commit(state, toCoreState(reset));
    }

    case "UNDO": {
      const previous = state.undoStack[state.undoStack.length - 1];
      if (!previous) {
        return state;
      }
      return {
        ...previous,
        undoStack: state.undoStack.slice(0, -1),
      };
    }
  }
};
