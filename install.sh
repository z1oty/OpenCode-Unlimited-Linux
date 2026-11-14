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
    if command -v pacman >/dev/null 2>&1; then
        bad "node not found — install with: pacman -S nodejs"
    elif command -v apt >/dev/null 2>&1; then
        bad "node not found — install with: apt install nodejs"
    elif command -v dnf >/dev/null 2>&1; then
        bad "node not found — install with: dnf install nodejs"
    elif command -v zypper >/dev/null 2>&1; then
        bad "node not found — install with: zypper install nodejs"
    else
        bad "node not found — install nodejs >= 22.5 from https://nodejs.org"
    fi
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

ln -sfn "$BIN" "$ROOT/opencode-unlimited"
ok "symlinked $ROOT/opencode-unlimited"

# If /usr/local/bin is writable, link there so it works immediately across all shells
if [[ -w "/usr/local/bin" ]]; then
    ln -sfn "$BIN" "/usr/local/bin/opencode-unlimited" 2>/dev/null && ok "symlinked /usr/local/bin/opencode-unlimited" || true
elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo ln -sfn "$BIN" "/usr/local/bin/opencode-unlimited" 2>/dev/null && ok "symlinked /usr/local/bin/opencode-unlimited" || true
fi

SHELL_RC="$HOME/.bashrc"
if [[ -n "${ZSH_VERSION:-}" || -f "$HOME/.zshrc" ]]; then
    SHELL_RC="$HOME/.zshrc"
fi

# Ensure ~/.local/bin is added to shell rc files
for rc in "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.profile" "$HOME/.zshrc"; do
    if [[ -f "$rc" ]] && ! grep -q "opencode-unlimited" "$rc" 2>/dev/null; then
        {
            echo ""
            echo "# opencode-unlimited"
            echo "export PATH=\"\$PATH:$BIN_DIR\""
        } >> "$rc"
    fi
done

if [[ ":$PATH:" == *":$BIN_DIR:"* ]]; then
    info "$BIN_DIR is already on PATH"
else
    ok "added $BIN_DIR to PATH in shell configuration"
fi

echo
node "$BIN" install || true
echo
ok "installed"
echo
echo -e "  \e[1;33m[!] IMPORTANT:\e[0m If this is your first install in this terminal session, run:"
echo -e "      \e[1;32msource $SHELL_RC\e[0m   (or reopen the terminal)"
echo -e "      or run directly: \e[1;32m./opencode-unlimited on\e[0m"
echo
info "next steps:"
info "  opencode-unlimited doctor"
info "  opencode-unlimited usage"
info "  opencode-unlimited reset ."
info "  opencode-unlimited on"
