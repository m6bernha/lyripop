# Lyripop

> Floating Spotify mini-player with synced lyrics — for Windows.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/m6bernha/lyripop/actions/workflows/ci.yml/badge.svg)](https://github.com/m6bernha/lyripop/actions/workflows/ci.yml)

A Discord-stream-popout-style desktop widget that pins to a corner of your screen, stays on top of every other app, and shows whatever you're playing on Spotify with synced lyrics rolling underneath. Useful while you work, game, or read.

<!-- TODO: hero screenshot at docs/screenshot.png -->

## Features

- **Now-playing**: cover, title, artist, album. Updates live.
- **Synced lyrics carousel** — Spotify-mobile-style scrolling with the active line bolded. Wheel-scroll to peek ahead, click any line to jump there. Falls back to plain lyrics for tracks lrclib doesn't have synced.
- **Hover the cover** for inline playback controls: shuffle, prev, play/pause, next, repeat, scrubber, volume popover, share.
- **Like/unlike** from the info strip.
- **Queue panel** with one-click skip-to-track preserving everything after.
- **Ambient album-color gradient** background (powered by `node-vibrant`).
- **Always-on-top, frameless, transparent corners.** Drag from anywhere on the cover.
- **No telemetry. No analytics. No ads.** Direct OAuth to Spotify; tokens never touch a third-party server.

## Install (one click)

1. Download the latest **`Lyripop_x.y.z_x64-setup.msi`** from the [Releases page](https://github.com/m6bernha/lyripop/releases).
2. Double-click → install.
3. Click **Log in with Spotify**. Your default browser opens. Approve. The widget populates within a couple seconds.

> **SmartScreen warning?** Until [SignPath OSS](https://signpath.org) signs our releases, Windows may flag the unsigned `.msi` as "unrecognized publisher." Click **More info → Run anyway**. The MSI's SHA-256 hash is published in the GitHub Release notes — verify it matches if you're cautious.

> **Spotify Premium recommended.** Free accounts can view now-playing + lyrics, but most playback controls are Premium-gated by Spotify itself.

## Privacy / Data flow

Lyripop talks to exactly four hosts. That's it.

| Host | What for |
|---|---|
| `accounts.spotify.com` | OAuth login + token refresh |
| `api.spotify.com` | Now-playing, queue, controls, like-state |
| `*.scdn.co` | Album cover images |
| `lrclib.net` | Synced lyrics (free, open, no auth needed) |

**No telemetry. No analytics. No crash reporters. No third-party servers.** Your Spotify tokens are stored in `%APPDATA%\com.m6bernha.lyripop\tokens.json` (read-protected by Windows under your user profile).

See [SECURITY.md](SECURITY.md) for the full threat model and known-acceptable risks.

## Build from source

```bash
git clone https://github.com/m6bernha/lyripop.git
cd lyripop
pnpm install
pnpm tauri dev
```

Requirements: Node 20+, pnpm 9+, Rust stable (`rustup default stable`), Windows 10+ with WebView2.

For sovereignty (your own Spotify quota / your own credentials), see [`.env.example`](.env.example) — you can override the bundled Client ID with your own.

## Built with

- **[Tauri 2](https://v2.tauri.app/)** — Rust + WebView2 desktop framework
- **[React 19](https://react.dev/)** + **[TypeScript](https://www.typescriptlang.org/)**
- **[Tailwind CSS 4](https://tailwindcss.com/)**
- **[Framer Motion](https://www.framer.com/motion/)** — smooth lyric animations
- **[Lucide](https://lucide.dev/)** — icon set
- **[node-vibrant](https://github.com/Vibrant-Colors/node-vibrant)** — album-art color extraction
- **[`@fabianlars/tauri-plugin-oauth`](https://github.com/FabianLars/tauri-plugin-oauth)** — PKCE OAuth flow
- **[lrclib.net](https://lrclib.net/)** — open synced-lyrics database (huge thanks to the lrclib community)

Special thanks to the [Spicetify](https://github.com/spicetify/cli) community for proving how a small focused desktop tool for Spotify users can build trust through transparency.

## Contributing

PRs welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the dev workflow.
Security issues: please follow [SECURITY.md](SECURITY.md), not public issues.

## License

[MIT](LICENSE) © m6bernha. Free as in beer, free as in speech.

This is a hobby project, not affiliated with Spotify AB. "Spotify" is a trademark of Spotify AB. Lyripop uses Spotify's official Web API under their Developer Terms of Service. lrclib is an independent community project; full credit to its maintainers and contributors.
