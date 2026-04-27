import { useCallback, useEffect, useState } from "react";
import { Music } from "lucide-react";
import { getStoredTokens, isConfigured, startLogin } from "../lib/auth";
import ClientIdSetup from "./ClientIdSetup";

interface Props {
  children: React.ReactNode;
}

type Status =
  | "checking"
  | "needs-client-id"
  | "needs-login"
  | "logging-in"
  | "ready";

export default function AuthGate({ children }: Props) {
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);

  const evaluate = useCallback(async () => {
    try {
      if (!(await isConfigured())) {
        setStatus("needs-client-id");
        return;
      }
      const tokens = await getStoredTokens();
      setStatus(tokens ? "ready" : "needs-login");
    } catch {
      setStatus("needs-client-id");
    }
  }, []);

  useEffect(() => {
    evaluate();
  }, [evaluate]);

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

  const onClientIdSaved = async () => {
    setStatus("needs-login");
    setError(null);
  };

  if (status === "ready") return <>{children}</>;
  if (status === "needs-client-id")
    return <ClientIdSetup onSaved={onClientIdSaved} />;

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
