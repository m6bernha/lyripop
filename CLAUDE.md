# Lyripop — Claude Code project guide

Floating always-on-top Spotify mini-player widget for Windows. Tauri 2 + React 19 + TS + Tailwind 4 + Vite 7. v0.1.0 shipped 2026-04-27, v0.1.1 shipped 2026-05-02, v0.1.2 shipped 2026-05-06 (vitest pipeline + typed Spotify errors + AuthContext re-auth signal).

## Mission

Lightweight, transparent, no third-party data flow. Free hobby project (MIT). Hard "no" on telemetry, analytics, crash reporters, paid features.

## Privacy boundary — four hosts only

| Host | What for |
|---|---|
| `accounts.spotify.com` | OAuth login + token refresh |
| `api.spotify.com` | Now-playing, queue, controls, like-state |
| `*.scdn.co` | Album cover images |
| `lrclib.net` | Synced lyrics (free, open, no auth) — **opt-out via Settings → Lyrics fetching** |

Anything else is a SECURITY.md update + CSP loosening + capability grant. High friction by design.

## Build commands

| What | Command | Notes |
|---|---|---|
| Install | `pnpm install` | Node 20+, pnpm 9+ |
| Dev | `pnpm tauri dev` | Spawns Vite + Tauri webview |
| Build (prod) | `pnpm tauri build` | Produces MSI + NSIS in `src-tauri/target/release/bundle/` |
| Type-check | `pnpm exec tsc --noEmit` | Mirrors CI |
| Tests | `pnpm test` | Vitest, 88 tests on `src/lib/**`. Mirrors CI. |
| Tests + coverage | `pnpm test:coverage` | Gated 70% lines / 70% functions / 60% branches. |
| Rust check | `cd src-tauri && cargo check --locked` | Mirrors CI |
| Rust lint | `cd src-tauri && cargo clippy --locked -- -D warnings` | Mirrors CI |
| Rust tests | `cd src-tauri && cargo test --locked` | Smoke skeleton only; real tests land with v0.2 keyring swap. |

CI: `.github/workflows/ci.yml` runs all of the above on push/PR to `main`. Release: `.github/workflows/release.yml` fires on `v*` tags.

## Sensitive areas — extra scrutiny

- `src/lib/auth.ts` — OAuth/PKCE flow, token handling. Changes need security review.
- `src-tauri/capabilities/default.json` — Tauri permission grants. Every permission must correspond to a real call site.
- `src-tauri/tauri.conf.json` — `app.security.csp` and bundle config. Only loosen CSP with documented reason.
- `package.json` + `src-tauri/Cargo.toml` deps — adding a new dep requires justifying why stdlib / existing deps don't suffice. Keep the graph small. Tauri features (e.g. `tray-icon`) are gated and need explicit opt-in — see memory `feedback_tauri_tray_feature_gate.md`. Current justified deps include `tauri-plugin-autostart` (no stdlib equivalent for Windows registry / macOS LaunchAgent autostart) and `@testing-library/react` (devDep — standard React hook test harness).
- Anything that adds a new outbound host — must update SECURITY.md, README.md privacy table, and CSP.

## Key files

