import { useEffect, useState } from "react";
import { pickCoverUrl, type SpotifyClient, type SpotifyTrack } from "../lib/spotify";

interface Props {
  client: SpotifyClient;
  // Refresh trigger — change this when the current track changes so we re-fetch.
  trackId: string | null;
}

export default function QueuePanel({ client, trackId }: Props) {
  const [queue, setQueue] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);

  const refresh = async () => {
    try {
      const r = await client.getQueue();
      setQueue(r.queue ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    client
      .getQueue()
      .then((r) => {
        if (!cancelled) setQueue(r.queue ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, trackId]);

  // Click a queue item -> advance Spotify by (index + 1) tracks. Spotify's
  // queue endpoint has no "jump to position N", so we call next() repeatedly.
  // This preserves everything after the chosen track because each next() is
  // a normal queue-advance from Spotify's POV.
  const skipTo = async (index: number) => {
    if (skipping) return;
    setSkipping(true);
    try {
      for (let i = 0; i <= index; i++) {
        await client.next();
      }
      // Brief pause to let Spotify settle, then refresh the visible queue.
      await new Promise((r) => setTimeout(r, 250));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSkipping(false);
    }
  };

  if (loading) return <Centered>loading queue…</Centered>;
  if (error) return <Centered>queue unavailable</Centered>;
  if (queue.length === 0) return <Centered>queue is empty</Centered>;

  return (
    <div className="h-full flex flex-col select-none">
      <div className="text-[9px] text-white/50 uppercase tracking-wider px-4 pt-2 pb-1.5 shrink-0">
        Up next
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-2 pb-2">
        {queue.slice(0, 25).map((t, i) => {
          const cover = pickCoverUrl(t.album?.images, 64);
          const disabled = skipping;
          return (
            <button
              key={`${t.id}-${i}`}
              onClick={() => skipTo(i)}
              disabled={disabled}
              title={
                disabled
                  ? "Skipping…"
                  : `Skip to: ${t.name} — ${t.artists
                      .map((a) => a.name)
                      .join(", ")}`
              }
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                disabled
                  ? "opacity-50 cursor-wait"
                  : "hover:bg-white/8 cursor-pointer"
              }`}
            >
              {cover ? (
                <img
                  src={cover}
                  alt=""
                  className="w-8 h-8 rounded shrink-0 object-cover"
                  draggable={false}
                />
              ) : (
                <div className="w-8 h-8 rounded shrink-0 bg-white/10" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-white text-[12px] font-semibold truncate leading-tight">
                  {t.name}
                </div>
                <div className="text-white/55 text-[10px] truncate leading-tight mt-0.5">
                  {t.artists.map((a) => a.name).join(", ")}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center h-full text-white/40 text-xs">
      {children}
    </div>
  );
}
