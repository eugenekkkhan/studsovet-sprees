/** Описание формата импорта — то же, что принимает `parseDeck`. */

export interface SchemaField {
  path: string;
  type: string;
  required: boolean;
  note: string;
}

export const DECK_SCHEMA: SchemaField[] = [
  { path: "name", type: "строка", required: false, note: "Название колоды; по умолчанию «Импортированная колода»." },
  { path: "author", type: "строка", required: false, note: "Автор пакета." },
  { path: "rounds[]", type: "массив", required: true, note: "Раунды по порядку. Без него импорт отклоняется." },
  { path: "rounds[].name", type: "строка", required: false, note: "Название раунда; по умолчанию «1-й раунд»." },
  { path: "rounds[].themes[]", type: "массив", required: true, note: "Темы раунда — строки табло." },
  { path: "themes[].name", type: "строка", required: true, note: "Название темы. Без него колода в игру не уйдёт." },
  { path: "themes[].questions[]", type: "массив", required: true, note: "Клетки темы слева направо." },
  { path: "questions[].price", type: "число", required: false, note: "Номинал. Если не указан — 100 × (номер раунда) × (номер клетки)." },
  { path: "questions[].text", type: "строка", required: true, note: "Текст вопроса." },
  { path: "questions[].answer", type: "строка", required: true, note: "Ответ; его видит только ведущий до раскрытия." },
  { path: "questions[].type", type: "simple | secret | stake | norisk", required: false, note: "Обычный, «Кот в мешке», аукцион, без риска. По умолчанию simple." },
  { path: "questions[].secretTheme", type: "строка", required: false, note: "Только для secret: тема, которую объявят при передаче." },
  { path: "questions[].secretPrice", type: "число", required: false, note: "Только для secret: цена «Кота», если отличается от номинала клетки." },
  { path: "questions[].comment", type: "строка", required: false, note: "Заметка редактора — видна только ведущему." },
  { path: "questions[].media", type: "{ url, type }", required: false, note: "Картинка или звук к вопросу. type: image | audio." },
  { path: "questions[].answerMedia", type: "{ url, type }", required: false, note: "То же, но показывается вместе с ответом." },
  { path: "finalThemes[]", type: "массив", required: false, note: "Темы финала: name, text, answer, при желании media." },
  { path: "id", type: "строка", required: false, note: "Свои идентификаторы можно не задавать — сервис выдаст собственные." },
];

export const DECK_LIMITS_NOTE = [
  "до 12 раундов, 12 тем в раунде и 12 клеток в теме",
  "текст вопроса до 2000 символов, ответ до 500",
  "файл при загрузке — до 64 МБ (png, jpg, webp, gif, svg, mp3, ogg, wav, m4a, mp4, webm, mov)",
];

export const DECK_IMPORT_EXAMPLE = `{
  "name": "Пример колоды",
  "author": "Студсовет",
  "rounds": [
    {
      "name": "Первый раунд",
      "themes": [
        {
          "name": "Кино",
          "questions": [
            {
              "price": 100,
              "text": "Программиста попросили проснуться, и он проснулся",
              "answer": "Матрица"
            },
            {
              "price": 200,
              "type": "secret",
              "secretTheme": "Зоология",
              "secretPrice": 500,
              "text": "Именно это животное спит вниз головой",
              "answer": "Летучая мышь"
            },
            {
              "price": 300,
              "type": "stake",
              "text": "Этот композитор написал «Времена года»",
              "answer": "Вивальди",
              "media": { "url": "/media/files/<id>.mp3", "type": "audio" }
            },
            {
              "price": 400,
              "type": "norisk",
              "text": "Столица Австралии",
              "answer": "Канберра",
              "comment": "Частая ошибка — Сидней"
            }
          ]
        }
      ]
    }
  ],
  "finalThemes": [
    {
      "name": "География",
      "text": "Самое глубокое озеро мира",
      "answer": "Байкал"
    }
  ]
}`;
