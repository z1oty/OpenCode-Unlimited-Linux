#!/usr/bin/env bash
# install.sh — OpenCode-Unlimited installer for Linux / Arch
set -euo pipefail

RED=$'\e[31m' GRN=$'\e[32m' YLW=$'\e[33m' GRY=$'\e[90m' RST=$'\e[0m'
ok()   { echo "  ${GRN}[+]${RST} $1"; }
bad()  { echo "  ${RED}[x]${RST} $1"; exit 1; }
warn() { echo "  ${YLW}[!]${RST} $1"; }
info() { echo "      ${GRY}$1${RST}"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="$ROOT/bin/opencode-unlimited"
BIN_DIR="$HOME/.local/bin"

echo "==> opencode-unlimited install (Linux/Arch)"
echo

required=(
    "$ROOT/lib/proxy-bridge.js"
    "$ROOT/lib/oc-info.js"
    "$ROOT/lib/db-tools.js"
    "$ROOT/lib/session-reid.js"
    "$ROOT/lib/identity.js"
    "$ROOT/lib/egress.js"
    "$ROOT/lib/log-watch.js"
    "$ROOT/lib/model-switch.js"
    "$ROOT/lib/paths.js"
    "$ROOT/plugins/unlimited-shield.js"
    "$BIN"
)
for f in "${required[@]}"; do
    [[ -f "$f" ]] || bad "missing file: $f"
done
ok "all files present"

chmod +x "$BIN" "$ROOT/install.sh" "$ROOT/uninstall.sh"
ok "bin/opencode-unlimited is executable"

if ! command -v node >/dev/null 2>&1; then
    bad "node not found — install with: pacman -S nodejs"
fi
NV="$(node --version)"
MAJOR="${NV#v}"; MAJOR="${MAJOR%%.*}"
MINOR="${NV#v}"; MINOR="${MINOR#*.}"; MINOR="${MINOR%%.*}"
ok "node $NV"
if (( MAJOR < 22 || (MAJOR == 22 && MINOR < 5) )); then
    warn "node >= 22.5 is required for the built-in SQLite reader"
fi

if command -v opencode >/dev/null 2>&1; then
    ok "opencode $(opencode --version 2>/dev/null | head -n1)"
else
    warn "opencode not found on PATH, install it first: https://opencode.ai"
fi

command -v jq >/dev/null 2>&1 && ok "jq $(jq --version)" || warn "jq not found (optional): pacman -S jq"
command -v curl >/dev/null 2>&1 && ok "curl present" || bad "curl not found — install with: pacman -S curl"

mkdir -p "$BIN_DIR"
ln -sfn "$BIN" "$BIN_DIR/opencode-unlimited"
ok "symlinked $BIN_DIR/opencode-unlimited"

SHELL_RC="$HOME/.bashrc"
if [[ -n "${ZSH_VERSION:-}" || -f "$HOME/.zshrc" ]]; then
    SHELL_RC="$HOME/.zshrc"
fi

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    if ! grep -q "opencode-unlimited" "$SHELL_RC" 2>/dev/null; then
        {
            echo ""
            echo "# opencode-unlimited"
            echo "export PATH=\"\$PATH:$BIN_DIR\""
        } >> "$SHELL_RC"
        ok "added $BIN_DIR to PATH in $SHELL_RC"
    else
        info "PATH entry already present in $SHELL_RC"
    fi
else
    info "$BIN_DIR is already on PATH"
fi

echo
node "$BIN" install || true
echo
ok "installed"
echo
info "next steps:"
info "  source $SHELL_RC   (or open a new terminal)"
info "  opencode-unlimited doctor"
info "  opencode-unlimited usage"
info "  opencode-unlimited reset ."
info "  opencode-unlimited on"
