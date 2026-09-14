import { getSector } from './sectors';
import type {
  GameCoreState,
  GameMessageTone,
  HostCommand,
  Sector,
  SpinResult,
  StoredGameState,
  Team,
} from './types';

const PLAYABLE_LETTER = /^[А-ЯЁ]$/u;
const MAX_UNDO_STEPS = 30;
const MAX_HISTORY_ENTRIES = 60;
export const STREAK_BONUS = 500;

const normalizePuzzleText = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('ru-RU');

const normalizeLetter = (value: string) =>
  value.trim().slice(0, 1).toLocaleUpperCase('ru-RU');

const isPlayableLetter = (value: string) => PLAYABLE_LETTER.test(value);

const countLetter = (answer: string, letter: string) =>
  Array.from(answer).filter((character) => character === letter).length;

const isPuzzleComplete = (answer: string, guessedLetters: string[]) => {
  const guessed = new Set(guessedLetters);
  return Array.from(answer).every(
    (character) => !isPlayableLetter(character) || guessed.has(character),
  );
};

export const createInitialGameState = (teams: Team[] = []): StoredGameState => ({
  teams,
  activeTeamId: teams[0]?.id ?? null,
  phase: 'setup',
  round: 0,
  puzzle: null,
  currentSectorId: null,
  winnerTeamId: null,
  correctGuessStreak: 0,
  statusMessage: 'Добавьте команды и подготовьте первый раунд.',
  statusTone: 'info',
  history: [],
  spin: null,
  undoStack: [],
  revision: 0,
});

