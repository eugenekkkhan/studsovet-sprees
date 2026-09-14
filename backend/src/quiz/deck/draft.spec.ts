import { sanitizeDeckDraft } from './draft';

const draft = (value: unknown) => sanitizeDeckDraft(value);

describe('sanitizeDeckDraft', () => {
  it('сохраняет недописанную колоду целиком', () => {
    const deck = draft({
      id: 'deck-1',
      name: 'Черновик',
      rounds: [{ id: 'r1', name: '', themes: [{ id: 't1', name: '', questions: [] }] }],
      finalThemes: [{ id: 'f1', name: '', text: '' }],
    });

    expect(deck?.rounds).toHaveLength(1);
    expect(deck?.rounds[0].themes).toHaveLength(1);
    expect(deck?.rounds[0].name).toBe('1-й раунд');
    expect(deck?.finalThemes).toHaveLength(1);
  });

  it('обрезает количества и чинит типы', () => {
    const deck = draft({
      name: '  Колода   имени  ',
      rounds: Array.from({ length: 30 }, () => ({
        themes: Array.from({ length: 30 }, () => ({
          questions: Array.from({ length: 30 }, () => ({ type: 'сюрприз', price: '300' })),
        })),
      })),
    });

    expect(deck?.name).toBe('Колода имени');
    expect(deck?.rounds).toHaveLength(12);
    expect(deck?.rounds[0].themes).toHaveLength(12);
    expect(deck?.rounds[0].themes[0].questions).toHaveLength(12);
    expect(deck?.rounds[0].themes[0].questions[0].type).toBe('simple');
    expect(deck?.rounds[0].themes[0].questions[0].price).toBe(300);
  });

  it('выбрасывает ссылки на посторонние схемы', () => {
    const deck = draft({
      rounds: [
        {
          themes: [
            {
              questions: [
                { media: { url: 'javascript:alert(1)', type: 'image' } },
                { media: { url: '/media/files/abc.png', type: 'image' } },
              ],
            },
          ],
        },
      ],
    });

    expect(deck?.rounds[0].themes[0].questions[0].media).toBeNull();
    expect(deck?.rounds[0].themes[0].questions[1].media).toEqual({
      url: '/media/files/abc.png',
      type: 'image',
    });
  });

  it('не принимает что-то, кроме объекта колоды', () => {
    expect(draft(null)).toBeNull();
    expect(draft([])).toBeNull();
    expect(draft('колода')).toBeNull();
  });
});
