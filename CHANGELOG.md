# Changelog

All notable changes to Lyripop are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Public-facing repo hygiene: `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `NOTICE`
- `.github/` issue and PR templates
- CI workflow (typecheck + cargo check on push/PR)
- Release workflow (Windows `.msi` build on tag, with SignPath signing once approved)

## [0.1.0] - TBD

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

[Unreleased]: https://github.com/m6bernha/lyripop/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/m6bernha/lyripop/releases/tag/v0.1.0
