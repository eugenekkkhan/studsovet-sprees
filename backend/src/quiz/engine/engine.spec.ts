import { applyCommand, createInitialGameState } from './index';
import type { HostCommand, StoredGameState, Team } from '../types';
import { sanitizeInitialTeams } from '../session/keys';

const context = { createTeamIdentity: () => ({ id: 'new', joinKey: 'NEWKEY2345' }), now: 1000 };

const team = (id: string, score = 0): Team => ({
  id,
  name: `Команда ${id}`,
  color: '#2563eb',
  score,
  joinKey: `KEY${id.toUpperCase()}0000`.slice(0, 10),
});

const deck = {
  id: 'deck',
  name: 'Тестовая колода',
  author: '',
  rounds: [
    {
      id: 'round-1',
      name: 'Первый раунд',
      themes: [
        {
          id: 'theme-1',
          name: 'Кино',
          comment: '',
          questions: [
            { id: 'q-simple', type: 'simple', price: 100, text: 'Вопрос', answer: 'Ответ' },
            { id: 'q-secret', type: 'secret', price: 200, text: 'Кот', answer: 'Мешок', secretTheme: 'Своя тема', secretPrice: 500 },
            { id: 'q-stake', type: 'stake', price: 300, text: 'Аукцион', answer: 'Ставка' },
            { id: 'q-norisk', type: 'norisk', price: 400, text: 'Без риска', answer: 'Спокойно' },
          ],
        },
      ],
    },
  ],
  finalThemes: [
    { id: 'f-1', name: 'Финал А', text: 'Финальный вопрос', answer: 'Финальный ответ' },
    { id: 'f-2', name: 'Финал Б', text: 'Второй', answer: 'Второй ответ' },
  ],
};

const run = (state: StoredGameState, ...commands: HostCommand[]) =>
  commands.reduce((current, command) => {
    const next = applyCommand(current, command, context);
    if (!next) throw new Error(`Команда отклонена: ${command.type}`);
    return next;
  }, state);

const started = (teams: Team[]) =>
  run(
    createInitialGameState(teams),
    { type: 'LOAD_DECK', deck },
    { type: 'START_ROUND', roundIndex: 0 },
  );

const scoreOf = (state: StoredGameState, id: string) =>
  state.teams.find((item) => item.id === id)?.score ?? 0;

