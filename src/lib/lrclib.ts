const LRCLIB_BASE = "https://lrclib.net/api";

export interface LyricsLine {
  ms: number;
  text: string;
}

export interface LrclibResult {
  syncedLyrics: LyricsLine[] | null;
  plainLyrics: string | null;
  instrumental: boolean;
}

export async function fetchLyrics(params: {
  trackName: string;
  artistName: string;
  albumName?: string;
  durationSec?: number;
}): Promise<LrclibResult> {
  const q = new URLSearchParams({
    track_name: params.trackName,
    artist_name: params.artistName,
  });
  if (params.albumName) q.set("album_name", params.albumName);
  if (params.durationSec) q.set("duration", String(params.durationSec));

  const res = await fetch(`${LRCLIB_BASE}/get?${q.toString()}`, {
    headers: { "User-Agent": "spotify-widget/0.1 (+local)" },
  });
  if (res.status === 404) {
    return { syncedLyrics: null, plainLyrics: null, instrumental: false };
  }
  if (!res.ok) {
    throw new Error(`lrclib ${res.status}`);
  }

  const data = (await res.json()) as {
    syncedLyrics: string | null;
    plainLyrics: string | null;
    instrumental: boolean;
  };

  return {
    syncedLyrics: data.syncedLyrics ? parseLrc(data.syncedLyrics) : null,
    plainLyrics: data.plainLyrics,
    instrumental: data.instrumental ?? false,
  };
}

const LRC_LINE_RE = /\[(\d+):(\d+(?:\.\d+)?)\]([^[]*)/g;

export function parseLrc(text: string): LyricsLine[] {
  const lines: LyricsLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const matches = [...raw.matchAll(LRC_LINE_RE)];
    if (matches.length === 0) continue;
    const lineText = matches[matches.length - 1][3].trim();
    for (const m of matches) {
      const min = parseInt(m[1], 10);
      const sec = parseFloat(m[2]);
      const ms = Math.round((min * 60 + sec) * 1000);
      lines.push({ ms, text: lineText });
    }
  }
  return lines.sort((a, b) => a.ms - b.ms);
}

export function findActiveLineIndex(
  lines: LyricsLine[],
  currentMs: number
): number {
  if (lines.length === 0) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].ms <= currentMs) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}
