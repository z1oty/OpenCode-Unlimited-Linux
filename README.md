# OpenCode-Unlimited — Linux port

Linux port of [Tazmyan/OpenCode-Unlimited](https://github.com/Tazmyan/OpenCode-Unlimited).

Adds anonymous session token rotation and session re-id on top of the original tool.

## What it does

Each time you run `opencode-unlimited on` it:

1. Rotates the anonymous session token (`service.json`) — the server uses this to track the daily free-message quota
2. Rotates the local device ID
3. Re-ids all sessions in the database (new session IDs, same messages)
4. Clears stored limit errors from the DB
5. Sets the free DeepSeek model
6. Starts the background watcher + systemd autostart unit

After running `on`, reopen OpenCode so it registers a fresh anonymous token.

## Requirements

- Linux (tested on Arch Linux)
- Node.js ≥ 22.5
- [OpenCode](https://opencode.ai) installed and in `$PATH`
- `sqlite3` available (usually pre-installed or `pacman -S sqlite` / `apt install sqlite3`)

## Install

```bash
git clone https://github.com/z1oty/OpenCode-Unlimited-Linux
cd OpenCode-Unlimited-Linux
bash install.sh
```

`install.sh` symlinks `bin/opencode-unlimited` into `~/.local/bin/`.  
Open a new terminal (or `source ~/.bashrc`) and run:

```bash
opencode-unlimited on
```

## Usage

```
opencode-unlimited on              # full reset: token + identity + sessions + watcher
opencode-unlimited on --keep-token # skip token rotation (keep existing session)
opencode-unlimited off             # stop watcher, disable autostart
opencode-unlimited status          # show current state
opencode-unlimited doctor          # check dependencies
opencode-unlimited identity rotate # rotate device ID only
opencode-unlimited reid .          # re-id sessions in current folder only
opencode-unlimited clear .         # clear limit errors in DB
opencode-unlimited proxy set socks5://host:port  # route OpenCode through a proxy
opencode-unlimited proxy off       # remove proxy
opencode-unlimited version         # show version
```

## Typical workflow when you hit the daily limit

1. Change your exit IP (VPN, different network, etc.)
2. Run `opencode-unlimited on` in terminal
3. Reopen OpenCode — fresh quota

## Differences from the original (Windows) version

| Feature | Original | This port |
|---|---|---|
| Platform | Windows | Linux |
| Anonymous token rotation | ❌ | ✅ `service.json` reset |
| Session re-id | ✅ | ✅ |
| Device ID rotation | ✅ | ✅ |
| Proxy support | ✅ | ✅ manual (`proxy set`) |
| Automatic proxy pool | ✅ | ❌ see `proxy-auto` branch |
| Systemd autostart | ❌ | ✅ |
| Watcher | ✅ | ✅ |

## Branches

| Branch | Description |
|---|---|
| `main` | Stable. Manual proxy — you supply the exit IP yourself |
| `proxy-auto` | Experimental. Automatic proxy hunting via VLESS/Xray |

## Credits

Original tool: [Tazmyan/OpenCode-Unlimited](https://github.com/Tazmyan/OpenCode-Unlimited)

Linux port developed with [Claude Opus 4.6](https://www.anthropic.com) & [DeepSeek V4.1 Flash](https://www.deepseek.com).

## License

MIT — see [LICENSE](LICENSE)
