# Заметки: где остановились с хостингом

Записано 5 сентября 2026. Приложение собрано и работает локально; наружу его
вывести не удалось из-за сети на машине, а не из-за кода.

## Что за приложение

React + Vite (фронт) и NestJS (сервер, socket.io) в одном репозитории. Три
игры: колесо удачи, «Поле чудес», «Своя игра». Колоды «Своей игры» хранятся на
сервере за пользователем; вход — через мини-приложение Telegram, доступ выдаётся
участникам чата, куда добавлен бот. Подробности настройки бота: `docs/telegram.md`.

Сервер теперь отдаёт и API, и собранный фронт с одного адреса
(`backend/src/static/spa.controller.ts` + `app.useStaticAssets` в `main.ts`), так
что наружу нужно вывести один порт — 3000. CORS при этом не нужен вообще.

## Что запущено прямо сейчас

| Что | Как | Заметка |
| --- | --- | --- |
| Сервер | `cd backend && nohup node dist/main.js &` | порт 3000, отдаёт фронт из `dist/` и API |
| Логи сервера | `/private/tmp/claude-501/-Users-eugene-pix-studsovet-sprees/063ae6ae-fdfe-456b-be14-096f16b8049a/scratchpad/host-backend.log` | каталог временный, переживёт только текущую сессию |
| Vite | `npm run dev` на 5173 | остался от разработки, для хостинга не нужен |
| cloudflared | остановлен | см. блокер ниже |

Проверка, что сервер жив:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/      # 200, страница
curl -s http://127.0.0.1:3000/auth/config                            # настройки входа
```

Сейчас отвечает: `requiresTelegram: true`, бот `@ammstudsovetbot` на связи,
чат с доступом один — `dev/future_needs` (id `-5164981951`).

Остановить: `pkill -f "node dist/main.js"`. Поднять заново:

```bash
npm run build                       # фронт → dist/
cd backend && npm run build         # сервер → backend/dist/
nohup node dist/main.js > /tmp/sprees.log 2>&1 &
```

Важно: держать только **один** процесс сервера с этим токеном бота. Второй
начнёт тянуть те же обновления Telegram, и они будут доставаться то одному, то
другому. Если второй экземпляр всё же нужен, ставьте ему `TELEGRAM_POLLING=0`.

## Блокер: cloudflared не поднимает тоннель

Ставили так:

```bash
brew install cloudflared            # установлен, версия 2026.8.3
cloudflared tunnel --url http://localhost:3000
```

Быстрый тоннель выдаёт ссылку `https://<случайное-имя>.trycloudflare.com`, но
соединение с краем Cloudflare не устанавливается: публичный адрес отвечает
ошибкой 1033, в логе — ноль строк `Registered tunnel connection`.

Две отдельные причины, обе в сети машины.

**1. DNS.** В `/etc/resolv.conf` нет ни одной строки `nameserver` (там только
комментарии macOS). Резолвер Go внутри cloudflared в таком случае ходит на
`[::1]:53`, где никто не слушает, и падает на SRV-запросе:

```
lookup _v2-origintunneld._tcp.argotunnel.com on [::1]:53: connection refused
```

При этом системный резолвер исправен — `dig @10.2.1.1 srv _v2-origintunneld._tcp.argotunnel.com`
и `dig @1.1.1.1 ...` отвечают нормально. `GODEBUG=netdns=cgo` не помогает:
бинарник собран без cgo.

**2. Порт 7844.** Если обойти поиск края флагом `--edge=198.41.192.47:7844`,
cloudflared доходит до TLS и обрывается:

```
Unable to establish connection with Cloudflare edge error="TLS handshake with edge error: EOF"
```

TCP на 7844 при этом открывается (`nc -z 198.41.192.47 7844` — успех), а
контрольный TLS на `api.cloudflare.com:443` проходит целиком. То есть рвётся
именно рукопожатие на 7844.

Машина сидит за VPN: `curl https://1.1.1.1/cdn-cgi/trace` показывает
`ip=103.227.84.158`, `loc=DE`, локальный адрес `10.2.1.116`. Похоже, и пустой
`resolv.conf`, и фильтрация 7844 — от него.