| Path | LOC | Purpose |
|---|---|---|
| `src/App.tsx` | 95 | Root, wrapped in `SettingsProvider` + `AuthGate`. Owns `mode` + `view` state (`lyrics` / `queue` / `settings` / `none`), window-size driver. |
| `src/context/SettingsContext.tsx` | ~140 | `SettingsProvider` + `useSettings()`. Exposes 4 settings: `lyricsEnabled` / `alwaysOnTop` / `autostartEnabled` / `pollIntervalMs`. localStorage-backed via `useLocalStorage` for the first three; autostart syncs from the OS plugin. Applies `alwaysOnTop` to the Tauri window in an effect so a fresh launch reflects the stored value before Settings is opened. |
| `src/hooks/useLocalStorage.ts` | 50 | Generic JSON-backed persisted React state with optional validate guard. Used by SettingsContext; deliberately not used by App.tsx's older `view`/`mode` plain-string keys. |
| `src/components/AuthGate.tsx` | 138 | Auth state machine: `loading` / `needs-client-id` / `needs-login` / `authed`. Exports `AuthContext` carrying `forceReauth()` (tokens-only wipe → `needs-login`) and `resetClientId()` (full wipe → `needs-client-id`). |
| `src/components/ClientIdSetup.tsx` | 168 | First-run BYO Client-ID wizard (Spotify May-2025 quota pivot) |
| `src/components/SettingsPanel.tsx` | ~310 | Settings page reachable from the cog icon. Sections: Spotify connection (masked Client ID, Sign out, two-step Reset connection) + Preferences (lyrics fetching toggle, always-on-top toggle, launch-on-startup toggle, polling-cadence select) + About (version, repo link, Spotify dashboard link). Consumes `useSettings()` and `AuthContext`. |
| `src/components/MiniPlayer.tsx` | 257 | Now-playing + lyrics/queue/settings view toggle + ambient color + widget-level hover state + expanded side-by-side layout. Consumes `AuthContext` + `useSettings()` (for `pollIntervalMs`) and forwards `onAuthFailure` + `pollIntervalMs` to `useSpotify`. Settings cog lives between queue toggle and close X in the info strip. |
| `src/components/HoverControls.tsx` | 241 | Inline playback controls + scrubber + volume + share + like |
| `src/components/LyricsCarousel.tsx` | 176 | Synced lyrics with wheel-scroll, click-to-seek, idle snap-back |
| `src/components/QueuePanel.tsx` | 130 | Up-next list with click-to-skip preserving rest of queue |
| `src/components/ExpandToggle.tsx` | 34 | Hover-reveal compact↔expanded button (bottom-right, framer-motion fade) |
| `src/components/AmbientBackground.tsx` | 35 | Album-color gradient (node-vibrant) |
| `src/hooks/useSpotify.ts` | 245 | Now-playing polling. Cadence comes from `opts.pollIntervalMs` (read live via ref); `SpotifyAuthError` → cancel + `onAuthFailure`; `SpotifyRateLimitError` → honour `Retry-After` + 200ms jitter; other → exponential ladder capped at 32s. |
| `src/hooks/useLyrics.ts` | 113 | lrclib fetch + LRC parsing + active-line tracking. Third arg `enabled` (default `true`) gates the network call entirely — when off, returns the EMPTY shape and the LyricsCarousel renders an explanatory empty state. |
| `src/hooks/useAlbumColor.ts` | 154 | node-vibrant extraction with smooth crossfade |
| `src/lib/auth.ts` | 296 | PKCE OAuth (helpers in `pkce.ts`), token storage (`%APPDATA%\com.m6bernha.lyripop\tokens.json`), silent refresh + `forceRefreshAccessToken()` for 401 recovery. |
| `src/lib/pkce.ts` | 30 | RFC 7636 PKCE helpers (`generateCodeVerifier`, `generateCodeChallenge`, `base64UrlEncode`). Extracted from auth.ts in v0.1.2 for direct unit-testability. |
| `src/lib/spotify.ts` | 266 | API client. `SpotifyClient.req<T>()` is the single chokepoint — 401 forces refresh + retries once (`SpotifyAuthError`), 403 throws (no retry), 429 throws `SpotifyRateLimitError(retryAfterMs)`. |
| `src/lib/lrclib.ts` | 86 | LRC parser, plain-lyrics fallback |
| `src/lib/__tests__/` | — | Vitest suites: `pkce.test.ts`, `lrclib.test.ts`, `auth.test.ts` (Map-backed Store fake), `spotify.test.ts` (fetch-mocked). 88 tests total. |
| `src-tauri/src/lib.rs` | 90 | Tauri plugin registration + tray icon (Show/Hide + Quit menu) + window toggle helper + `#[cfg(test)] mod tests` smoke. |
| `src-tauri/src/main.rs` | 6 | Entry shim |

## Reusable patterns (don't reinvent)

- **`cancelled` flag** in polling hooks (`useSpotify.ts`, `useLyrics.ts:60-89`) — copy this shape for any new polling/async loop.
- **`SpotifyClient.req<T>()`** is the single API chokepoint (private method on the class — NOT a free `apiCall` function; pre-Tier-B notes had this wrong). 401/403/429 handling lives there; don't sprinkle handling at call sites.
- **Typed errors** for cases callers must branch on: `SpotifyAuthError`, `SpotifyRateLimitError(retryAfterMs)` exported from `spotify.ts`. Plain `Error` for cases that just bubble. Carry this pattern into v0.2's keyring-swap work — see memory `feedback_typed_errors_v0_2_blueprint.md`.
- **Tauri Store key convention** in `auth.ts` (`store.get("spotify")` / `store.set("spotify", …)`) — wrap behind a `tokenStore` interface for the v0.2 keychain swap.
- **Vitest mock fakes**: Map-backed `@tauri-apps/plugin-store` fake in `auth.test.ts` (use `vi.resetModules()` between tests to clear the `storePromise` cache); `vi.stubGlobal("fetch", …)` per-test in `spotify.test.ts`. Vitest 4 needs explicit signatures on `vi.fn<sig>()` — see memory `feedback_vitest_4_mock_typing.md`.

## What I'll likely decline (per CONTRIBUTING.md)

- Telemetry / analytics / crash reporters in any form.
- Ads or sponsorship integration in the app.
- Paid features.
- Massive refactors without prior discussion.
- Style-only rewrites of existing code.
- Suggestions to centralize the Client ID — Spotify policy blocks shared Client IDs above 25 users; the BYO wizard is here to stay.

## Gotcha — bash env propagation

Local toolchain installed **2026-05-02**: `pnpm 10.33.2`, `Rust 1.95.0`, `MSVC BuildTools 17.14.31` + Win11 SDK 22621. Pre-commit checks (`tsc --noEmit`, `cargo check`, `cargo clippy`) all run locally now. CI is still the source of truth.

**But:** Claude Code's bash sessions inherit the parent process's stale env, not the Windows registry. After any system installer updates user-PATH, existing bash calls can't resolve the new binary by name — even though a fresh terminal on the desktop can. Workaround: full-path invocation until Claude Code restarts. Path table + corepack-vs-Program-Files note: `~/.claude/projects/C--Users-matth--vscode-projects-lyripop/memory/feedback_no_local_build_toolchain.md`.
