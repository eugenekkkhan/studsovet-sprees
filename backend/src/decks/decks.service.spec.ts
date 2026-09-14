import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDeckDraft } from './test-deck';

// Каталог задаётся до импорта службы: настройки читаются один раз при загрузке.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'sprees-decks-'));
// Начальник студсовета: видит всё залитое, включая приватное.
process.env.TELEGRAM_ADMIN_IDS = '900';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DecksService } = require('./decks.service') as typeof import('./decks.service');

describe('DecksService', () => {
  const service = new DecksService();
  const author = { id: 501, name: 'Ведущий' };
  const other = { id: 502, name: 'Другой' };

  it('сохраняет колоду и отдаёт её тому же автору', async () => {
    await service.save(author, 'deck-1', createDeckDraft('deck-1', 'Разминка'));

    expect((await service.list(author.id)).map((item) => item.deck.name)).toEqual(['Разминка']);
    expect((await service.get(author.id, 'deck-1')).deck.rounds[0].themes[0].questions).toHaveLength(1);
  });

  it('не показывает колоды чужому пользователю', async () => {
    expect(await service.list(other.id)).toEqual([]);
    await expect(service.get(other.id, 'deck-1')).rejects.toThrow();
  });

  it('перезаписывает колоду по тому же идентификатору', async () => {
    await service.save(author, 'deck-1', createDeckDraft('deck-1', 'Разминка 2'));

    const decks = await service.list(author.id);
    expect(decks).toHaveLength(1);
    expect(decks[0].deck.name).toBe('Разминка 2');
  });

  it('удерживает идентификатор из адреса, что бы ни прислал клиент', async () => {
    const saved = await service.save(author, 'deck-2', createDeckDraft('подделка', 'Вторая'));
    expect(saved.deck.id).toBe('deck-2');
  });

  it('переживает перезапуск: данные лежат в файле', async () => {
    const restarted = new DecksService();
    expect((await restarted.list(author.id)).map((item) => item.deck.id).sort()).toEqual([
      'deck-1',
      'deck-2',
    ]);
  });

  it('удаляет только существующую колоду', async () => {
    expect(await service.remove(author.id, 'deck-2')).toEqual({ ok: true });
    await expect(service.remove(author.id, 'deck-2')).rejects.toThrow();
  });

  it('отклоняет мусор вместо колоды', async () => {
    await expect(service.save(author, 'deck-3', 'колода')).rejects.toThrow();
  });
});

describe('DecksService: доступ по секретной ссылке', () => {
  const service = new DecksService();
  const author = { id: 701, name: 'Автор' };
  const guest = { id: 702, name: 'Гость' };

  // Своя колода на тест: счётчики доступа живут в файле и иначе перетекают
  // из теста в тест.
  let deckId = '';
  let sequence = 0;
  const stored = () => service.get(author.id, deckId);

  beforeEach(async () => {
    deckId = `shared-${++sequence}`;
    await service.save(author, deckId, createDeckDraft(deckId, 'Секретная'));
  });

  it('открывает колоду по коду и считает открытия', async () => {
    const { code } = await service.issueShare(author.id, deckId, true);

    const first = await service.accessShare(code);
    expect(first.deck.deck.name).toBe('Секретная');
    expect(first.allowCopy).toBe(true);
    await service.accessShare(code);

    const entry = await stored();
    expect(entry.shareViews).toBe(2);
    expect(entry.shareLastViewedAt).toBeGreaterThan(0);
  });

  it('не отдаёт получателю служебные поля автора', async () => {
    const { code } = await service.issueShare(author.id, deckId, true);
    const opened = await service.accessShare(code);

    expect(opened.deck).not.toHaveProperty('shareTokenHash');
    expect(opened.deck).not.toHaveProperty('shareViews');
    expect(opened.deck).not.toHaveProperty('visibility');
  });

  it('никогда не отдаёт хеш кода самому автору', async () => {
    await service.issueShare(author.id, deckId, true);
    const entry = await stored();

    expect(entry).not.toHaveProperty('shareTokenHash');
    expect(entry.shareActive).toBe(true);
  });

  it('копия достаётся получателю, а оригинал остаётся у автора', async () => {
    const { code } = await service.issueShare(author.id, deckId, true);
    const copy = await service.copyShare(guest, code);

    expect(copy.deck.id).not.toBe(deckId);
    expect(copy.author.id).toBe(guest.id);
    expect(copy.visibility).toBe('private');
    expect(copy.shareActive).toBeFalsy();
    expect((await stored()).shareCopies).toBe(1);

    // Правка копии до оригинала не доходит.
    await service.save(guest, copy.deck.id, { ...copy.deck, name: 'Своя' });
    expect((await stored()).deck.name).toBe('Секретная');
  });

  it('запрещает копирование, когда автор его выключил', async () => {
    const { code } = await service.issueShare(author.id, deckId, false);
    await expect(service.copyShare(guest, code)).rejects.toThrow();

    await service.setShareOptions(author.id, deckId, true);
    await expect(service.copyShare(guest, code)).resolves.toBeTruthy();
  });

  it('смена кода убивает старую ссылку и сохраняет счётчики', async () => {
    const first = await service.issueShare(author.id, deckId, true);
    await service.accessShare(first.code);

    const second = await service.issueShare(author.id, deckId, true);
    await expect(service.accessShare(first.code)).rejects.toThrow();
    await expect(service.accessShare(second.code)).resolves.toBeTruthy();

    expect((await stored()).shareViews).toBe(2);
  });

  it('первая выдача после отзыва начинает счёт заново', async () => {
    const { code } = await service.issueShare(author.id, deckId, true);
    await service.accessShare(code);
    await service.revokeShare(author.id, deckId);

    await service.issueShare(author.id, deckId, true);
    const entry = await stored();
    expect(entry.shareViews).toBe(0);
    expect(entry.shareLastViewedAt).toBeNull();
  });

  it('отзыв закрывает доступ, а счётчики оставляет автору', async () => {
    const { code } = await service.issueShare(author.id, deckId, true);
    await service.accessShare(code);
    const revoked = await service.revokeShare(author.id, deckId);

    expect(revoked.shareActive).toBe(false);
    expect(revoked.shareViews).toBe(1);
    await expect(service.accessShare(code)).rejects.toThrow();
  });

  it('переживает сохранение колоды: ссылка после правки продолжает работать', async () => {
    const { code } = await service.issueShare(author.id, deckId, true);
    await service.save(author, deckId, createDeckDraft(deckId, 'Секретная 2'));

    expect((await service.accessShare(code)).deck.deck.name).toBe('Секретная 2');
  });
});