describe('движок «Своей игры»', () => {
  it('штрафует за фальстарт блокировкой кнопки, а не очками', () => {
    const state = run(started([team('a'), team('b')]), {
      type: 'PICK_QUESTION',
      questionId: 'q-simple',
    });
    const falseStart = applyCommand(state, { type: 'BUZZ', teamId: 'b' }, context)!;

    expect(falseStart.phase).toBe('question');
    expect(falseStart.activeQuestion?.buzzedTeamId).toBeNull();
    expect(falseStart.activeQuestion?.falseStartUntil['b']).toBe(3000);
    expect(scoreOf(falseStart, 'b')).toBe(0);
    // Пока блокировка не истекла, повторное нажатие ничего не делает.
    expect(applyCommand(falseStart, { type: 'BUZZ', teamId: 'b' }, context)).toBeNull();
  });

  it('снимает номинал за неверный ответ и снова открывает кнопки соперникам', () => {
    const state = run(
      started([team('a'), team('b')]),
      { type: 'PICK_QUESTION', questionId: 'q-simple' },
      { type: 'SET_BUZZ', open: true },
      { type: 'BUZZ', teamId: 'a' },
      { type: 'JUDGE', correct: false },
    );

    expect(scoreOf(state, 'a')).toBe(-100);
    expect(state.phase).toBe('question');
    expect(state.activeQuestion?.buzzOpen).toBe(true);
    expect(state.activeQuestion?.lockedTeamIds).toEqual(['a']);
    // Второй попытки у ошибившейся команды нет.
    expect(applyCommand(state, { type: 'BUZZ', teamId: 'a' }, context)).toBeNull();

    const won = run(state, { type: 'BUZZ', teamId: 'b' }, { type: 'JUDGE', correct: true });
    expect(scoreOf(won, 'b')).toBe(100);
    expect(won.phase).toBe('reveal');
    expect(won.pickerTeamId).toBe('b');
  });

  it('передаёт «Кота» сопернику со своей темой и ценой, ход остаётся за игравшим', () => {
    const opened = run(started([team('a'), team('b')]), {
      type: 'PICK_QUESTION',
      questionId: 'q-secret',
    });
    expect(opened.phase).toBe('transfer');
    // Себе кота не оставляют.
    expect(applyCommand(opened, { type: 'ASSIGN_SECRET', teamId: 'a' }, context)).toBeNull();

    const assigned = run(opened, { type: 'ASSIGN_SECRET', teamId: 'b' });
    expect(assigned.activeQuestion?.themeName).toBe('Своя тема');
    expect(assigned.activeQuestion?.price).toBe(500);
    expect(assigned.activeQuestion?.soloTeamId).toBe('b');
    // Кнопка на коте не работает — отвечает только получивший.
    expect(applyCommand(assigned, { type: 'BUZZ', teamId: 'a' }, context)).toBeNull();

    const missed = run(assigned, { type: 'JUDGE', correct: false });
    expect(scoreOf(missed, 'b')).toBe(-500);
    expect(missed.pickerTeamId).toBe('b');
  });

  it('проводит торги: минимум — номинал, ва-банк бьётся только ва-банком', () => {
    const bidding = run(started([team('a', 1000), team('b', 700)]), {
      type: 'PICK_QUESTION',
      questionId: 'q-stake',
    });

    expect(bidding.phase).toBe('bidding');
    expect(bidding.bidding?.highestBid).toBe(300);
    expect(bidding.bidding?.highestTeamId).toBe('a');
    expect(bidding.bidding?.turnTeamId).toBe('b');
    // Ставка обязана превышать текущую и быть кратной шагу.
    expect(
      applyCommand(bidding, { type: 'PLACE_BID', teamId: 'b', action: 'bid', amount: 250 }, context),
    ).toBeNull();
    expect(
      applyCommand(bidding, { type: 'PLACE_BID', teamId: 'b', action: 'bid', amount: 450 }, context),
    ).toBeNull();

    const allIn = run(bidding, { type: 'PLACE_BID', teamId: 'b', action: 'all-in', amount: 0 });
    expect(allIn.bidding?.highestBid).toBe(700);
    expect(allIn.bidding?.allIn).toBe(true);
    expect(allIn.bidding?.turnTeamId).toBe('a');
    // Простой ставкой ва-банк не перебить.
    expect(
      applyCommand(allIn, { type: 'PLACE_BID', teamId: 'a', action: 'bid', amount: 800 }, context),
    ).toBeNull();

    const settled = run(allIn, { type: 'PLACE_BID', teamId: 'a', action: 'all-in', amount: 0 });
    expect(settled.phase).toBe('question');
    expect(settled.activeQuestion?.soloTeamId).toBe('a');
    expect(settled.activeQuestion?.price).toBe(1000);
  });

  it('не штрафует за вопрос без риска', () => {
    const state = run(
      started([team('a'), team('b')]),
      { type: 'PICK_QUESTION', questionId: 'q-norisk' },
      { type: 'JUDGE', correct: false },
    );
    expect(scoreOf(state, 'a')).toBe(0);
    expect(state.phase).toBe('reveal');
  });

  it('пускает в финал только команды с положительным счётом', () => {
    const state = run(
      started([team('a', 500), team('b', 0), team('c', -200)]),
      { type: 'START_FINAL' },
    );
    expect(state.final?.participantIds).toEqual(['a']);
    expect(state.phase).toBe('final-themes');
  });

  it('проводит финал: тема, ставка, ответ, вскрытие', () => {
    const final = run(
      started([team('a', 500), team('b', 800)]),
      { type: 'START_FINAL' },
      { type: 'FINAL_REMOVE_THEME', themeId: 'f-2' },
    );
    expect(final.phase).toBe('final-bets');
    expect(final.final?.playingThemeId).toBe('f-1');
    // Больше своего счёта не поставить.
    expect(
      applyCommand(final, { type: 'FINAL_BET', teamId: 'a', amount: 900 }, context),
    ).toBeNull();

    const answering = run(
      final,
      { type: 'FINAL_BET', teamId: 'a', amount: 500 },
      { type: 'FINAL_BET', teamId: 'b', amount: 100 },
    );
    expect(answering.phase).toBe('final-answers');

    const revealing = run(
      answering,
      { type: 'FINAL_ANSWER', teamId: 'a', text: 'Ответ А' },
      { type: 'FINAL_ANSWER', teamId: 'b', text: 'Ответ Б' },
    );
    expect(revealing.phase).toBe('final-reveal');

    const done = run(
      revealing,
      { type: 'FINAL_REVEAL_NEXT' },
      { type: 'FINAL_JUDGE', teamId: 'a', correct: true },
      { type: 'FINAL_REVEAL_NEXT' },
      { type: 'FINAL_JUDGE', teamId: 'b', correct: false },
    );
    expect(scoreOf(done, 'a')).toBe(1000);
    expect(scoreOf(done, 'b')).toBe(700);
    expect(done.phase).toBe('game-over');
    expect(done.statusMessage).toContain('Победа');
  });

  it('откатывает последний ход', () => {
    const state = run(started([team('a'), team('b')]), {
      type: 'PICK_QUESTION',
      questionId: 'q-simple',
    });
    const undone = run(state, { type: 'UNDO' });
    expect(undone.phase).toBe('board');
    expect(undone.playedQuestionIds).toEqual([]);
  });
  it('END_ROUND убирает прерванный финал, а не оставляет его на табло', () => {
    const state = run(
      started([team('a', 500), team('b', 300)]),
      { type: 'START_FINAL' },
    );
    expect(state.final).not.toBeNull();

    const ended = run(state, { type: 'END_ROUND' });
    expect(ended.phase).toBe('round-over');
    expect(ended.final).toBeNull();
  });

  it('удаление ответившей команды не заклинивает судейство', () => {
    const state = run(
      started([team('a', 100), team('b', 100)]),
      { type: 'PICK_QUESTION', questionId: 'q-simple' },
      { type: 'SET_BUZZ', open: true },
      { type: 'BUZZ', teamId: 'b' },
    );
    expect(state.phase).toBe('answer');

    const removed = run(state, { type: 'REMOVE_TEAM', teamId: 'b' });
    expect(removed.activeQuestion?.buzzedTeamId).toBeNull();
    expect(removed.phase).toBe('question');

    // Раньше здесь движок возвращал null и вопрос было не закрыть.
    const judged = run(removed, { type: 'JUDGE', correct: true });
    expect(judged.phase).toBe('reveal');
    expect(run(judged, { type: 'CLOSE_QUESTION' }).phase).toBe('board');
  });

  it('удаление игравшего «Кота» возвращает вопрос всем, а не запирает его', () => {
    const state = run(
      started([team('a', 100), team('b', 100)]),
      { type: 'PICK_QUESTION', questionId: 'q-secret' },
      { type: 'ASSIGN_SECRET', teamId: 'b' },
    );
    expect(state.activeQuestion?.soloTeamId).toBe('b');

    const removed = run(state, { type: 'REMOVE_TEAM', teamId: 'b' });
    expect(removed.activeQuestion?.soloTeamId).toBeNull();
    expect(run(removed, { type: 'SET_BUZZ', open: true }).activeQuestion?.buzzOpen).toBe(true);
  });

  it('удаление всех соперников на аукционе снимает вопрос, а не вешает его', () => {
    const state = run(
      started([team('a', 1000), team('b', 1000)]),
      { type: 'PICK_QUESTION', questionId: 'q-stake' },
    );
    expect(state.phase).toBe('bidding');
    const openerId = state.bidding?.openerTeamId ?? '';

    const removed = run(state, { type: 'REMOVE_TEAM', teamId: openerId });
    // Присуждать аукцион стало некому — клетка остаётся сыгранной, игра идёт.
    expect(removed.bidding).toBeNull();
    expect(removed.activeQuestion).toBeNull();
    expect(removed.phase).toBe('board');
  });

  it('удалённая команда пропадает из финала целиком', () => {
    const state = run(
      started([team('a', 500), team('b', 300), team('c', 200)]),
      { type: 'START_FINAL' },
      { type: 'FINAL_REMOVE_THEME', themeId: 'f-1' },
      { type: 'FINAL_BET', teamId: 'c', amount: 100 },
    );
    expect(state.final?.bets.c).toBe(100);

    const removed = run(state, { type: 'REMOVE_TEAM', teamId: 'c' });
    expect(removed.final?.participantIds).not.toContain('c');
    expect(removed.final?.bets.c).toBeUndefined();
    expect(removed.final?.turnTeamId).not.toBe('c');
  });

  it('счёт, приехавший строкой, не превращается в ноль', () => {
    const teams = sanitizeInitialTeams([
      { name: 'Строка', score: '500' as unknown as number },
      { name: 'Мусор', score: 'абв' as unknown as number },
    ]);
    expect(teams[0].score).toBe(500);
    expect(teams[1].score).toBe(0);
  });
});
