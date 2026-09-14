"""Выгрузка участников чатов Telegram через Telethon.

Креды берутся из существующего .env (по умолчанию num-denum-script), сессия — локальная tg.session.

  python tg.py login                 — авторизация (спросит телефон и код)
  python tg.py check                 — жива ли сессия
  python tg.py dialogs [подстрока]   — найти чаты по названию
  python tg.py members <id|@name>... — выгрузить участников в out/
  python tg.py table                 — собрать markdown-таблицу из out/
"""
import asyncio
import csv
import json
import os
import sys

from telethon import TelegramClient
from telethon.tl.types import Channel, Chat, User

HERE = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.getenv("TG_ENV", "/Users/eugene/pix/num-denum-script/.env")


def load_env(path):
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip().strip("'\"")
    return env


ENV = load_env(ENV_PATH)
API_ID = int(os.getenv("API_ID") or ENV.get("API_ID", "0"))
API_HASH = os.getenv("API_HASH") or ENV.get("API_HASH", "")

if not API_ID or not API_HASH:
    sys.exit(f"Нет API_ID/API_HASH. Проверь {ENV_PATH} или переменные окружения.")

SESSION = os.getenv("TG_SESSION") or os.path.join(HERE, "tg")
client = TelegramClient(SESSION, API_ID, API_HASH)


def kind(entity):
    if isinstance(entity, User):
        return "личка"
    if isinstance(entity, Chat):
        return "группа"
    if isinstance(entity, Channel):
        return "супергруппа" if entity.megagroup else "канал"
    return type(entity).__name__


async def cmd_dialogs(args):
    query = " ".join(args).lower().strip()
    rows = []
    async for dialog in client.iter_dialogs():
        title = dialog.name or ""
        if query and query not in title.lower():
            continue
        entity = dialog.entity
        rows.append(
            {
                "id": dialog.id,
                "title": title,
                "type": kind(entity),
                "username": getattr(entity, "username", None) or "",
                "participants": getattr(entity, "participants_count", None) or "",
                "admin": bool(getattr(entity, "creator", False) or getattr(entity, "admin_rights", None)),
            }
        )
    for r in rows:
        flag = " [админ]" if r["admin"] else ""
        print(f'{r["id"]:>16}  {r["type"]:<12} {r["participants"]:>6}  {r["title"]}{flag}')
    print(f"\nвсего: {len(rows)}", file=sys.stderr)


async def cmd_members(args):
    if not args:
        sys.exit("Укажи чат: python tg.py members <id|@name> ...")
    for target in args:
        try:
            entity = await client.get_entity(int(target) if target.lstrip("-").isdigit() else target)
        except Exception as exc:
            print(f"!! {target}: не удалось получить чат — {exc}", file=sys.stderr)
            continue

        title = getattr(entity, "title", None) or getattr(entity, "username", str(target))
        members = []
        try:
            async for user in client.iter_participants(entity):
                part = getattr(user, "participant", None)
                role = type(part).__name__.replace("ChannelParticipant", "").replace("ChatParticipant", "") or "Member"
                members.append(
                    {
                        "id": user.id,
                        "username": user.username or "",
                        "first_name": user.first_name or "",
                        "last_name": user.last_name or "",
                        "phone": user.phone or "",
                        "bot": user.bot,
                        "deleted": user.deleted,
                        "premium": bool(getattr(user, "premium", False)),
                        "role": role or "Member",
                    }
                )
        except Exception as exc:
            print(f"!! {title}: список участников недоступен — {exc}", file=sys.stderr)
            continue

        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in title)[:60]
        base = os.path.join(HERE, "out", safe)
        with open(base + ".json", "w", encoding="utf-8") as fh:
            json.dump({"chat": title, "chat_id": entity.id, "members": members}, fh, ensure_ascii=False, indent=2)
        with open(base + ".csv", "w", encoding="utf-8", newline="") as fh:
            writer = csv.DictWriter(fh, fieldnames=list(members[0].keys()) if members else ["id"])
            writer.writeheader()
            writer.writerows(members)
        print(f"OK  {title}: {len(members)} участников -> out/{safe}.csv", file=sys.stderr)


def cmd_table(args):
    """Собирает markdown-таблицу из всех выгрузок в out/."""
    out_dir = os.path.join(HERE, "out")
    files = sorted(f for f in os.listdir(out_dir) if f.endswith(".json"))
    if not files:
        sys.exit("В out/ нет выгрузок. Сначала: python tg.py members <чат>")

    by_user = {}
    chats = []
    for name in files:
        with open(os.path.join(out_dir, name), encoding="utf-8") as fh:
            data = json.load(fh)
        chat = data["chat"]
        chats.append(chat)
        for m in data["members"]:
            if m["bot"] or m["deleted"]:
                continue
            row = by_user.setdefault(m["id"], {**m, "chats": {}})
            row["chats"][chat] = m["role"]

    header = ["#", "Имя", "@username", "ID"] + chats + ["Роль"]
    lines = ["| " + " | ".join(header) + " |",
             "|" + "|".join(["---"] * len(header)) + "|"]
    rows = sorted(by_user.values(), key=lambda r: (-len(r["chats"]), (r["first_name"] or "").lower()))
    for i, r in enumerate(rows, 1):
        name = " ".join(x for x in (r["first_name"], r["last_name"]) if x) or "—"
        roles = {v for v in r["chats"].values() if v not in ("Member", "")}
        cells = [str(i), name, f'@{r["username"]}' if r["username"] else "—", str(r["id"])]
        cells += ["✅" if c in r["chats"] else "—" for c in chats]
        cells.append(", ".join(sorted(roles)) if roles else "участник")
        lines.append("| " + " | ".join(cells) + " |")

    table = "\n".join(lines)
    path = os.path.join(out_dir, "table.md")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(f"# Участники\n\nЧаты: {', '.join(chats)}\nВсего людей: {len(rows)}\n\n{table}\n")
    print(table)
    print(f"\n-> out/table.md ({len(rows)} человек, {len(chats)} чата)", file=sys.stderr)


async def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    cmd, args = sys.argv[1], sys.argv[2:]

    if cmd == "table":
        cmd_table(args)
        return

    await client.connect()

    if cmd == "check":
        print("AUTH" if await client.is_user_authorized() else "NOT-AUTH")
        await client.disconnect()
        return

    if cmd == "login":
        await client.start()
    elif not await client.is_user_authorized():
        await client.disconnect()
        sys.exit("NOT-AUTH: сессия не авторизована. Запусти в своём терминале: python tg.py login")

    me = await client.get_me()
    print(f"# вошли как {me.first_name} (@{me.username})", file=sys.stderr)
    if cmd in ("login", "dialogs"):
        await cmd_dialogs(args)
    elif cmd == "members":
        await cmd_members(args)
    else:
        await client.disconnect()
        sys.exit(f"неизвестная команда: {cmd}")
    await client.disconnect()


asyncio.run(main())
