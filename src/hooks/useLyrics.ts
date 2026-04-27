import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchLyrics,
  findActiveLineIndex,
  type LyricsLine,
} from "../lib/lrclib";
import type { SpotifyTrack } from "../lib/spotify";

export interface UseLyricsResult {
  syncedLines: LyricsLine[] | null;
  plainLyrics: string | null;
  instrumental: boolean;
  activeIndex: number;
  loading: boolean;
}

interface CachedLyrics {
  syncedLines: LyricsLine[] | null;
  plainLyrics: string | null;
  instrumental: boolean;
}

const EMPTY: CachedLyrics = {
  syncedLines: null,
  plainLyrics: null,
  instrumental: false,
};

export function useLyrics(
  track: SpotifyTrack | null,
  progressMs: number
): UseLyricsResult {
  const cacheRef = useRef<Map<string, CachedLyrics>>(new Map());
  const trackRef = useRef<SpotifyTrack | null>(track);
  trackRef.current = track;

  const [data, setData] = useState<CachedLyrics>(EMPTY);
  const [loading, setLoading] = useState(false);

  const trackId = track?.id ?? null;

  // Depend ONLY on trackId. The full track object is read from a ref so we
  // don't re-trigger the effect on every poll-cycle reference change, which
  // would cancel the in-flight lyrics fetch every second and leave the UI
  // stuck on "loading...".
  useEffect(() => {
    const t = trackRef.current;
    if (!trackId || !t) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    const cached = cacheRef.current.get(trackId);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchLyrics({
      trackName: t.name,
      artistName: t.artists[0]?.name ?? "",
      albumName: t.album.name,
      durationSec: Math.round(t.duration_ms / 1000),
    })
      .then((r) => {
        if (cancelled) return;
        const next: CachedLyrics = {
          syncedLines: r.syncedLyrics,
          plainLyrics: r.plainLyrics,
          instrumental: r.instrumental,
        };
        cacheRef.current.set(trackId, next);
        setData(next);
      })
      .catch(() => {
        if (cancelled) return;
        cacheRef.current.set(trackId, EMPTY);
        setData(EMPTY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [trackId]);

  const activeIndex = useMemo(() => {
    if (!data.syncedLines) return -1;
    return findActiveLineIndex(data.syncedLines, progressMs);
  }, [data.syncedLines, progressMs]);

  return {
    syncedLines: data.syncedLines,
    plainLyrics: data.plainLyrics,
    instrumental: data.instrumental,
    activeIndex,
    loading,
  };
}
