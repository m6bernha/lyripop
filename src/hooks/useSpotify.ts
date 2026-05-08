import { useCallback, useEffect, useRef, useState } from "react";
import {
  SpotifyAuthError,
  SpotifyClient,
  SpotifyRateLimitError,
  type PlaybackState,
  type RepeatState,
} from "../lib/spotify";
import { forceRefreshAccessToken, getValidAccessToken } from "../lib/auth";

const DEFAULT_POLL_INTERVAL_MS = 1000;
// Small jitter on top of Spotify's Retry-After so a fleet of clients all
// resuming at the same instant don't immediately re-trip the limiter.
const RATE_LIMIT_JITTER_MS = 200;

export interface UseSpotifyOptions {
  /** Called when polling hits a SpotifyAuthError (401-after-refresh or 403). */
  onAuthFailure: () => void;
  /**
   * Polling cadence in milliseconds. Read live (via ref) on every tick, so
   * a slider change in Settings takes effect on the next scheduled fetch
   * instead of the next remount. Defaults to 1s (the original behavior).
   */
  pollIntervalMs?: number;
}

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

export function useSpotify(opts: UseSpotifyOptions): UseSpotifyResult {
  const [state, setState] = useState<PlaybackState | null>(null);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stash the latest onAuthFailure in a ref so the polling effect doesn't have
  // to re-subscribe (and the SpotifyClient stays referentially stable) every
  // time the parent re-renders with a fresh callback.
  const onAuthFailureRef = useRef(opts.onAuthFailure);
  onAuthFailureRef.current = opts.onAuthFailure;

  // Same trick for the poll interval: a Settings change should take effect on
  // the next scheduled tick, not require a remount. The exponential ladder
  // below intentionally derives from this base, so slowing the cadence also
  // slows error backoff (which is what the user wants — they asked for less
  // chatty polling, full stop).
  const pollIntervalRef = useRef(opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
  pollIntervalRef.current = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  const clientRef = useRef<SpotifyClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new SpotifyClient(
      () => getValidAccessToken(),
      () => forceRefreshAccessToken()
    );
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

  // Self-rescheduling poll. Three error classes:
  //   - SpotifyAuthError (401-after-refresh or 403): stop polling and signal
  //     the parent so it can route back to AuthGate.
  //   - SpotifyRateLimitError (429): honour Retry-After + small jitter; do
  //     NOT bump the failures counter (this isn't network/outage flakiness).
  //   - anything else: exponential ladder 1s → 2s → 4s → 8s → 16s → 32s cap.
  // Resets to fast cadence on first success.
  useEffect(() => {
    let cancelled = false;
    let failures = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const reschedule = (delay: number) => {
      if (cancelled) return;
      timeoutId = setTimeout(tick, delay);
    };

    const tick = async () => {
      try {
        const next = await client.getPlaybackState();
        if (cancelled) return;
        setState(next);
        setError(null);
        failures = 0;
        setLoading(false);
        reschedule(pollIntervalRef.current);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof SpotifyAuthError) {
          // Bail out of the polling loop entirely — AuthGate will remount
          // MiniPlayer (and therefore this hook) once the user reconnects.
          cancelled = true;
          setError(e.message);
          setLoading(false);
          onAuthFailureRef.current();
          return;
        }
        if (e instanceof SpotifyRateLimitError) {
          // Surface the throttle to the user but keep polling — the limiter
          // window is short and bumping `failures` here would over-back-off.
          setError(`Rate limited (retry in ${Math.round(e.retryAfterMs / 1000)}s)`);
          setLoading(false);
          reschedule(e.retryAfterMs + RATE_LIMIT_JITTER_MS);
          return;
        }
        failures = Math.min(failures + 1, 6);
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
        const delay = Math.min(32_000, pollIntervalRef.current * 2 ** failures);
        reschedule(delay);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [client]);

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
