import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  disable as autostartDisable,
  enable as autostartEnable,
  isEnabled as autostartIsEnabled,
} from "@tauri-apps/plugin-autostart";
import { useLocalStorage } from "../hooks/useLocalStorage";

// Polling cadence for `useSpotify`. Floor stays at 1s (matches the original
// hard-coded value); ceiling caps the slowest cadence we want to expose to
// avoid surprising the user with a player that takes 15s to notice the next
// track. The exponential-backoff ladder on errors is unrelated and lives
// inside `useSpotify` itself.
export const POLL_INTERVAL_OPTIONS_MS = [1000, 2000, 3000, 5000, 10_000];
const POLL_INTERVAL_DEFAULT_MS = 1000;

const LYRICS_ENABLED_KEY = "lyricsEnabled";
const ALWAYS_ON_TOP_KEY = "alwaysOnTop";
const POLL_INTERVAL_KEY = "pollIntervalMs";

const isBoolean = (raw: unknown): raw is boolean => typeof raw === "boolean";
const isPollInterval = (raw: unknown): raw is number =>
  typeof raw === "number" && POLL_INTERVAL_OPTIONS_MS.includes(raw);

export interface SettingsContextValue {
  /** lrclib.net fetch toggle. When false, the lyrics view shows an empty state. */
  lyricsEnabled: boolean;
  setLyricsEnabled: (v: boolean) => void;

  /** Tauri `setAlwaysOnTop` toggle. Default mirrors `tauri.conf.json`. */
  alwaysOnTop: boolean;
  setAlwaysOnTop: (v: boolean) => void;

  /**
   * Launch-on-startup. Source of truth is the OS (registered via
   * `tauri-plugin-autostart`); this provider syncs once on mount and on
   * every successful enable/disable call.
   */
  autostartEnabled: boolean;
  setAutostartEnabled: (v: boolean) => Promise<void>;
  /** True until the OS has reported its initial autostart state. */
  autostartLoading: boolean;

  /** `useSpotify` polling cadence. Must be one of `POLL_INTERVAL_OPTIONS_MS`. */
  pollIntervalMs: number;
  setPollIntervalMs: (v: number) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

interface ProviderProps {
  children: React.ReactNode;
}

export function SettingsProvider({ children }: ProviderProps) {
  const [lyricsEnabled, setLyricsEnabled] = useLocalStorage(
    LYRICS_ENABLED_KEY,
    true,
    isBoolean
  );
  const [alwaysOnTop, setAlwaysOnTop] = useLocalStorage(
    ALWAYS_ON_TOP_KEY,
    true,
    isBoolean
  );
  const [pollIntervalMs, setPollIntervalMs] = useLocalStorage(
    POLL_INTERVAL_KEY,
    POLL_INTERVAL_DEFAULT_MS,
    isPollInterval
  );

  const [autostartEnabled, setAutostartState] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(true);

  // Drive the Tauri window from the persisted alwaysOnTop preference. We do
  // this in an effect (rather than only in the setter) so a fresh launch
  // applies the stored value before the user opens Settings.
  useEffect(() => {
    try {
      void getCurrentWindow()
        .setAlwaysOnTop(alwaysOnTop)
        .catch(() => {
          /* Tauri call failed (e.g. capability missing) — UI still tracks
             the desired state; user can retry from Settings. */
        });
    } catch {
      /* getCurrentWindow() unavailable (test env) — ignore. */
    }
  }, [alwaysOnTop]);

  // Sync autostart state from the OS once on mount. The plugin is the source
  // of truth; localStorage would drift if the user toggled the OS setting
  // outside the app (Task Manager → Startup, registry edit, etc.).
  useEffect(() => {
    let cancelled = false;
    autostartIsEnabled()
      .then((v) => {
        if (!cancelled) setAutostartState(v);
      })
      .catch(() => {
        if (!cancelled) setAutostartState(false);
      })
      .finally(() => {
        if (!cancelled) setAutostartLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setAutostartEnabled = useCallback(async (v: boolean) => {
    try {
      if (v) await autostartEnable();
      else await autostartDisable();
      setAutostartState(v);
    } catch (e) {
      // Re-read OS state so the UI reflects reality even when the toggle
      // failed (permission denied, registry locked, etc.) and re-throw so
      // the SettingsPanel can surface the error.
      const actual = await autostartIsEnabled().catch(() => false);
      setAutostartState(actual);
      throw e;
    }
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        lyricsEnabled,
        setLyricsEnabled,
        alwaysOnTop,
        setAlwaysOnTop,
        autostartEnabled,
        setAutostartEnabled,
        autostartLoading,
        pollIntervalMs,
        setPollIntervalMs,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error(
      "useSettings must be used inside a SettingsProvider (mount it in App.tsx)"
    );
  }
  return ctx;
}
