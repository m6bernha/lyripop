## What

<!-- One-line summary of the change. -->

## Why

<!-- The motivation. Link to the issue if applicable. -->

## How

<!-- Implementation notes if non-obvious. -->

## Verification

- [ ] `pnpm exec tsc --noEmit` clean
- [ ] `cargo check` clean (in `src-tauri/`)
- [ ] `cargo clippy -- -D warnings` clean (in `src-tauri/`)
- [ ] Tested locally with `pnpm tauri dev`
- [ ] No new third-party services introduced (or, if so, updated `SECURITY.md`, README privacy table, and CSP allowlist)
- [ ] No new dependencies (or, if so, justified in the description)

## Notes

<!-- Anything reviewers should know. -->
