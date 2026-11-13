# OpenCode-Unlimited — Linux / Arch port

Linux port of [Tazmyan/OpenCode-Unlimited](https://github.com/Tazmyan/OpenCode-Unlimited).

A command-line companion for OpenCode v2 that makes the free tier visible and
workable:

- reads the real meter (it is keyed to your **egress IP block**, not to your
  account, project or session);
- tails the OpenCode log and notices the exact moment a free-limit line lands,
  without spending a prompt;
- clears the stale limit banner that OpenCode keeps replaying from stored rows;
- rotates a local virtual device identity and session ids;
- applies **your own** upstream proxy (HTTP or SOCKS5) and never picks one for you;
- can switch a folder or session to a different model.

```bash
opencode-unlimited on        # one pass, then leave the watcher running
```

Or drive it by hand:

```bash
opencode-unlimited usage
opencode-unlimited reset .
```

---

## Requirements

- Linux with a systemd **user** session (Arch, Fedora, Ubuntu, …)
- Node.js **>= 22.5** (the tool uses the built-in `node:sqlite`)
- `curl`
- OpenCode v2 on `PATH` (tested against `opencode 2.2.5`, API v2)
- optional: `jq`, `warp-cli`, `xray` for the optional VLESS helper

```bash
sudo pacman -S nodejs curl jq
```

## Install

```bash
git clone <this-repo> opencode-unlimited-linux
cd opencode-unlimited-linux
bash install.sh
```

`install.sh` checks the dependencies, makes `bin/opencode-unlimited` executable,
symlinks it into `~/.local/bin`, adds that directory to your shell rc if needed,
and registers the slash-command markdown files.

Open a new terminal (or `source ~/.bashrc`) and run:

```bash
opencode-unlimited doctor
```

Uninstall:

```bash
bash uninstall.sh
```

## Quick start

```bash
opencode-unlimited doctor      # node, opencode, database, curl, plugin
opencode-unlimited status      # runtime, identity, plugin, network, ledger
opencode-unlimited usage       # current egress block + reset clock
opencode-unlimited reset .     # new identity, re-id this folder, clear errors
opencode-unlimited on          # full auto + watcher/autostart
opencode-unlimited off         # stop watcher, remove autostart, direct egress
```

---

## What it actually does

### The meter follows the egress block

OpenCode's free bucket is counted against the IPv4 address (or IPv6 /64) that
reaches the gateway. A spent block stays spent until **00:00 UTC**, no matter how
many sessions or device ids you create on it. That is why the tool records every
egress block in `~/.config/opencode/unlimited-egress.json` and refuses to pretend
a reset worked when the address did not change.

### `reset`

1. mints a fresh virtual device id and project id (local files only, no system
   identifiers are read or written);
2. clears stored free-limit error rows (`db-tools.js`);
3. optionally re-ids every session in the given folder, keeping every message;
4. shows the upstream you configured (there is no automatic rotation);
5. records the current block in the ledger;
6. runs a quick integrity check with `--fix`.

`reset --dry` shows exactly what would be touched and writes nothing.

### `watch`

Scans `~/.local/share/opencode/log/opencode.log` for free-limit lines. A scan
spends zero prompts. `--follow` keeps tailing, `--all` rescans from the start.
When a limit line appears it reports it and tells you to change your own exit —
it never rotates or retries a proxy for you.

### `proxy`

You supply the upstream. `proxy set socks5://host:port` (or `http://…`) applies
it to the OpenCode service environment and tests it once; SOCKS5 is bridged to a
local HTTP port automatically. `proxy off` returns to direct egress.
`proxy status` shows the configured upstream and the current egress IP.

### `model`

Lists the providers that actually have credentials in the v2 database and can
switch a session (or every session in a folder) to another `provider/model`,
including free models. Switching away from `opencode/*` leaves the metered wall
behind.

### `on` / `off`

`on` runs the whole pass and installs:

- the shield plugin (`~/.config/opencode/plugins/unlimited-shield/index.js`),
  listed in `~/.config/opencode/opencode.json`;
- a systemd **user** unit
  `~/.config/systemd/user/opencode-unlimited-watch.service` that keeps
  `watch --follow` alive.

`off` stops the watcher, removes the unit, drops the service proxy environment,
parks the plugin and leaves sessions/messages/identity files untouched.

---

## Commands

| Command | Description |
|---------|-------------|
| `reset [path]` | New device id, new session ids, clear errors |
| `reset [path] --dry` | Show what would change, write nothing |
| `identity [rotate]` | Show or rotate the virtual device identity |
| `identity restore` | Drop the virtual identity |
| `block` | Egress blocks seen today, which are spent |
| `block check` | Is the address you are on now still usable |
| `block clear` | Clear today's ledger |
| `usage` | Meter summary, egress IP, reset clock |
| `usage --check` | Run a real throwaway probe against the app |
| `watch [--follow]` | Read the OpenCode log, zero prompts spent |
| `watch --follow` | Keep tailing the log |
| `token [save\|restore\|drop]` | Snapshot `auth.json` when the build uses one |
| `sessions [path]` | List sessions, ids and history size |
| `model` | List credentialed providers and free models |
| `model <spec>` | Switch this folder to `provider/model[#variant]` |
| `model <path\|id> <spec>` | Switch one session or a whole folder |
| `reid <id\|path>` | Mint fresh session ids, keep every message |
| `clear [path]` | Strip stored free-limit errors |
| `verify [--fix]` | Check sessions decode, repair dangling state |
| `install` | Install slash commands, detect the org id |
| `status` | Runtime, identity, plugin, network, ledger |
| `doctor` | Check node, opencode, database, schema, curl |
| `version` | Tool version + detected OpenCode version |
| `on` / `off` | Full auto setup / teardown |
| `proxy set <url>` | Route OpenCode through `socks5://` or `http://` |
| `proxy off` | Direct egress |
| `proxy status` | Configured upstream, bridge port, current IP |
| `plugin` | Plugin status |
| `plugin install` | Install and list the shield plugin |
| `plugin off` | Unlist and park the plugin |
| `warp on\|off\|rotate` | Cloudflare WARP path (optional, manual) |
| `run <args...>` | Run OpenCode once, no retry |
| `uninstall` | Remove plugin, slash commands and state files |

---

## Files and paths (XDG)

| Path | Purpose |
|------|---------|
| `~/.config/opencode/unlimited.json` | tool config (model, proxy, flags) |
| `~/.config/opencode/unlimited-identity.json` | virtual device id + project id |
| `~/.config/opencode/identity.json` | project id read by the shield plugin |
| `~/.config/opencode/unlimited-egress.json` | daily egress-block ledger |
| `~/.config/opencode/unlimited-info.json` | detected OpenCode info (5 min cache) |
| `~/.config/opencode/plugins/unlimited-shield/` | installed shield plugin |
| `~/.local/state/opencode-unlimited/machine-guid.txt` | virtual machine id |
| `~/.local/share/opencode/opencode.db` | OpenCode v2 database |
| `~/.local/share/opencode/log/opencode.log` | log watched by `watch` |
| `~/.config/systemd/user/opencode-unlimited-watch.service` | watcher unit |

All paths honour `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_STATE_HOME` and
`OPENCODE_CONFIG_DIR`.

## Environment switches

| Variable | Effect |
|----------|--------|
| `OPENCODE_UNLIMITED_NO_SYSTEMD=1` | never touch systemd, use a detached watcher process |
| `OPENCODE_UNLIMITED_NO_RESTART=1` | never restart the OpenCode service (useful while testing) |
| `OPENCODE_UNLIMITED_INFO_TTL` | seconds before the OpenCode info cache expires (default 300) |
| `OPENCODE_UNLIMITED_INFO_TIMEOUT` | ms allowed for detection commands (default 25000) |
| `OPENCODE_UNLIMITED_IDENTITY` | override the plugin identity file |

## Autostart

```bash
systemctl --user status  opencode-unlimited-watch.service
systemctl --user disable --now opencode-unlimited-watch.service
```

`opencode-unlimited on` enables the unit; `opencode-unlimited off` removes it.

---

## Differences from the Windows version

| Windows | Linux / Arch |
|---------|--------------|
| PowerShell `.ps1` | single Node.js CLI (`bin/opencode-unlimited`) |
| Task Scheduler | systemd **user** service |
| `%APPDATA%\opencode` | `~/.config/opencode` (XDG) |
| `%LOCALAPPDATA%\opencode` | `~/.local/share/opencode` (XDG) |
| registry machine GUID | local file only (`machine-guid.txt`) |
| `.exe` / `.cmd` lookup | `$PATH`, `~/.local/bin`, `~/.bun/bin`, `~/.npm-global/bin` |

OpenCode v2 keeps credentials in its SQLite database (`credential` / `account`
tables), so `auth.json` and `token save` are usually a no-op on Linux. The model
listing reads those tables directly.

## Optional: your own VLESS proxy

If you install `xray` yourself (`pacman -S xray`), point the tool at the local
SOCKS5 port; no subscription parsing or rotating is built in:

```bash
opencode-unlimited proxy set socks5://127.0.0.1:10808
```

## Troubleshooting

**`doctor` reports an old Node.**
```bash
paru -S nodejs     # or: nvm install 22
```

**`usage` says the block is spent but prompts still work.**
Remaining budget is not linear. A long chat replays its whole history on every
turn, so a heavy session can hit the wall before a fresh one does.

**Sessions are not re-ided.**
The folder you named must match the session `directory` in the database. Check
with `opencode-unlimited sessions /path`.

**The watcher keeps restarting.**
```bash
journalctl --user -u opencode-unlimited-watch -n 50
```

**`off` briefly restarts OpenCode.**
It clears the service proxy environment through `opencode service unset env`,
which makes the background server reload. Sessions are preserved.

---

## Disclaimer

Educational and research use only. Not affiliated with OpenCode. Using it may
break a provider's terms of service — that is your responsibility.
