# Changelog

All notable changes to Lyripop are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

## [0.1.2] - 2026-05-06

### Added
- Vitest test pipeline + 88 unit tests across `pkce.ts`, `lrclib.ts`, `auth.ts`, `spotify.ts`. Coverage gates: ≥70% lines / ≥70% functions / ≥60% branches on `src/lib/**`.
- `src/lib/pkce.ts` — PKCE helpers extracted from `auth.ts` for direct unit-testability. RFC 7636 §B test vector locked in.
- `SpotifyAuthError` and `SpotifyRateLimitError` typed errors exported from `spotify.ts` so callers can branch on the failure mode instead of regex-matching strings.
- `forceRefreshAccessToken()` exported from `auth.ts` — bypasses the 60s pre-emptive window so `SpotifyClient` can recover from clock-skew or premature server-side revocation.
- `AuthContext` exported from `AuthGate` carrying a `forceReauth()` helper. `MiniPlayer` consumes it via `useContext` and routes 401-after-refresh / 403 cases back to the "Connect Spotify" screen.
- `cargo test` skeleton in `src-tauri/src/lib.rs` so CI exercises the Rust test runner ahead of v0.2's keyring work.
- CI now runs `pnpm test:coverage` and `cargo test --locked` on every push/PR.

### Changed
- `SpotifyClient.req()` now handles 401/403/429 internally:
  - 401 → one forced-refresh retry, then throws `SpotifyAuthError`.
  - 403 → throws `SpotifyAuthError` immediately (no retry — could be Premium-gating or scope demotion).
  - 429 → parses `Retry-After`, throws `SpotifyRateLimitError(retryAfterMs)` with a 60s cap and 5s default.
- `SpotifyClient` constructor now requires a `forceRefreshAccessToken` callback alongside the existing `getAccessToken`.
- `useSpotify` polling loop honours `Retry-After` instead of falling through to the exponential ladder, and bails out cleanly on `SpotifyAuthError` so AuthGate can re-prompt for login.

## [0.1.1] - 2026-04-30

### Added
- BYO Client-ID first-run wizard (`ClientIdSetup` component) — each user creates a personal Spotify Developer app once. Pivot driven by Spotify's May 2025 policy change that restricted extended quota mode to organizations only.
- Public-facing repo hygiene: `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `NOTICE`
- `.github/` issue and PR templates
- CI workflow (typecheck + cargo check on push/PR)
- Release workflow (Windows `.msi` build on tag, with SignPath signing once approved)

### Changed
- `auth.ts`: Client ID resolution is now async (env > stored > default). `isConfigured()` is async.
- AuthGate: new `needs-client-id` state routes to the setup wizard.
- Opener allowlist now includes `https://developer.spotify.com/*` for the wizard's "Open Dashboard" button.

## [0.1.0] - 2026-04-27

First public release.

### Added
- Floating always-on-top mini-player window (Tauri 2 + React 19 + Tailwind 4)
- Spotify OAuth 2.0 PKCE login (silent refresh, no client secret stored)
- Now-playing display: album cover, title, artist, album
- Hover overlay on cover with inline playback controls:
  - Shuffle / previous / play-pause / next / repeat
  - Track scrubber (`0:23 ━●━━━ 3:45`) with click/drag-to-seek
  - Volume button + popover slider
  - Share button (copies Spotify track URL to clipboard)
- Heart / like-unlike toggle (writes to user library)
- Queue panel: see "Up next," click any track to skip there while preserving the rest of the queue
- Synced lyrics carousel via lrclib.net:
  - 5 visible lines (2 above + active + 2 below) with opacity falloff
  - Mouse-wheel to scroll through lines
  - Click a line to seek to that timestamp
  - Auto-snap back to currently-playing line after 4s idle
  - Plain-lyrics fallback (manual scroll, no auto-advance) for tracks without synced LRC
  - "NOT SYNCED" badge on plain-lyric tracks with hover tooltip
- Mutually-exclusive lyrics / queue / none view toggle
- Ambient album-color gradient background (node-vibrant extraction with smooth crossfade between tracks)
- Window-position persistence between launches; size always defaults from config
- Tight Content-Security-Policy: only `accounts.spotify.com`, `api.spotify.com`, `*.scdn.co`, `lrclib.net` reachable
- No telemetry, no analytics, no third-party hosts

[Unreleased]: https://github.com/m6bernha/lyripop/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/m6bernha/lyripop/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/m6bernha/lyripop/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/m6bernha/lyripop/releases/tag/v0.1.0
