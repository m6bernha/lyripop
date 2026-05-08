/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Spotify Client ID from a `.env` file. Optional override — the BYO setup
   * wizard handles the common case. Used by `getEffectiveClientId()` in
   * `src/lib/auth.ts`.
   */
  readonly VITE_SPOTIFY_CLIENT_ID?: string;
  /**
   * App version from `package.json`, injected at build time by Vite's
   * `define` (see `vite.config.ts`). Surfaced in the Settings panel.
   */
  readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
