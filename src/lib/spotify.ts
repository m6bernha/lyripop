const API_BASE = "https://api.spotify.com/v1";

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

export class SpotifyClient {
  constructor(private getAccessToken: () => Promise<string>) {}

  private async req<T>(
    path: string,
    init?: { method?: string; body?: Json }
  ): Promise<T | null> {
    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (init?.body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(`${API_BASE}${path}`, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

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
