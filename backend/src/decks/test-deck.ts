/** Минимальная колода для тестов: один раунд, одна тема, один вопрос. */
export const createDeckDraft = (id: string, name: string) => ({
  id,
  name,
  author: 'Тест',
  rounds: [
    {
      id: `${id}-r1`,
      name: 'Раунд',
      themes: [
        {
          id: `${id}-t1`,
          name: 'Тема',
          comment: '',
          questions: [
            {
              id: `${id}-q1`,
              type: 'simple',
              price: 100,
              text: 'Вопрос',
              answer: 'Ответ',
              comment: '',
              media: null,
              answerMedia: null,
              secretTheme: '',
              secretPrice: null,
            },
          ],
        },
      ],
    },
  ],
  finalThemes: [],
});
