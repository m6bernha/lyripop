# Security Policy

## Reporting a vulnerability

If you find a security issue in Lyripop, please **do not** open a public GitHub issue. Instead use one of these private channels:

- **GitHub Security Advisories** (preferred): [open a private advisory](https://github.com/m6bernha/lyripop/security/advisories/new)
- **Email**: `matthias.bernhard7@gmail.com` with subject `[lyripop security]`

I'll acknowledge within **7 days** and target a fix within **30 days** for high-severity issues. There's no bug bounty (this is a free hobby project) but I'll credit reporters in the release notes by name or pseudonym, your choice.

## Supported versions

Only the latest released version receives security fixes. As a single-developer hobby project, I can't backport.

| Version | Supported |
|---|---|
| Latest release on `main` | ✅ |
| Older | ❌ — please update |

## Threat model (v0.1.0)

Lyripop is a personal-machine desktop widget. The threat model:

**In scope:**
- Malicious lyrics from lrclib (XSS attempts, prototype pollution, etc.)
- Malicious album cover URLs (SSRF, decoder vulnerabilities)
- Spotify API misuse / privilege escalation via the app
- Dependency supply-chain attacks (npm + crates.io)
- Local file injection / path traversal
- Token theft via the app itself (e.g., a code path exfiltrating tokens to a non-Spotify host)

**Partially in scope:**
- Malware already running as your Windows user account (see "Plaintext token storage" below)

**Out of scope:**
- Someone with physical access to your unlocked machine
- Browser extensions in your Spotify-OAuth approval flow
- Spotify itself acting maliciously
- WebView2 or Windows OS vulnerabilities (report to Microsoft)

## Known-acceptable risks (v0.1.0)

### Plaintext token storage

Refresh tokens are stored in:

```
%APPDATA%\com.m6bernha.lyripop\tokens.json
```

This is plaintext JSON. The path is under your Windows user profile, so other users on the machine can't read it without admin elevation. **However**, malware running as your Windows user can.

For comparison, Spotify's own desktop client has similar properties.

**Mitigation in roadmap (v0.2 or later)**: swap `tauri-plugin-store` for an OS-keychain backing (Windows DPAPI / macOS Keychain / Linux Secret Service via `keyring` or similar). Tracked publicly via repository issues.

If your threat model includes "malware on my user account," consider:
- Don't install Lyripop, or
- Use the `.env.local` BYO Client ID override and create a Spotify Developer app you fully control, so the blast radius from a stolen token is limited to that app.

### Unsigned `.msi` on initial release

Until [SignPath OSS](https://signpath.org/) approval lands, releases ship without an Authenticode signature. Windows SmartScreen will flag this. The MSI's SHA-256 is published in the release notes — verify it matches before running. We're applying for SignPath OSS sponsorship; tagged release after approval will be auto-signed.

### Spotify Quota Extension (dev-mode 25-user cap)

Spotify Developer apps in dev mode are limited to 25 authorized users. Until our quota extension is approved (typically 2-4 weeks after submission), only 25 users at a time can use the bundled Client ID. Power users can bypass this by creating their own Spotify Developer app and using `.env.local` (see `.env.example`).

## What we DO

- ✅ OAuth 2.0 PKCE flow (no client secret on disk; no client_secret needed)
- ✅ Strict Content-Security-Policy (only the four hosts above are reachable from the WebView)
- ✅ Tauri capabilities scoped per-feature (no overpermissioned plugin grants — every permission corresponds to a real call site)
- ✅ All outbound requests over TLS
- ✅ Refresh-token auto-rotation (silent; no long-lived access tokens kept in memory)
- ✅ OAuth scopes are minimised to what the app actually does
- ✅ Release builds reproducible from source via the public CI pipeline (with SLSA build provenance attached starting v0.1.0)

## What we DON'T do

- ❌ Send your data anywhere except Spotify and lrclib
- ❌ Track usage / fingerprint your install
- ❌ Bundle analytics SDKs / crash reporters / ads / "improvement programs"
- ❌ Phone home for updates without consent (auto-update is on the v0.2+ roadmap and will be opt-in)
- ❌ Read your Spotify history beyond what's needed for now-playing + queue + like state
- ❌ Modify your Spotify library beyond what you click in the UI (like/unlike)
