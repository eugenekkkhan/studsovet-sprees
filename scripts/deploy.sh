#!/usr/bin/env bash
# Быстрая выкладка на test.traapp.ru без сборки Docker-образа на VPS.
#
#   npm run deploy:test        проверки + frontend/backend
#   npm run deploy:test:fast   без тестов + frontend/backend
#   npm run deploy:test:front  только frontend, без перезапуска приложения
#   ./scripts/deploy.sh --image  пересобрать долговечный Docker-образ на VPS
set -euo pipefail

HOST="${SPREES_HOST:-root@217.199.253.229}"
SSH_KEY="${SPREES_SSH_KEY:-${HOME}/.ssh/traapp_deploy}"
REMOTE_DIR="${SPREES_REMOTE_DIR:-/srv/studsovet-sprees}"
PUBLIC_URL="${SPREES_PUBLIC_URL:-https://test.traapp.ru}"
CONTAINER="${SPREES_CONTAINER:-deploy-app-1}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)"
SSH=(ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=30)

mode="app"
tests=1
build_local=1
for arg in "$@"; do
  case "$arg" in
    --fast|-f) tests=0 ;;
    --frontend|--front) mode="frontend"; tests=0 ;;
    --image) mode="image" ;;
    --prebuilt) tests=0; build_local=0 ;;
    *) echo "Неизвестный ключ: $arg" >&2; exit 2 ;;
  esac
done

cd "$ROOT"
step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

if [ "$mode" = "image" ]; then
  step "Синхронизация исходников"
  rsync -az --delete --exclude-from="$ROOT/scripts/rsync-excludes.txt" \
    -e "ssh -i $SSH_KEY -o BatchMode=yes -o ConnectTimeout=30" ./ "$HOST:$REMOTE_DIR/"
  step "Пересборка долговечного образа"
  "${SSH[@]}" "$HOST" "cd '$REMOTE_DIR/deploy' && docker compose up -d --build app"
else
  if [ "$build_local" -eq 1 ]; then
    step "Локальная сборка"
    npm run build
    if [ "$mode" = "app" ]; then npm run build:backend; fi
  fi

  if [ "$tests" -eq 1 ]; then
    step "Тесты"
    npm test -- --run
    npm run test:backend -- --runInBand
  fi

  step "Синхронизация исходников и артефактов"
  rsync -az --delete --exclude-from="$ROOT/scripts/rsync-excludes.txt" \
    -e "ssh -i $SSH_KEY -o BatchMode=yes -o ConnectTimeout=30" ./ "$HOST:$REMOTE_DIR/"

  "${SSH[@]}" "$HOST" "mkdir -p '$REMOTE_DIR/.releases/$RELEASE_ID'"
  rsync -az -e "ssh -i $SSH_KEY -o BatchMode=yes -o ConnectTimeout=30" \
    dist/ "$HOST:$REMOTE_DIR/.releases/$RELEASE_ID/dist/"
  if [ "$mode" = "app" ]; then
    rsync -az -e "ssh -i $SSH_KEY -o BatchMode=yes -o ConnectTimeout=30" \
      backend/dist/ "$HOST:$REMOTE_DIR/.releases/$RELEASE_ID/backend/"
  fi

  step "Активация release $RELEASE_ID"
  "${SSH[@]}" "$HOST" "docker exec '$CONTAINER' rm -rf /tmp/sprees-dist-new /tmp/sprees-backend-new"
  "${SSH[@]}" "$HOST" "docker cp '$REMOTE_DIR/.releases/$RELEASE_ID/dist/.' '$CONTAINER:/tmp/sprees-dist-new'"
  if [ "$mode" = "app" ]; then
    "${SSH[@]}" "$HOST" "docker cp '$REMOTE_DIR/.releases/$RELEASE_ID/backend/.' '$CONTAINER:/tmp/sprees-backend-new'"
    "${SSH[@]}" "$HOST" "docker exec '$CONTAINER' sh -lc 'rm -rf /app/dist.previous /app/backend/dist.previous; mv /app/dist /app/dist.previous; mv /tmp/sprees-dist-new /app/dist; mv /app/backend/dist /app/backend/dist.previous; mv /tmp/sprees-backend-new /app/backend/dist' && docker restart '$CONTAINER' >/dev/null"
  else
    "${SSH[@]}" "$HOST" "docker exec '$CONTAINER' sh -lc 'rm -rf /app/dist.previous; mv /app/dist /app/dist.previous; mv /tmp/sprees-dist-new /app/dist'"
  fi
fi

step "Health-check"
ok=0
for _ in 1 2 3 4 5 6; do
  if curl -fsS --max-time 10 "$PUBLIC_URL/" >/dev/null; then ok=1; break; fi
  sleep 2
done

if [ "$ok" -ne 1 ]; then
  if [ "$mode" != "image" ]; then
    step "Health-check не прошёл — откат"
    "${SSH[@]}" "$HOST" "docker exec '$CONTAINER' sh -lc 'rm -rf /app/dist.failed; mv /app/dist /app/dist.failed; mv /app/dist.previous /app/dist; if [ -d /app/backend/dist.previous ]; then rm -rf /app/backend/dist.failed; mv /app/backend/dist /app/backend/dist.failed; mv /app/backend/dist.previous /app/backend/dist; fi' && docker restart '$CONTAINER' >/dev/null"
  fi
  echo "Деплой не прошёл health-check: $PUBLIC_URL" >&2
  exit 1
fi

printf '\033[32mГотово: %s · release %s\033[0m\n' "$PUBLIC_URL" "$RELEASE_ID"
