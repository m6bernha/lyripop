const API_BASE = "https://api.spotify.com/v1";

// 5s default when Spotify returns 429 without a Retry-After header. Spotify
// usually returns 1-3s in practice; the cap below clamps the upper bound so
// a malformed/abusive header can't put us into a multi-minute back-off.
const DEFAULT_RATE_LIMIT_MS = 5_000;
const MAX_RATE_LIMIT_MS = 60_000;

/**
 * Thrown when the API returned 401 after a forced-refresh retry, or 403 (the
 * scope/account-state case where retrying with a fresh token wouldn't help).
 * The caller is expected to clear stored tokens and route the user back to
 * the AuthGate "Connect Spotify" screen.
 */
export class SpotifyAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpotifyAuthError";
  }
}

/**
 * Thrown when Spotify returns 429. Carries the parsed (or defaulted) backoff
 * window so polling callers can honour Retry-After instead of falling through
 * to the generic exponential ladder.
 */
export class SpotifyRateLimitError extends Error {
  constructor(
    public readonly retryAfterMs: number,
    message: string
  ) {
    super(message);
    this.name = "SpotifyRateLimitError";
  }
}

export interface SpotifyArtist {
  id: string;
  name: string;
}

export interface SpotifyImage {
  url: string;
  width: number;
  height: number;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: {
    id: string;
    name: string;
    images: SpotifyImage[];
  };
  duration_ms: number;
  external_urls: { spotify: string };
}

export type RepeatState = "off" | "track" | "context";

export interface SpotifyDevice {
  id: string | null;
  name: string;
  is_active: boolean;
  volume_percent: number | null;
}

export interface PlaybackState {
  device: SpotifyDevice | null;
  shuffle_state: boolean;
  repeat_state: RepeatState;
  is_playing: boolean;
  progress_ms: number;
  item: SpotifyTrack | null;
}

export interface QueueResponse {
  currently_playing: SpotifyTrack | null;
  queue: SpotifyTrack[];
}

type Json = Record<string, unknown>;

interface ReqInit {
  method?: string;
  body?: Json;
}

export class SpotifyClient {
  /**
   * @param getAccessToken     Returns a valid access token. Performs the
   *                           pre-emptive 60s refresh internally (see
   *                           auth.ts:getValidAccessToken).
   * @param forceRefreshToken  Bypasses the pre-emptive window and refreshes
   *                           unconditionally. Used to recover from 401s where
   *                           our cached `expires_at` was wrong (clock skew
   *                           or early server-side revocation).
   */
  constructor(
    private getAccessToken: () => Promise<string>,
    private forceRefreshToken: () => Promise<string>
  ) {}

  /**
   * Issue an authenticated request. Centralises 401/403/429 handling so call
   * sites don't have to repeat it.
   *
   * - 200 / JSON       → parsed body
   * - 200 / non-JSON   → null
   * - 202 / 204        → null
   * - 401              → forced refresh + ONE retry; second 401 throws SpotifyAuthError
   * - 403              → throws SpotifyAuthError (no retry)
   * - 429              → throws SpotifyRateLimitError carrying retryAfterMs
   * - other non-2xx    → throws plain Error with status + body
   */
  private async req<T>(path: string, init?: ReqInit): Promise<T | null> {
    const token = await this.getAccessToken();
    const res = await this.send(path, init, token);

    if (res.status === 401) {
      // One forced-refresh retry. If the second call also returns 401, the
      // refresh token itself is no good — surface re-auth.
      let freshToken: string;
      try {
        freshToken = await this.forceRefreshToken();
      } catch {
        throw new SpotifyAuthError("re-authentication required");
      }
      const retry = await this.send(path, init, freshToken);
      if (retry.status === 401) {
        throw new SpotifyAuthError("re-authentication required");
      }
      return this.parse<T>(retry, path);
    }

    if (res.status === 403) {
      throw new SpotifyAuthError(
        "forbidden — token scope or account state issue"
      );
    }

    if (res.status === 429) {
      throw new SpotifyRateLimitError(
        parseRetryAfter(res.headers.get("Retry-After")),
        `Spotify 429 ${path}`
      );
    }

    return this.parse<T>(res, path);
  }

