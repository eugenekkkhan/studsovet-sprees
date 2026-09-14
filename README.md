# Игры студсовета

Три игры для мероприятия: колесо удачи, «Поле чудес» и «Своя игра» с колодами,
табло и пультом ведущего. Фронт — React + Vite, сервер — NestJS с сокетами.

## Запуск

```bash
npm install
npm --prefix backend install

npm run dev            # фронт, http://localhost:5173
npm run dev:backend    # сервер, http://localhost:3000
```

Настройки — в `.env` (см. `.env.example`) и `backend/.env`
(см. `backend/.env.example`). Без них всё работает локально: фронт ищет сервер
на том же хосте, а сервер пускает по имени.

## Проверки

```bash
npm test               # фронт
npm run test:backend   # сервер
npm run lint
npm run build
```

## Быстрый деплой на test.traapp.ru

```bash
npm run deploy:test:front  # только frontend, без рестарта backend
npm run deploy:test:fast   # frontend + backend, без тестов
npm run deploy:test        # полный набор тестов и выкладка
npm run deploy:test:image  # обновить долговечный Docker-образ
```

Повседневный deploy собирает артефакты локально, переключает release внутри
работающего контейнера и проверяет публичный URL. При неуспешном health-check
автоматически возвращается предыдущая версия. `--image` нужен после изменения
Dockerfile, зависимостей или перед `docker compose --force-recreate`, чтобы
пересоздание контейнера не вернуло старый frontend.

Workflow `.github/workflows/deploy-test.yml` запускается вручную или push в
ветку `test`. Для него нужны GitHub secrets `VPS_SSH_KEY`, `VPS_HOST_KEY` и,
при желании, repository variable `SPREES_HOST`.

## Вход и колоды

Приложение открывается как мини-приложение Telegram или обычный сайт. Доступ к
закрытым разделам получают участники настроенных чатов «Важное» и «Флуд».
Колоды хранятся на сервере за автором — начатая на ноутбуке колода открывается
с телефона. Игровое табло доступно обычной публичной web-ссылкой.

Настройка бота, мини-приложения и доступа: [docs/telegram.md](docs/telegram.md).

Согласованная продуктовая и техническая архитектура, формулы рейтинга,
границы Telegram, хранение данных, отказоустойчивость и roadmap:
[docs/architecture.md](docs/architecture.md).

Глобальная карта функций, текущее состояние, этапы релизов и вопросы для
согласования: [docs/product-roadmap.md](docs/product-roadmap.md).

Функциональный аудит bottleneck'ов, обработка вступлений, центр уведомлений,
розыгрыши и ролевая модель админки:
[docs/functional-audit-and-rbac.md](docs/functional-audit-and-rbac.md).

## Устройство

| Каталог | Что внутри |
| --- | --- |
| `src/components` | атомы, молекулы, организмы — правила в [src/components/README.md](src/components/README.md) |
| `src/pages`, `src/routes` | экраны и маршруты; часть открыта по ключу комнаты, остальные — после входа |
| `src/api`, `src/context`, `src/hooks` | сокеты, HTTP, вход, состояние игр |
| `backend/src/quiz` | движок «Своей игры»: команды, раунды, торги, финал |
| `backend/src/field-of-miracles` | движок «Поля чудес» |
| `backend/src/auth`, `backend/src/telegram` | вход через Telegram и доступ по чату |
| `backend/src/decks` | библиотека колод пользователя |
