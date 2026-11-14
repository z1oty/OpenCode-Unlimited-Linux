# OpenCode-Unlimited (proxy-auto branch)

> **Branch:** `proxy-auto` (Experimental auto-hunting proxy pool)  
> For the stable manual-egress version (recommended with VPN), switch to the [`main`](https://github.com/z1oty/OpenCode-Unlimited-Linux/tree/main) branch.

Linux port of [Tazmyan/OpenCode-Unlimited](https://github.com/Tazmyan/OpenCode-Unlimited) with automatic public proxy pool management, route hunting, anonymous token rotation, and session re-id.

---

> [!WARNING]
> ### ⚠️ Notice About Public Proxies
> **Public/scraped proxies very often do NOT work.**  
> - Most free proxies scraped from public lists are dead, blocked by Cloudflare/inference gateways, heavily throttled, or time out after a few seconds.
> - Proxy hunting may take multiple minutes and many attempts without discovering a functioning egress IP block.
> - If no working candidate is found in the pool, the tool automatically rolls back to your direct connection.
> - **Recommendation:** If you want reliable and uninterrupted usage, use the `main` branch with a VPN (e.g. Happ VPN / WireGuard), or provide your own private proxy via `opencode-unlimited proxy set socks5://host:port`.

---

## What it does (in `proxy-auto`)

Each time you run `opencode-unlimited on` it:

1. **Rotates anonymous session token** (`service.json`) — forces OpenCode to generate a fresh anonymous account on next startup
2. **Rotates virtual device ID**
3. **Selects free model** (`deepseek-v4.1-flash-free`)
4. **Fetches & ranks proxy pool** from public candidate lists
5. **Hunts for a live route** — tests proxies through an internal local bridge and probes connectivity
6. **Re-ids sessions & clears limit errors** in `opencode.db`
7. **Starts background watcher & autostart service** — detects limit lines and rotates routes automatically

After running `on`, reopen OpenCode so it registers a fresh anonymous token.

## Requirements

- Linux (tested on Arch Linux, works on Ubuntu/Debian/Fedora)
- Node.js ≥ 22.5
- [OpenCode](https://opencode.ai) installed and in `$PATH`
- `sqlite3`, `curl`

## Install (proxy-auto)

```bash
git clone -b proxy-auto https://github.com/z1oty/OpenCode-Unlimited-Linux
cd OpenCode-Unlimited-Linux
bash install.sh
```

Then run:

```bash
opencode-unlimited on
```

## Proxy Commands

```bash
# Full auto: token + identity + proxy hunt + sessions + watcher
opencode-unlimited on

# Faster pass (skips full gateway probe during proxy hunt)
opencode-unlimited on --no-probe

# Keep current proxy route without hunting
opencode-unlimited on --keep-route

# Manually hunt for a working proxy route
opencode-unlimited hunt

# Fetch fresh public proxy pool
opencode-unlimited proxy pool fetch

# Check proxy pool status & health rankings
opencode-unlimited proxy pool status

# Set your own reliable proxy (bypasses public pool)
opencode-unlimited proxy set socks5://127.0.0.1:1080
opencode-unlimited proxy set http://127.0.0.1:8080

# Disable proxy (revert to direct connection)
opencode-unlimited proxy off
```

## Other Commands

```bash
opencode-unlimited status          # inspect current state & route
opencode-unlimited off             # stop watcher & bridge
opencode-unlimited doctor          # check environment & dependencies
opencode-unlimited usage           # show free-tier usage & reset clock
opencode-unlimited reid .          # re-id sessions in folder
opencode-unlimited clear .         # clear stored limit errors in DB
```

## Comparison of Branches

| Feature | `main` (Manual / VPN) | `proxy-auto` (This branch) |
|---|---|---|
| **Egress Strategy** | Your own VPN / Manual proxy | Automatic public proxy pool |
| **Reliability** | ⭐⭐⭐⭐⭐ High (you control the exit) | ⭐⭐ Low (depends on public proxy health) |
| **Setup Speed** | Instant | Takes 1–5 min to hunt proxies |
| **Anonymous Token Rotation** | ✅ Yes | ✅ Yes |
| **Session Re-ID** | ✅ Yes | ✅ Yes |
| **Device ID Rotation** | ✅ Yes | ✅ Yes |
| **Watcher Autostart** | ✅ Yes | ✅ Yes |

## Credits

Original tool: [Tazmyan/OpenCode-Unlimited](https://github.com/Tazmyan/OpenCode-Unlimited)

Linux port developed with [Claude Opus 4.6](https://www.anthropic.com) & [DeepSeek V4.1 Flash](https://www.deepseek.com).
