#!/usr/bin/env bash
# uninstall.sh — remove plugin, slash commands, state and the PATH symlink
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="$ROOT/bin/opencode-unlimited"
LINK="${HOME}/.local/bin/opencode-unlimited"

if [ -x "$BIN" ]; then
  node "$BIN" uninstall || true
fi

if [ -L "$LINK" ] || [ -f "$LINK" ]; then
  rm -f "$LINK"
  printf '  [x] removed %s\n' "$LINK"
fi

printf '  [x] the repo is still at %s, delete it by hand if you want\n' "$ROOT"
