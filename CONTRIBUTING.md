# Contributing to Lyripop

Thanks for your interest. This is a small, focused hobby project — contributions that align with the goals (lightweight, transparent, no third-party data flow) are very welcome.

## Setup

```bash
git clone https://github.com/m6bernha/lyripop.git
cd lyripop
pnpm install
pnpm tauri dev
```

Requires:

- Node 20+
- pnpm 9+
- Rust stable (`rustup default stable`)
- Windows 10+ with WebView2 (preinstalled on Windows 11)

For your first dev run, you'll need to either:

- Wait for the bundled Client ID (post-v0.1.0 it'll just work), **or**
- Copy `.env.example` to `.env.local` and paste your own Spotify Client ID (see `.env.example` for the dashboard steps).

## Workflow

1. **Pick or open an issue.** For non-trivial changes, propose the approach in an issue first so we don't waste your time on something I'd reject.
2. **Branch off `main`**: `git checkout -b feat/your-thing` (or `fix/`, `docs/`, etc.).
3. **Code + test locally** with `pnpm tauri dev`.
4. **Pre-commit checks**:
   ```bash
   pnpm exec tsc --noEmit              # type-check
   cd src-tauri && cargo check         # rust check
   cd src-tauri && cargo clippy        # rust lint (treat warnings as errors)
   ```
5. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, `perf:`, `ci:`.
6. **Push and open a PR** against `main`. CI must be green.
7. **Review.** PRs need 1 review; for solo work, self-merge after CI green is fine.

## Style

- TypeScript: strict mode (already enforced via `tsconfig.json`).
- React: functional components + hooks. No class components.
- Rust: `cargo fmt` + `cargo clippy`. Treat clippy warnings as errors.
- Tailwind: Tailwind 4. Design tokens defined in `src/styles/globals.css` `@theme {}`.
- Files: small + focused. ~200-400 lines typical, 800 max.

## Sensitive areas — extra scrutiny on PRs touching these

- **`src/lib/auth.ts`** — OAuth flow. Token handling. Changes need security review.
- **`src-tauri/capabilities/default.json`** — Tauri capability grants. Be conservative; every permission must correspond to a real call site.
- **`src-tauri/tauri.conf.json` `app.security.csp`** — Content-Security-Policy. Only loosen with documented reason.
- **`package.json` and `Cargo.toml` dependencies** — adding a new dep requires justifying why a stdlib / existing-dep solution doesn't work. We aim to keep the dependency graph small.
- **Anything that adds a new outbound host** — PR must update `SECURITY.md`, `README.md` privacy table, and CSP.

## What I'll likely **decline**

- Adding telemetry / analytics / crash reporters of any kind. Hard no.
- Adding ads or sponsorship integration into the app itself.
- Adding paid features. The app is and stays free.
- Massive refactors without prior discussion.
- Style-only rewrites of existing code.

## Reporting bugs

Use the [bug report template](https://github.com/m6bernha/lyripop/issues/new?template=bug_report.md). Include:
- Lyripop version (Help → About, or check the title bar)
- Windows version
- Steps to reproduce
- Expected vs actual behavior

## Security issues

See [SECURITY.md](SECURITY.md). Do **not** open a public issue for security bugs; use the private channels listed there.

## License of contributions

By submitting a PR you agree your contribution is licensed under the [MIT License](LICENSE) — same as the rest of the project.