const toCore = (state: StoredGameState): GameCoreState => ({
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
  state: StoredGameState,
  core: GameCoreState,
  checkpoint = true,
): StoredGameState => ({
  ...core,
  undoStack: checkpoint
    ? [...state.undoStack, toCore(state)].slice(-MAX_UNDO_STEPS)
    : state.undoStack,
  revision: state.revision + 1,
});

const addLog = (
  state: GameCoreState,
  message: string,
  tone: GameMessageTone = 'info',
): GameCoreState => {
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

const getActiveTeam = (state: GameCoreState) =>
  state.teams.find((team) => team.id === state.activeTeamId) ?? null;

const getNextTeamId = (state: GameCoreState) => {
  if (state.teams.length === 0) return null;
  const index = state.teams.findIndex((team) => team.id === state.activeTeamId);
  return state.teams[(index + 1) % state.teams.length].id;
};

const passTurn = (
  state: GameCoreState,
  reason: string,
  tone: GameMessageTone = 'warning',
) => {
  const activeTeamId = getNextTeamId(state);
  const activeTeam = state.teams.find((team) => team.id === activeTeamId);
  return addLog(
    {
      ...state,
      activeTeamId,
      phase: state.puzzle ? 'ready' : 'setup',
      currentSectorId: null,
      correctGuessStreak: 0,
    },
    activeTeam ? `${reason} Ход команды «${activeTeam.name}».` : reason,
    tone,
  );
};

const changeActiveTeamPoints = (state: GameCoreState, amount: number) => ({
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
  state: GameCoreState,
  teamName: string,
  message: string,
) =>
  addLog(
    {
      ...state,
      phase: 'round-complete',
      currentSectorId: null,
      winnerTeamId: state.activeTeamId,
      correctGuessStreak: 0,
    },
    `${message} Раунд выиграла команда «${teamName}»!`,
    'success',
  );

const sectorInstruction = (sector: Sector) => {
  switch (sector.type) {
    case 'points':
      return `Сектор ${sector.label}. Назовите букву.`;
    case 'double':
      return 'Сектор ×2. Верная буква умножит текущие очки раунда.';
    case 'friend':
      return 'Сектор «Друг». Можно посоветоваться и назвать букву.';
    case 'plus':
      return 'Сектор «Плюс». Выберите закрытую позицию на табло.';
    case 'task':
      return `Сектор «Задание». Выполнение принесёт ${sector.value ?? 500} очков.`;
    case 'prize':
      return `Сектор «Приз». Полученный приз принесёт ${sector.value ?? 500} очков.`;
    case 'bankrupt':
      return 'Сектор «Банкрот».';
    case 'lose-turn':
      return 'Сектор 0.';
  }
};

export const beginAuthoritativeSpin = (
  state: StoredGameState,
  spin: SpinResult,
): StoredGameState | null => {
  const core = toCore(state);
  if (state.phase !== 'ready' || !getActiveTeam(core)) return null;
  return commit(
    state,
    addLog(
      { ...core, phase: 'spinning', currentSectorId: null, spin },
      'Барабан вращается…',
    ),
  );
};

export const settleAuthoritativeSpin = (
  state: StoredGameState,
  spinId: string,
): StoredGameState | null => {
  if (
    state.phase !== 'spinning' ||
    !state.spin ||
    state.spin.id !== spinId ||
    state.spin.status !== 'spinning'
  ) {
    return null;
  }

  const sector = getSector(state.spin.sectorId);
  const core: GameCoreState = {
    ...toCore(state),
    spin: { ...state.spin, status: 'settled' },
  };
  const activeTeam = getActiveTeam(core);
  if (!sector || !activeTeam) return null;

  const landed = addLog(
    { ...core, currentSectorId: sector.id },
    sectorInstruction(sector),
    sector.type === 'bankrupt' ? 'danger' : 'info',
  );

  if (sector.type === 'bankrupt') {
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
        'danger',
      ),
      false,
    );
  }

  if (sector.type === 'lose-turn') {
    return commit(
      state,
      passTurn(landed, `«${activeTeam.name}» пропускает ход.`),
      false,
    );
  }

  const phase =
    sector.type === 'plus'
      ? 'awaiting-position'
      : sector.type === 'task' || sector.type === 'prize'
        ? 'awaiting-special'
        : 'awaiting-letter';
  return commit(state, { ...landed, phase }, false);
};

/** Pure state transition. The service decides which socket may invoke it. */
export const applyCommand = (
  state: StoredGameState,
  command: HostCommand,
  createTeamIdentity: () => Pick<Team, 'id' | 'joinKey'>,
): StoredGameState | null => {
  const core = toCore(state);

  switch (command.type) {
    case 'ADD_TEAM': {
      const name = command.name.trim().slice(0, 60);
      if (
        !name ||
        state.teams.some(
          (team) =>
            team.name.toLocaleLowerCase('ru-RU') ===
            name.toLocaleLowerCase('ru-RU'),
        )
      ) {
        return null;
      }
      const color = /^#[\da-f]{6}$/i.test(command.color)
        ? command.color
        : '#cccccc';
      const identity = createTeamIdentity();
      const team: Team = {
        ...identity,
        name,
        color,
        points: 0,
        roundPoints: 0,
      };
      return commit(state, {
        ...core,
        teams: [...state.teams, team],
        activeTeamId: state.activeTeamId ?? team.id,
      });
    }

    case 'REMOVE_TEAM': {
      if (!state.teams.some((team) => team.id === command.teamId)) return null;
      const teams = state.teams.filter((team) => team.id !== command.teamId);
      return commit(state, {
        ...core,
        teams,
        activeTeamId:
          state.activeTeamId === command.teamId
            ? (teams[0]?.id ?? null)
            : state.activeTeamId,
      });
    }

    case 'UPDATE_TEAM': {
      const name = command.name.trim().slice(0, 60);
      if (
        !name ||
        !state.teams.some((team) => team.id === command.teamId) ||
        state.teams.some(
          (team) =>
            team.id !== command.teamId &&
            team.name.toLocaleLowerCase('ru-RU') ===
              name.toLocaleLowerCase('ru-RU'),
        )
      ) {
        return null;
      }
      return commit(state, {
        ...core,
        teams: state.teams.map((team) =>
          team.id === command.teamId
            ? {
                ...team,
                name,
                color: /^#[\da-f]{6}$/i.test(command.color)
                  ? command.color
                  : team.color,
              }
            : team,
        ),
      });
    }

    case 'SET_TEAM_POINTS': {
      if (
        !Number.isFinite(command.points) ||
        !state.teams.some((team) => team.id === command.teamId)
      ) {
        return null;
      }
      return commit(state, {
        ...core,
        teams: state.teams.map((team) =>
          team.id === command.teamId
            ? {
                ...team,
                points: Math.max(0, Math.round(command.points)),
                roundPoints: 0,
              }
            : team,
        ),
      });
    }

    case 'START_ROUND': {
      const answer = normalizePuzzleText(command.answer).slice(0, 120);
      if (
        !answer ||
        !Array.from(answer).some(isPlayableLetter) ||
        state.teams.length === 0 ||
        (state.phase !== 'setup' && state.phase !== 'round-complete')
      ) {
        return null;
      }
      const activeTeamId = state.teams.some(
        (team) => team.id === state.activeTeamId,
      )
        ? state.activeTeamId
        : state.teams[0].id;
      const activeTeam = state.teams.find((team) => team.id === activeTeamId);
      return commit(
        state,
        addLog(
          {
            ...core,
            teams: state.teams.map((team) => ({ ...team, roundPoints: 0 })),
            activeTeamId,
            phase: 'ready',
            round: state.round + 1,
            puzzle: {
              category: command.category.trim().slice(0, 100),
              clue: command.clue.trim().slice(0, 500),
              answer,
              guessedLetters: [],
            },
            currentSectorId: null,
            winnerTeamId: null,
            correctGuessStreak: 0,
            spin: null,
          },
          `Раунд ${state.round + 1} начался. Ход команды «${activeTeam?.name ?? '—'}».`,
        ),
      );
    }

    case 'GUESS_LETTER': {
      if (state.phase !== 'awaiting-letter' || !state.puzzle) return null;
      const letter = normalizeLetter(command.letter);
      if (!isPlayableLetter(letter)) return null;
      const activeTeam = getActiveTeam(core);
      const sector = getSector(state.currentSectorId);
      if (!activeTeam || !sector) return null;
      if (state.puzzle.guessedLetters.includes(letter)) {
        return commit(state, passTurn(core, `Буква ${letter} уже называлась.`));
      }

      const occurrences = countLetter(state.puzzle.answer, letter);
      const guessedLetters = [...state.puzzle.guessedLetters, letter];
      let next: GameCoreState = {
        ...core,
        puzzle: { ...state.puzzle, guessedLetters },
      };
      if (occurrences === 0) {
        return commit(state, passTurn(next, `Буквы ${letter} в слове нет.`));
      }

      let earned = 0;
      if (sector.type === 'points') {
        earned = (sector.value ?? 0) * occurrences;
      } else if (sector.type === 'double') {
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
        phase: 'ready',
        currentSectorId: null,
        correctGuessStreak: streak,
      };
      const result = `Есть буква ${letter}: ${occurrences}.${
        earned > 0 ? ` +${earned} очков.` : ''
      }${streakBonus > 0 ? ` Серия из трёх: +${streakBonus}!` : ''}`;
      return commit(
        state,
        isPuzzleComplete(state.puzzle.answer, guessedLetters)
          ? completeRound(next, activeTeam.name, result)
          : addLog(next, result, 'success'),
      );
    }

    case 'CHOOSE_POSITION': {
      if (state.phase !== 'awaiting-position' || !state.puzzle) return null;
      const letter = Array.from(state.puzzle.answer)[command.index];
      if (
        !letter ||
        !isPlayableLetter(letter) ||
        state.puzzle.guessedLetters.includes(letter)
      ) {
        return null;
      }
      const activeTeam = getActiveTeam(core);
      if (!activeTeam) return null;
      const guessedLetters = [...state.puzzle.guessedLetters, letter];
      const next: GameCoreState = {
        ...core,
        phase: 'ready',
        currentSectorId: null,
        puzzle: { ...state.puzzle, guessedLetters },
      };
      const message = `Сектор «Плюс» открыл букву ${letter}.`;
      return commit(
        state,
        isPuzzleComplete(state.puzzle.answer, guessedLetters)
          ? completeRound(next, activeTeam.name, message)
          : addLog(next, message, 'success'),
      );
    }

    case 'ATTEMPT_SOLVE': {
      if (state.phase !== 'ready' || !state.puzzle) return null;
      const activeTeam = getActiveTeam(core);
      if (!activeTeam || !command.answer.trim()) return null;
      if (normalizePuzzleText(command.answer) === state.puzzle.answer) {
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

    case 'RESOLVE_SPECIAL': {
      if (state.phase !== 'awaiting-special') return null;
      const sector = getSector(state.currentSectorId);
      const activeTeam = getActiveTeam(core);
      if (!sector || !activeTeam) return null;
      if (!command.success) {
        return commit(
          state,
          passTurn(
            core,
            sector.type === 'task'
              ? `«${activeTeam.name}» не выполняет задание.`
              : `«${activeTeam.name}» отказывается от приза.`,
          ),
        );
      }
      const reward = sector.value ?? 500;
      const next = changeActiveTeamPoints(
        { ...core, phase: 'ready', currentSectorId: null },
        reward,
      );
      return commit(
        state,
        addLog(
          next,
          sector.type === 'task'
            ? `Задание выполнено: +${reward} очков. Ход остаётся у «${activeTeam.name}».`
            : `Приз получен: +${reward} очков. Ход остаётся у «${activeTeam.name}».`,
          'success',
        ),
      );
    }

    case 'PASS_TURN':
      if (
        state.phase === 'setup' ||
        state.phase === 'spinning' ||
        state.phase === 'round-complete'
      ) {
        return null;
      }
      return commit(state, passTurn(core, 'Ведущий передал ход.'));

    case 'NEW_GAME': {
      const reset = createInitialGameState(
        state.teams.map((team) => ({ ...team, points: 0, roundPoints: 0 })),
      );
      return commit(state, toCore(reset));
    }

    case 'UNDO': {
      const previous = state.undoStack[state.undoStack.length - 1];
      if (!previous || state.phase === 'spinning') return null;
      return {
        ...previous,
        undoStack: state.undoStack.slice(0, -1),
        revision: state.revision + 1,
      };
    }
  }
};
