# Lyripop — Claude Code project guide

Floating always-on-top Spotify mini-player widget for Windows. Tauri 2 + React 19 + TS + Tailwind 4 + Vite 7. v0.1.0 shipped 2026-04-27, v0.1.1 in flight 2026-05-01.

## Mission

Lightweight, transparent, no third-party data flow. Free hobby project (MIT). Hard "no" on telemetry, analytics, crash reporters, paid features.

## Privacy boundary — four hosts only

| Host | What for |
|---|---|
| `accounts.spotify.com` | OAuth login + token refresh |
| `api.spotify.com` | Now-playing, queue, controls, like-state |
| `*.scdn.co` | Album cover images |
| `lrclib.net` | Synced lyrics (free, open, no auth) |

Anything else is a SECURITY.md update + CSP loosening + capability grant. High friction by design.

## Build commands

| What | Command | Notes |
|---|---|---|
| Install | `pnpm install` | Node 20+, pnpm 9+ |
| Dev | `pnpm tauri dev` | Spawns Vite + Tauri webview |
| Build (prod) | `pnpm tauri build` | Produces MSI + NSIS in `src-tauri/target/release/bundle/` |
| Type-check | `pnpm exec tsc --noEmit` | Mirrors CI |
| Rust check | `cd src-tauri && cargo check --locked` | Mirrors CI |
| Rust lint | `cd src-tauri && cargo clippy --locked -- -D warnings` | Mirrors CI |

CI: `.github/workflows/ci.yml` runs all of the above on push/PR to `main`. Release: `.github/workflows/release.yml` fires on `v*` tags.

## Sensitive areas — extra scrutiny

- `src/lib/auth.ts` — OAuth/PKCE flow, token handling. Changes need security review.
- `src-tauri/capabilities/default.json` — Tauri permission grants. Every permission must correspond to a real call site.
- `src-tauri/tauri.conf.json` — `app.security.csp` and bundle config. Only loosen CSP with documented reason.
- `package.json` + `src-tauri/Cargo.toml` deps — adding a new dep requires justifying why stdlib / existing deps don't suffice. Keep the graph small.
- Anything that adds a new outbound host — must update SECURITY.md, README.md privacy table, and CSP.

## Key files

| Path | LOC | Purpose |
|---|---|---|
| `src/App.tsx` | 62 | Root, AuthGate routing |
| `src/components/AuthGate.tsx` | 101 | Auth state machine: `loading` / `needs-client-id` / `needs-login` / `authed` |
| `src/components/ClientIdSetup.tsx` | 168 | First-run BYO Client-ID wizard (Spotify May-2025 quota pivot) |
| `src/components/MiniPlayer.tsx` | 192 | Now-playing + lyrics/queue view toggle + ambient color |
| `src/components/HoverControls.tsx` | 241 | Inline playback controls + scrubber + volume + share + like |
| `src/components/LyricsCarousel.tsx` | 176 | Synced lyrics with wheel-scroll, click-to-seek, idle snap-back |
| `src/components/QueuePanel.tsx` | 130 | Up-next list with click-to-skip preserving rest of queue |
| `src/components/AmbientBackground.tsx` | 35 | Album-color gradient (node-vibrant) |
| `src/hooks/useSpotify.ts` | 195 | Now-playing polling with exponential backoff (1s→32s) |
| `src/hooks/useLyrics.ts` | 104 | lrclib fetch + LRC parsing + active-line tracking |
| `src/hooks/useAlbumColor.ts` | 154 | node-vibrant extraction with smooth crossfade |
| `src/lib/auth.ts` | 290 | PKCE OAuth, token storage (`%APPDATA%\com.m6bernha.lyripop\tokens.json`), silent refresh |
| `src/lib/spotify.ts` | 151 | API client (`apiCall` wrapper) — single point for 401/429 handling work |
| `src/lib/lrclib.ts` | 86 | LRC parser, plain-lyrics fallback |
| `src-tauri/src/lib.rs` | 28 | Tauri plugin registration |
| `src-tauri/src/main.rs` | 6 | Entry shim |

## Reusable patterns (don't reinvent)

- **`cancelled` flag** in polling hooks (`useSpotify.ts:64-95`, `useLyrics.ts:60-89`) — copy this shape for any new polling/async loop.
- **`apiCall` wrapper** in `spotify.ts` — single chokepoint to add 401/403/429 handling. Don't sprinkle handling at call sites.
- **Tauri Store key convention** in `auth.ts:44-98` (`store.get("spotify")` / `store.set("spotify", …)`) — wrap behind a `tokenStore` interface for the v0.2 keychain swap.

## What I'll likely decline (per CONTRIBUTING.md)

- Telemetry / analytics / crash reporters in any form.
- Ads or sponsorship integration in the app.
- Paid features.
- Massive refactors without prior discussion.
- Style-only rewrites of existing code.
- Suggestions to centralize the Client ID — Spotify policy blocks shared Client IDs above 25 users; the BYO wizard is here to stay.

## Gotcha

**Neither `pnpm` nor `cargo` is on PATH on this Windows machine.** Pre-commit checks (tsc, cargo check, cargo clippy) defer to GitHub CI. See `~/.claude/projects/C--Users-matth--vscode-projects-lyripop/memory/feedback_no_local_build_toolchain.md`.
