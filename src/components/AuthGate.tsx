import { useEffect, useState } from "react";
import { Music } from "lucide-react";
import { getStoredTokens, isConfigured, startLogin } from "../lib/auth";

interface Props {
  children: React.ReactNode;
}

type Status = "checking" | "needs-setup" | "needs-login" | "logging-in" | "ready";

export default function AuthGate({ children }: Props) {
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured()) {
      setStatus("needs-setup");
      return;
    }
    getStoredTokens()
      .then((t) => setStatus(t ? "ready" : "needs-login"))
      .catch(() => setStatus("needs-login"));
  }, []);

  const onLogin = async () => {
    setStatus("logging-in");
    setError(null);
    try {
      await startLogin();
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("needs-login");
    }
  };

  if (status === "ready") return <>{children}</>;

  return (
    <div
      data-tauri-drag-region
      className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-spotify-dark/95 border border-white/5 text-center"
    >
      <div className="grid place-items-center w-10 h-10 rounded-full bg-spotify-green text-black mb-1">
        <Music size={18} />
      </div>
      {status === "checking" && (
        <div className="text-white/60 text-xs">checking auth…</div>
      )}
      {status === "needs-setup" && (
        <>
          <div className="text-white text-sm font-semibold">
            App not configured
          </div>
          <div className="text-white/60 text-[11px] leading-snug max-w-[280px]">
            No Spotify Client ID is bundled or set in <code>.env.local</code>.
            See <span className="text-spotify-green">github.com/m6bernha/lyripop</span>{" "}
            for setup if you're building from source.
          </div>
        </>
      )}
      {status === "needs-login" && (
        <>
          <div className="text-white text-sm font-semibold">
            Connect Spotify
          </div>
          {error && (
            <div className="text-red-300/80 text-[10px] max-w-[280px]">
              {error}
            </div>
          )}
          <button
            onClick={onLogin}
            className="mt-1 px-4 py-1.5 rounded-full bg-spotify-green hover:bg-spotify-green-bright text-black font-semibold text-xs transition-colors"
          >
            Log in with Spotify
          </button>
        </>
      )}
      {status === "logging-in" && (
        <>
          <div className="text-white text-sm font-semibold">
            Awaiting browser…
          </div>
          <div className="text-white/60 text-[11px] max-w-[280px] leading-snug">
            Approve the app in your browser. This window will refresh
            automatically.
          </div>
        </>
      )}
    </div>
  );
}
