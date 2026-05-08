import {
  AlertTriangle,
  ExternalLink,
  GitBranch,
  LogOut,
  Music,
  RotateCcw,
  X,
} from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  POLL_INTERVAL_OPTIONS_MS,
  useSettings,
} from "../context/SettingsContext";
import { getStoredClientId } from "../lib/auth";
import { AuthContext } from "./AuthGate";

interface Props {
  onClose: () => void;
}

const REPO_URL = "https://github.com/m6bernha/lyripop";
const DASHBOARD_URL = "https://developer.spotify.com/dashboard";
const CONFIRM_RESET_MS = 3000;

function maskClientId(id: string): string {
  if (id.length <= 4) return "••••";
  return `${"•".repeat(24)}${id.slice(-4)}`;
}

export default function SettingsPanel({ onClose }: Props) {
  const auth = useContext(AuthContext);
  const settings = useSettings();
  const [storedId, setStoredId] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [busy, setBusy] = useState<"signout" | "reset" | null>(null);
  const [autostartBusy, setAutostartBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the stored Client ID once on mount. We deliberately read the stored
  // value (not the effective one) because the env var override is opaque to
  // the user and shouldn't be displayed.
  useEffect(() => {
    let cancelled = false;
    getStoredClientId()
      .then((id) => {
        if (!cancelled) setStoredId(id);
      })
      .catch(() => {
        if (!cancelled) setStoredId(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Two-step confirm: first click arms, second click within the window
  // commits. Auto-disarm prevents a stale armed state from biting on next
  // panel open.
  useEffect(() => {
    if (!confirmingReset) return;
    const id = window.setTimeout(
      () => setConfirmingReset(false),
      CONFIRM_RESET_MS
    );
    return () => window.clearTimeout(id);
  }, [confirmingReset]);

  const onSignOut = async () => {
    if (busy || !auth) return;
    setBusy("signout");
    setError(null);
    try {
      await auth.forceReauth();
      // AuthGate will unmount this component as it switches state — no
      // further work to do here.
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  const onResetClick = async () => {
    if (busy || !auth) return;
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    setBusy("reset");
    setError(null);
    try {
      await auth.resetClientId();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
      setConfirmingReset(false);
    }
  };

  const onOpen = async (url: string) => {
    try {
      await openUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onToggleAutostart = async (next: boolean) => {
    if (autostartBusy) return;
    setAutostartBusy(true);
    setError(null);
    try {
      await settings.setAutostartEnabled(next);
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't update autostart: ${e.message}`
          : "Couldn't update autostart"
      );
    } finally {
      setAutostartBusy(false);
    }
  };

  const version = import.meta.env.VITE_APP_VERSION;
  const envOverride = Boolean(import.meta.env.VITE_SPOTIFY_CLIENT_ID);

  return (
    <div
      data-tauri-drag-region
      className="w-full h-full overflow-y-auto scrollbar-thin"
    >
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <div className="grid place-items-center w-7 h-7 rounded-full bg-white/10 text-white shrink-0">
          <Music size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-[13px] leading-tight">
            Settings
          </div>
        </div>
        <button
          onClick={onClose}
          title="Close settings"
          className="shrink-0 grid place-items-center w-7 h-7 rounded-full text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Spotify connection */}
      <div className="px-4 pb-3">
        <div className="text-white/55 text-[10px] uppercase tracking-wider font-semibold mb-1.5">
          Spotify connection
        </div>
        <div className="rounded-lg bg-black/30 border border-white/5 p-2.5 space-y-2">
          <div>
            <div className="text-white/45 text-[10px] mb-0.5">Client ID</div>
            <code className="block text-spotify-green text-[11px] font-mono truncate">
              {storedId
                ? maskClientId(storedId)
                : envOverride
                  ? "(from VITE_SPOTIFY_CLIENT_ID env var)"
                  : "Not configured"}
            </code>
          </div>

          <button
            onClick={onSignOut}
            disabled={busy !== null}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/85 hover:text-white text-[11px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut size={12} strokeWidth={2.25} />
            {busy === "signout" ? "Signing out…" : "Sign out"}
          </button>

          <button
            onClick={onResetClick}
            disabled={busy !== null}
            className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              confirmingReset
                ? "bg-red-500/80 hover:bg-red-500 text-white"
                : "bg-red-500/15 hover:bg-red-500/25 text-red-200/90 hover:text-red-100"
            }`}
            title={
              confirmingReset
                ? "Click again to confirm — wipes Client ID + tokens"
                : "Wipe Client ID + tokens and return to setup wizard"
            }
          >
            {confirmingReset ? (
              <>
                <AlertTriangle size={12} strokeWidth={2.5} />
                {busy === "reset" ? "Resetting…" : "Click again to confirm"}
              </>
            ) : (
              <>
                <RotateCcw size={12} strokeWidth={2.25} />
                Reset Spotify connection
              </>
            )}
          </button>

          <p className="text-white/45 text-[10px] leading-snug">
            <strong className="text-white/70">Sign out</strong> keeps your
            Client ID and just clears the access token.{" "}
            <strong className="text-white/70">Reset</strong> wipes both — use
            this if Spotify rejects your token even after re-login.
          </p>
        </div>
      </div>

      {/* Preferences */}
      <div className="px-4 pb-3">
        <div className="text-white/55 text-[10px] uppercase tracking-wider font-semibold mb-1.5">
          Preferences
        </div>
        <div className="rounded-lg bg-black/30 border border-white/5 p-2.5 divide-y divide-white/5">
          <SettingRow
            label="Lyrics fetching"
            hint="Allow lrclib.net requests for synced lyrics."
            first
          >
            <Toggle
              value={settings.lyricsEnabled}
              onChange={settings.setLyricsEnabled}
              label="Lyrics fetching"
            />
          </SettingRow>

          <SettingRow
            label="Always on top"
            hint="Float above other windows. Disable for screen-share."
          >
            <Toggle
              value={settings.alwaysOnTop}
              onChange={settings.setAlwaysOnTop}
              label="Always on top"
            />
          </SettingRow>

          <SettingRow
            label="Launch on startup"
            hint="Open Lyripop automatically when you log into Windows."
          >
            <Toggle
              value={settings.autostartEnabled}
              onChange={(v) => void onToggleAutostart(v)}
              disabled={settings.autostartLoading || autostartBusy}
              label="Launch on startup"
            />
          </SettingRow>

          <SettingRow
            label="Update cadence"
            hint="How often Lyripop polls Spotify. Slower = lighter on quota."
          >
            <select
              aria-label="Polling cadence"
              value={settings.pollIntervalMs}
              onChange={(e) =>
                settings.setPollIntervalMs(Number(e.target.value))
              }
              className="bg-black/40 text-white text-[11px] px-2 py-1 rounded border border-white/10 focus:outline-none focus:border-spotify-green"
            >
              {POLL_INTERVAL_OPTIONS_MS.map((ms) => (
                <option key={ms} value={ms}>
                  {ms < 60_000 ? `${ms / 1000}s` : `${ms / 60_000}m`}
                </option>
              ))}
            </select>
          </SettingRow>
        </div>
      </div>

      {/* About */}
      <div className="px-4 pb-4">
        <div className="text-white/55 text-[10px] uppercase tracking-wider font-semibold mb-1.5">
          About
        </div>
        <div className="rounded-lg bg-black/30 border border-white/5 p-2.5 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/55">Version</span>
            <code className="text-white/85 font-mono">v{version}</code>
          </div>
          <button
            onClick={() => onOpen(REPO_URL)}
            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 -mx-1 rounded text-white/75 hover:text-white hover:bg-white/5 transition-colors"
          >
            <span className="flex items-center gap-1.5 text-[11px]">
              <GitBranch size={12} strokeWidth={2} />
              GitHub repository
            </span>
            <ExternalLink size={11} strokeWidth={2} className="text-white/40" />
          </button>
          <button
            onClick={() => onOpen(DASHBOARD_URL)}
            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 -mx-1 rounded text-white/75 hover:text-white hover:bg-white/5 transition-colors"
          >
            <span className="flex items-center gap-1.5 text-[11px]">
              <ExternalLink size={12} strokeWidth={2} />
              Spotify Developer Dashboard
            </span>
            <ExternalLink size={11} strokeWidth={2} className="text-white/40" />
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 pb-3 text-red-300/80 text-[10px] leading-snug">
          {error}
        </div>
      )}
    </div>
  );
}

interface SettingRowProps {
  label: string;
  hint?: string;
  first?: boolean;
  children: React.ReactNode;
}

function SettingRow({ label, hint, first, children }: SettingRowProps) {
  return (
    <div
      className={`flex items-center justify-between gap-2 ${
        first ? "pb-2" : "py-2"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-white/85 text-[11px]">{label}</div>
        {hint && (
          <div className="text-white/40 text-[9px] leading-tight mt-0.5">
            {hint}
          </div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

interface ToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}

function Toggle({ value, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        value ? "bg-spotify-green" : "bg-white/15"
      }`}
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
          value ? "translate-x-3.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
