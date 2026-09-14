# tg-members

Выгрузка участников чатов Telegram через Telethon.

## Запуск

Готовый venv с telethon 1.42 уже есть:

```bash
cd tools/tg-members
PY=/Users/eugene/pix/scripts/venv/bin/python

$PY tg.py login                          # телефон + код из Telegram (+ 2FA, если включена)
$PY tg.py dialogs студсовет               # найти чат по подстроке названия
$PY tg.py members -1001234567890 ...      # выгрузить участников в out/
$PY tg.py table                           # собрать out/table.md
```

API_ID/API_HASH читаются из `/Users/eugene/pix/num-denum-script/.env`
(переопределяется через `TG_ENV`), сессия — локальный `tg.session`
(переопределяется через `TG_SESSION`).

## Что на выходе

- `out/<Чат>.json` и `out/<Чат>.csv` — id, username, имя, телефон, роль, premium-флаг
- `out/table.md` — сводная таблица: люди × чаты, с ролями и отметкой пересечений

Боты и удалённые аккаунты в сводную таблицу не попадают (в CSV остаются).

## Ограничения

- Список участников открыт для групп и супергрупп, где ты состоишь.
  Для каналов Telegram отдаёт полный список только админам — иначе придут
  одни админы или `ChatAdminRequiredError`.
- Телефоны видны только у контактов.
- `tg.session` и `.env` в `.gitignore` — это доступ к аккаунту, не коммить.