  private async send(
    path: string,
    init: ReqInit | undefined,
    token: string
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (init?.body !== undefined) headers["Content-Type"] = "application/json";

    return fetch(`${API_BASE}${path}`, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  }

  private async parse<T>(res: Response, path: string): Promise<T | null> {
    if (res.status === 204 || res.status === 202) return null;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Spotify ${res.status} ${path}: ${text}`);
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return null;
    return (await res.json()) as T;
  }

  getPlaybackState(): Promise<PlaybackState | null> {
    return this.req<PlaybackState>("/me/player");
  }

  async play(): Promise<void> {
    await this.req("/me/player/play", { method: "PUT" });
  }
  async pause(): Promise<void> {
    await this.req("/me/player/pause", { method: "PUT" });
  }
  async next(): Promise<void> {
    await this.req("/me/player/next", { method: "POST" });
  }
  async previous(): Promise<void> {
    await this.req("/me/player/previous", { method: "POST" });
  }
  async setVolume(percent: number): Promise<void> {
    const v = Math.max(0, Math.min(100, Math.round(percent)));
    await this.req(`/me/player/volume?volume_percent=${v}`, { method: "PUT" });
  }
  async setShuffle(on: boolean): Promise<void> {
    await this.req(`/me/player/shuffle?state=${on}`, { method: "PUT" });
  }
  async setRepeat(state: RepeatState): Promise<void> {
    await this.req(`/me/player/repeat?state=${state}`, { method: "PUT" });
  }
  async seek(positionMs: number): Promise<void> {
    await this.req(`/me/player/seek?position_ms=${Math.round(positionMs)}`, {
      method: "PUT",
    });
  }

  async checkLiked(trackId: string): Promise<boolean> {
    const r = await this.req<boolean[]>(`/me/tracks/contains?ids=${trackId}`);
    return r?.[0] ?? false;
  }
  async addToLiked(trackId: string): Promise<void> {
    await this.req(`/me/tracks?ids=${trackId}`, { method: "PUT" });
  }
  async removeFromLiked(trackId: string): Promise<void> {
    await this.req(`/me/tracks?ids=${trackId}`, { method: "DELETE" });
  }
  async setLiked(trackId: string, liked: boolean): Promise<void> {
    if (liked) await this.addToLiked(trackId);
    else await this.removeFromLiked(trackId);
  }

  async getQueue(): Promise<QueueResponse> {
    const r = await this.req<QueueResponse>("/me/player/queue");
    return r ?? { currently_playing: null, queue: [] };
  }
}

/**
 * Parse a `Retry-After` header per RFC 7231 §7.1.3. Spotify always sends an
 * integer-seconds form; we don't bother with the HTTP-date variant because
 * we'd need to handle clock skew anyway. Falls back to DEFAULT_RATE_LIMIT_MS
 * when the header is missing or unparseable, and clamps to MAX_RATE_LIMIT_MS
 * to bound the worst case.
 */
export function parseRetryAfter(header: string | null): number {
  if (header === null) return DEFAULT_RATE_LIMIT_MS;
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_RATE_LIMIT_MS;
  return Math.min(MAX_RATE_LIMIT_MS, Math.round(seconds * 1000));
}

export function pickCoverUrl(
  images: SpotifyImage[] | undefined,
  preferred: number | "largest" = "largest"
): string | null {
  if (!images || images.length === 0) return null;
  if (preferred === "largest") {
    const sorted = [...images].sort(
      (a, b) => (b.width ?? 0) - (a.width ?? 0)
    );
    return sorted[0]?.url ?? images[0].url;
  }
  const sorted = [...images].sort(
    (a, b) =>
      Math.abs((a.width ?? 0) - preferred) -
      Math.abs((b.width ?? 0) - preferred)
  );
  return sorted[0]?.url ?? images[0].url;
}
