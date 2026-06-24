#!/usr/bin/env bash
# SCRIPT: rollback-oracle.sh
# IDEMPOTENT: False
# COST: destructive
# DESCRIPTION: Reaponta o symlink current para uma release existente e reinicia o backend no PM2.

set -euo pipefail

ROOT=${BOT_CONSOLE_ROOT:-/opt/bot-console-medieval}
RELEASES="$ROOT/releases"
CURRENT="$ROOT/current"
APP=bot-console-medieval-backend

list_releases() {
  echo "Release atual: $(readlink -f "$CURRENT" 2>/dev/null || echo nenhuma)"
  echo "Releases disponiveis:"
  find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r
}

if [[ $# -eq 0 ]]; then
  list_releases
  exit 0
fi

if [[ $# -ne 1 || ! $1 =~ ^[0-9]{14}$ ]]; then
  echo "Uso: $0 [release-id]" >&2
  exit 2
fi

TARGET="$RELEASES/$1"
if [[ ! -d "$TARGET" || ! -f "$TARGET/server.mjs" ]]; then
  echo "Release invalida ou inexistente: $1" >&2
  exit 3
fi

ln -sfn "$TARGET" "$CURRENT"
pm2 restart "$APP" --update-env
pm2 save

echo "Rollback concluido para: $TARGET"