describe('DecksService: общая библиотека', () => {
  const service = new DecksService();
  const masha = { id: 601, name: 'Маша' };
  const petya = { id: 602, name: 'Петя' };
  const boss = { id: 900, name: 'Начальник' };

  beforeAll(async () => {
    await service.save(masha, 'm-open', createDeckDraft('m-open', 'Машина общая'), 'published');
    await service.save(masha, 'm-secret', createDeckDraft('m-secret', 'Машина личная'));
    await service.save(petya, 'p-open', createDeckDraft('p-open', 'Петина общая'), 'published');
  });

  it('новая колода приватна, пока автор не опубликует её', async () => {
    expect((await service.get(masha.id, 'm-secret')).visibility).toBe('private');
    expect((await service.get(masha.id, 'm-open')).visibility).toBe('published');
  });

  it('в библиотеке видны чужие опубликованные и свои любые', async () => {
    const { decks, isAdmin } = await service.library(petya);
    expect(isAdmin).toBe(false);
    expect(decks.map((item) => item.deck.id).sort()).toEqual(['m-open', 'p-open']);
    // Автор у каждой колоды подписан — иначе непонятно, чьё это.
    expect(decks.find((item) => item.deck.id === 'm-open')?.author.name).toBe('Маша');
  });

  it('чужая приватная колода в библиотеку не попадает', async () => {
    const { decks } = await service.library(petya);
    expect(decks.some((item) => item.deck.id === 'm-secret')).toBe(false);
  });

  it('начальник видит всё, включая приватное, с авторами', async () => {
    const { decks, isAdmin } = await service.library(boss);
    const ids = decks.map((item) => item.deck.id);
    expect(isAdmin).toBe(true);
    expect(ids).toEqual(expect.arrayContaining(['m-open', 'm-secret', 'p-open']));
    // Приватная чужая колода видна ему и подписана автором.
    expect(decks.find((item) => item.deck.id === 'm-secret')?.author.name).toBe('Маша');
    // Обычному пользователю в той же библиотеке её нет.
    expect((await service.library(petya)).decks.map((item) => item.deck.id)).not.toContain('m-secret');
  });

  it('видимость переключается в обе стороны и переживает обычное сохранение', async () => {
    await service.setVisibility(masha.id, 'm-open', 'private');
    expect((await service.library(petya)).decks.some((item) => item.deck.id === 'm-open')).toBe(false);

    await service.setVisibility(masha.id, 'm-open', 'published');
    // Обычная правка колоды не должна молча снимать публикацию.
    await service.save(masha, 'm-open', createDeckDraft('m-open', 'Машина общая 2'));
    expect((await service.get(masha.id, 'm-open')).visibility).toBe('published');
  });

  it('чужую общую колоду можно забрать себе копией', async () => {
    const copy = await service.copyToOwn(petya, masha.id, 'm-open');
    expect(copy.deck.id).not.toBe('m-open');
    expect(copy.author.id).toBe(petya.id);
    // Копия приватна: делиться ею — отдельное решение нового владельца.
    expect(copy.visibility).toBe('private');
    expect((await service.list(petya.id)).map((item) => item.deck.id)).toContain(copy.deck.id);
    // Оригинал не тронут.
    expect((await service.get(masha.id, 'm-open')).deck.name).toBe('Машина общая 2');
  });

  it('чужую приватную колоду забрать нельзя, а начальнику можно', async () => {
    await expect(service.copyToOwn(petya, masha.id, 'm-secret')).rejects.toThrow();
    expect((await service.copyToOwn(boss, masha.id, 'm-secret')).author.id).toBe(boss.id);
  });
});