## Что делать дальше, по порядку

**Шаг 1. Починить DNS для cloudflared** (нужен пароль sudo, поэтому не сделано):

```bash
echo "nameserver 1.1.1.1" | sudo tee -a /etc/resolv.conf
dig srv _v2-origintunneld._tcp.argotunnel.com | head -5   # должны появиться region1/region2
```

macOS может переписать файл при смене сети — тогда повторить.

**Шаг 2. Поднять тоннель заново:**

```bash
cloudflared tunnel --url http://localhost:3000 --no-autoupdate
```

Успех виден по строкам `Registered tunnel connection` (обычно четыре) и по
ответу 200 на `curl https://<имя>.trycloudflare.com/`.

**Шаг 3. Если TLS на 7844 всё ещё рвётся** — это VPN. Варианты по убыванию
предпочтительности:

1. Отключить VPN на время и повторить шаг 2.
2. `cloudflared tunnel --url http://localhost:3000 --protocol http2` (пробовали,
   упирается в тот же 7844, но на другой сети может пройти).
3. Хостить не с ноутбука, а на VPS: там ни того, ни другого блокера нет.

**Шаг 4. Стабильный адрес вместо случайного.** Быстрый тоннель выдаёт новое имя
при каждом запуске, а в BotFather адрес мини-приложения вбивается руками — то
есть после каждого перезапуска его придётся менять. Если есть аккаунт Cloudflare
и домен, лучше именованный тоннель:

```bash
cloudflared tunnel login                       # откроет браузер
cloudflared tunnel create sprees
cloudflared tunnel route dns sprees sprees.<ваш-домен>
cloudflared tunnel run --url http://localhost:3000 sprees
```

## Что доделать, когда адрес появится

1. Записать его в `backend/.env`:

   ```
   MINI_APP_URL=https://t.me/ammstudsovetbot/<короткое_имя>
   ```

   (ссылка `t.me/бот/приложение` из BotFather, а не адрес сайта: только она
   открывает мини-приложение из группового чата)

2. В [@BotFather](https://t.me/BotFather): `/newapp` → выбрать `@ammstudsovetbot`
   → короткое имя → URL = публичный адрес тоннеля. BotFather вернёт ссылку
   `t.me/ammstudsovetbot/<короткое_имя>`.

3. Перезапустить сервер, чтобы он перечитал `.env`.

4. Кнопку меню бота можно выставить и без BotFather, через API:

   ```bash
   TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' backend/.env | cut -d= -f2-)
   curl -s -X POST "https://api.telegram.org/bot$TOKEN/setChatMenuButton" \
     -H 'content-type: application/json' \
     -d '{"menu_button":{"type":"web_app","text":"Игры","web_app":{"url":"https://<адрес тоннеля>"}}}'
   ```

5. Проверить с телефона: открыть бота, нажать кнопку меню, убедиться, что виден
   экран «Своя игра» и библиотека колод (а не экран «Вход через Telegram»).

## Грабли, на которые уже наступили

- Пустая строка `FRONTEND_ORIGIN=` в `.env` раньше означала «разрешён origin с
  пустым именем», и CORS резал всё. Починено: пустое значение читается как
  «любой origin» (`backend/src/env.ts`, `frontendOrigins`).
- `SESSION_SECRET` был пуст — сгенерирован и записан в `backend/.env`. Без него
  всех разлогинивает при каждом перезапуске.
- Пока сервер с настоящим токеном крутился на тестовых данных, он «съел»
  обновление о добавлении бота в чат `dev/future_needs`. Запись восстановлена
  вручную в `backend/data/chats.json`. Если такое повторится, достаточно
  написать в чате `/app` — бот запомнит чат заново.
- `backend/data/` и `backend/.env` в `.gitignore`. Колоды лежат в
  `backend/data/decks/tg-<id пользователя>.json`.

## Проверки перед выкладкой

```bash
npm run lint
npm test              # фронт, vitest
npm run test:backend  # сервер, jest
npm run build && (cd backend && npm run build)
```

Всё это сейчас проходит.
