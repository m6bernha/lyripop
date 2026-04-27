import { useState } from "react";
import { ArrowRight, Check, Copy, ExternalLink, Music } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { isValidClientIdFormat, setStoredClientId } from "../lib/auth";

interface Props {
  onSaved: () => void;
}

const REDIRECT_URI = "http://127.0.0.1:8888/callback";

export default function ClientIdSetup({ onSaved }: Props) {
  const [value, setValue] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const valid = trimmed.length > 0 && isValidClientIdFormat(trimmed);

  const onOpenDashboard = async () => {
    try {
      await openUrl("https://developer.spotify.com/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onCopyRedirect = async () => {
    try {
      await writeText(REDIRECT_URI);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await setStoredClientId(trimmed);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  return (
    <div
      data-tauri-drag-region
      className="w-full h-full overflow-y-auto scrollbar-thin rounded-2xl bg-spotify-dark/95 border border-white/5"
    >
      <div className="px-4 pt-4 pb-3 flex items-center gap-2">
        <div className="grid place-items-center w-9 h-9 rounded-full bg-spotify-green text-black shrink-0">
          <Music size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-white font-bold text-sm leading-tight">
            One-time Spotify setup
          </div>
          <div className="text-white/55 text-[11px] leading-snug">
            ~3 min — you'll create your own Spotify Developer app.
          </div>
        </div>
      </div>

      <div className="px-4 pb-3">
        <button
          onClick={onOpenDashboard}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-spotify-green hover:bg-spotify-green-bright text-black font-semibold text-xs transition-colors"
        >
          <ExternalLink size={13} strokeWidth={2.5} />
          Open Spotify Developer Dashboard
        </button>
      </div>

      <ol className="px-4 pb-3 space-y-2 text-[11px] text-white/75 leading-snug">
        <Step n={1}>
          Sign in with your Spotify account on the dashboard.
        </Step>
        <Step n={2}>
          Click <Strong>Create app</Strong>. App name can be anything (e.g. "Lyripop").
        </Step>
        <Step n={3}>
          Tick <Strong>Web API</Strong> under "Which API/SDKs are you planning to use".
        </Step>
        <Step n={4}>
          Set the <Strong>Redirect URI</Strong> to:
          <div className="mt-1.5 flex items-center gap-1.5">
            <code className="flex-1 px-2 py-1 rounded bg-black/40 text-spotify-green text-[11px] font-mono truncate">
              {REDIRECT_URI}
            </code>
            <button
              onClick={onCopyRedirect}
              className="grid place-items-center w-6 h-6 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              title={copied ? "Copied!" : "Copy"}
            >
              {copied ? (
                <Check size={12} strokeWidth={2.5} />
              ) : (
                <Copy size={12} strokeWidth={2} />
              )}
            </button>
          </div>
        </Step>
        <Step n={5}>
          Save the app. Copy the <Strong>Client ID</Strong> (the long string under your app's name) and paste below.
        </Step>
      </ol>

      <form onSubmit={onSubmit} className="px-4 pb-4 space-y-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste your 32-character Client ID"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/10 text-white text-[12px] font-mono placeholder:text-white/30 focus:outline-none focus:border-spotify-green"
        />
        <button
          type="submit"
          disabled={!valid || saving}
          className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-full font-semibold text-xs transition-colors ${
            valid && !saving
              ? "bg-spotify-green hover:bg-spotify-green-bright text-black"
              : "bg-white/10 text-white/40 cursor-not-allowed"
          }`}
        >
          {saving ? "Saving…" : "Save & continue"}
          {valid && !saving && <ArrowRight size={13} strokeWidth={2.5} />}
        </button>
        {error && (
          <div className="text-red-300/80 text-[10px] leading-snug">
            {error}
          </div>
        )}
        <div className="text-white/40 text-[10px] leading-snug">
          Stored locally at{" "}
          <code className="text-white/55">%APPDATA%\com.m6bernha.lyripop\</code>.
          Never sent anywhere except Spotify itself.
        </div>
      </form>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <div className="grid place-items-center w-4 h-4 rounded-full bg-white/10 text-white text-[9px] font-bold shrink-0 mt-0.5">
        {n}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </li>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="text-white font-semibold">{children}</span>;
}
