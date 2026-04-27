import { useCallback, useEffect, useRef, useState } from "react";
import {
  SpotifyClient,
  type PlaybackState,
  type RepeatState,
} from "../lib/spotify";
import { getValidAccessToken } from "../lib/auth";

const POLL_INTERVAL_MS = 1000;

export interface UseSpotifyResult {
  state: PlaybackState | null;
  liked: boolean | null;
  loading: boolean;
  error: string | null;
  client: SpotifyClient;
  refresh: () => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  togglePlay: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  setVolume: (percent: number) => Promise<void>;
  toggleShuffle: () => Promise<void>;
  cycleRepeat: () => Promise<void>;
  toggleLiked: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
}

const NEXT_REPEAT: Record<RepeatState, RepeatState> = {
  off: "context",
  context: "track",
  track: "off",
};

export function useSpotify(): UseSpotifyResult {
  const [state, setState] = useState<PlaybackState | null>(null);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<SpotifyClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new SpotifyClient(() => getValidAccessToken());
  }
  const client = clientRef.current;

  const refresh = useCallback(async () => {
    try {
      const next = await client.getPlaybackState();
      setState(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const trackId = state?.item?.id ?? null;
  useEffect(() => {
    if (!trackId) {
      setLiked(null);
      return;
    }
    let cancelled = false;
    client
      .checkLiked(trackId)
      .then((v) => {
        if (!cancelled) setLiked(v);
      })
      .catch(() => {
        if (!cancelled) setLiked(null);
      });
    return () => {
      cancelled = true;
    };
  }, [trackId, client]);

  const play = useCallback(async () => {
    await client.play();
    await refresh();
  }, [client, refresh]);
  const pause = useCallback(async () => {
    await client.pause();
    await refresh();
  }, [client, refresh]);
  const togglePlay = useCallback(async () => {
    if (state?.is_playing) await pause();
    else await play();
  }, [state?.is_playing, play, pause]);
  const next = useCallback(async () => {
    await client.next();
    await refresh();
  }, [client, refresh]);
  const previous = useCallback(async () => {
    await client.previous();
    await refresh();
  }, [client, refresh]);
  const setVolume = useCallback(
    async (percent: number) => {
      await client.setVolume(percent);
      await refresh();
    },
    [client, refresh]
  );
  const toggleShuffle = useCallback(async () => {
    if (!state) return;
    await client.setShuffle(!state.shuffle_state);
    await refresh();
  }, [client, state, refresh]);
  const cycleRepeat = useCallback(async () => {
    if (!state) return;
    await client.setRepeat(NEXT_REPEAT[state.repeat_state]);
    await refresh();
  }, [client, state, refresh]);
  const seek = useCallback(
    async (ms: number) => {
      try {
        await client.seek(ms);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [client, refresh]
  );
  const toggleLiked = useCallback(async () => {
    if (!trackId) return;
    const newLiked = !liked;
    setLiked(newLiked);
    try {
      await client.setLiked(trackId, newLiked);
    } catch (e) {
      setLiked(!newLiked);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [client, trackId, liked]);

  return {
    state,
    liked,
    loading,
    error,
    client,
    refresh,
    play,
    pause,
    togglePlay,
    next,
    previous,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    toggleLiked,
    seek,
  };
}
