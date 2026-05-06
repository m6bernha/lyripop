import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseRetryAfter,
  pickCoverUrl,
  SpotifyAuthError,
  SpotifyClient,
  SpotifyRateLimitError,
} from "../spotify";

interface FakeResponseInit {
  status?: number;
  contentType?: string | null;
  body?: unknown;
  text?: string;
  retryAfter?: string | null;
}

function fakeResponse({
  status = 200,
  contentType = "application/json",
  body,
  text,
  retryAfter = null,
}: FakeResponseInit = {}): Response {
  const headers = new Headers();
  if (contentType !== null) headers.set("content-type", contentType);
  if (retryAfter !== null) headers.set("Retry-After", retryAfter);
  return {
    status,
    ok: status >= 200 && status < 300,
    headers,
    json: async () => body,
    text: async () => text ?? "",
  } as unknown as Response;
}

describe("SpotifyClient.req()", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let getAccessToken: ReturnType<typeof vi.fn<() => Promise<string>>>;
  let forceRefresh: ReturnType<typeof vi.fn<() => Promise<string>>>;
  let client: SpotifyClient;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    getAccessToken = vi.fn<() => Promise<string>>(async () => "tok-stale");
    forceRefresh = vi.fn<() => Promise<string>>(async () => "tok-fresh");
    client = new SpotifyClient(getAccessToken, forceRefresh);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns parsed JSON on 200", async () => {
    fetchSpy.mockResolvedValueOnce(
      fakeResponse({ body: { is_playing: true } })
    );
    const result = await client.getPlaybackState();
    expect(result).toEqual({ is_playing: true });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("returns null on 204 (no active playback)", async () => {
    fetchSpy.mockResolvedValueOnce(fakeResponse({ status: 204, contentType: null }));
    expect(await client.getPlaybackState()).toBeNull();
  });

  it("returns null on 202 (queued)", async () => {
    fetchSpy.mockResolvedValueOnce(fakeResponse({ status: 202, contentType: null }));
    expect(await client.getPlaybackState()).toBeNull();
  });

  it("returns null on 200 with non-JSON content type", async () => {
    fetchSpy.mockResolvedValueOnce(
      fakeResponse({ contentType: "text/plain", body: "not parsed" })
    );
    expect(await client.getPlaybackState()).toBeNull();
  });

  it("on 401 forces a refresh and retries with the new token", async () => {
    fetchSpy
      .mockResolvedValueOnce(fakeResponse({ status: 401, contentType: null }))
      .mockResolvedValueOnce(fakeResponse({ body: { is_playing: false } }));
    const result = await client.getPlaybackState();
    expect(result).toEqual({ is_playing: false });
    expect(forceRefresh).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    // Second call should carry the fresh token in Authorization header.
    const secondCallInit = fetchSpy.mock.calls[1][1] as RequestInit;
    expect(
      (secondCallInit.headers as Record<string, string>).Authorization
    ).toBe("Bearer tok-fresh");
  });

  it("throws SpotifyAuthError when 401 persists after refresh retry", async () => {
    fetchSpy
      .mockResolvedValueOnce(fakeResponse({ status: 401, contentType: null }))
      .mockResolvedValueOnce(fakeResponse({ status: 401, contentType: null }));
    await expect(client.getPlaybackState()).rejects.toThrow(SpotifyAuthError);
    expect(forceRefresh).toHaveBeenCalledOnce();
  });

  it("throws SpotifyAuthError when forceRefresh itself fails", async () => {
    fetchSpy.mockResolvedValueOnce(
      fakeResponse({ status: 401, contentType: null })
    );
    forceRefresh.mockRejectedValueOnce(new Error("refresh-token revoked"));
    await expect(client.getPlaybackState()).rejects.toThrow(SpotifyAuthError);
    // No retry attempted when the refresh itself failed.
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("throws SpotifyAuthError on 403 without retrying", async () => {
    fetchSpy.mockResolvedValueOnce(
      fakeResponse({ status: 403, contentType: null })
    );
    await expect(client.getPlaybackState()).rejects.toThrow(SpotifyAuthError);
    expect(forceRefresh).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("throws SpotifyRateLimitError on 429 with parsed Retry-After", async () => {
    fetchSpy.mockResolvedValueOnce(
      fakeResponse({ status: 429, contentType: null, retryAfter: "3" })
    );
    await expect(client.getPlaybackState()).rejects.toMatchObject({
      name: "SpotifyRateLimitError",
      retryAfterMs: 3_000,
    });
  });

  it("throws SpotifyRateLimitError with default delay when Retry-After missing", async () => {
    fetchSpy.mockResolvedValueOnce(
      fakeResponse({ status: 429, contentType: null })
    );
    let caught: unknown;
    try {
      await client.getPlaybackState();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(SpotifyRateLimitError);
    expect((caught as SpotifyRateLimitError).retryAfterMs).toBe(5_000);
  });

  it("throws plain Error with status + body on 500", async () => {
    fetchSpy.mockResolvedValueOnce(
      fakeResponse({
        status: 500,
        contentType: null,
        text: "internal error",
      })
    );
    await expect(client.getPlaybackState()).rejects.toThrow(/500.*internal/);
  });
});

describe("SpotifyClient command methods", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let client: SpotifyClient;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(
      fakeResponse({ status: 204, contentType: null })
    );
    vi.stubGlobal("fetch", fetchSpy);
    client = new SpotifyClient(
      async () => "tok",
      async () => "tok-fresh"
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Helper: pull the path Spotify saw out of fetchSpy's call args.
  function calledPath(): string {
    const url = fetchSpy.mock.calls[0][0] as string;
    return url.replace("https://api.spotify.com/v1", "");
  }
  function calledMethod(): string {
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    return init.method ?? "GET";
  }

  it("play() PUTs /me/player/play", async () => {
    await client.play();
    expect(calledPath()).toBe("/me/player/play");
    expect(calledMethod()).toBe("PUT");
  });

  it("pause() PUTs /me/player/pause", async () => {
    await client.pause();
    expect(calledPath()).toBe("/me/player/pause");
    expect(calledMethod()).toBe("PUT");
  });

  it("next() POSTs /me/player/next", async () => {
    await client.next();
    expect(calledPath()).toBe("/me/player/next");
    expect(calledMethod()).toBe("POST");
  });

  it("previous() POSTs /me/player/previous", async () => {
    await client.previous();
    expect(calledPath()).toBe("/me/player/previous");
    expect(calledMethod()).toBe("POST");
  });

  it("setVolume() clamps to 0-100 and PUTs the percent", async () => {
    await client.setVolume(50);
    expect(calledPath()).toBe("/me/player/volume?volume_percent=50");

    fetchSpy.mockClear();
    await client.setVolume(-30);
    expect(calledPath()).toBe("/me/player/volume?volume_percent=0");

    fetchSpy.mockClear();
    await client.setVolume(180);
    expect(calledPath()).toBe("/me/player/volume?volume_percent=100");

    fetchSpy.mockClear();
    await client.setVolume(42.7);
    expect(calledPath()).toBe("/me/player/volume?volume_percent=43");
  });

  it("setShuffle() forwards the boolean state", async () => {
    await client.setShuffle(true);
    expect(calledPath()).toBe("/me/player/shuffle?state=true");
    fetchSpy.mockClear();
    await client.setShuffle(false);
    expect(calledPath()).toBe("/me/player/shuffle?state=false");
  });

  it("setRepeat() forwards the repeat enum", async () => {
    await client.setRepeat("off");
    expect(calledPath()).toBe("/me/player/repeat?state=off");
    fetchSpy.mockClear();
    await client.setRepeat("track");
    expect(calledPath()).toBe("/me/player/repeat?state=track");
    fetchSpy.mockClear();
    await client.setRepeat("context");
    expect(calledPath()).toBe("/me/player/repeat?state=context");
  });

  it("seek() rounds to nearest ms", async () => {
    await client.seek(12_345.78);
    expect(calledPath()).toBe("/me/player/seek?position_ms=12346");
  });

  it("checkLiked() returns the boolean from the [trackId] response", async () => {
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValueOnce(fakeResponse({ body: [true] }));
    expect(await client.checkLiked("xyz")).toBe(true);

    fetchSpy.mockResolvedValueOnce(fakeResponse({ body: [false] }));
    expect(await client.checkLiked("xyz")).toBe(false);

    // Defensive: empty array → false.
    fetchSpy.mockResolvedValueOnce(fakeResponse({ body: [] }));
    expect(await client.checkLiked("xyz")).toBe(false);
  });

  it("setLiked() routes true → addToLiked (PUT) and false → removeFromLiked (DELETE)", async () => {
    await client.setLiked("trk", true);
    let init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("PUT");
    expect(fetchSpy.mock.calls[0][0]).toContain("/me/tracks?ids=trk");

    fetchSpy.mockClear();
    await client.setLiked("trk", false);
    init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("DELETE");
  });

  it("getQueue() returns the response unchanged", async () => {
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValueOnce(
      fakeResponse({
        body: { currently_playing: null, queue: [{ id: "a" }] },
      })
    );
    const result = await client.getQueue();
    expect(result.queue).toEqual([{ id: "a" }]);
  });

  it("getQueue() falls back to empty when the API returns null/204", async () => {
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValueOnce(
      fakeResponse({ status: 204, contentType: null })
    );
    expect(await client.getQueue()).toEqual({
      currently_playing: null,
      queue: [],
    });
  });
});

describe("parseRetryAfter", () => {
  it("returns the default when header is null", () => {
    expect(parseRetryAfter(null)).toBe(5_000);
  });

  it("parses integer seconds", () => {
    expect(parseRetryAfter("3")).toBe(3_000);
    expect(parseRetryAfter("10")).toBe(10_000);
  });

  it("parses fractional seconds (Spotify only sends integers, but be liberal)", () => {
    expect(parseRetryAfter("1.5")).toBe(1_500);
  });

  it("falls back to default for unparseable headers", () => {
    expect(parseRetryAfter("not-a-number")).toBe(5_000);
    expect(parseRetryAfter("")).toBe(5_000);
  });

  it("falls back to default for non-positive values", () => {
    expect(parseRetryAfter("0")).toBe(5_000);
    expect(parseRetryAfter("-3")).toBe(5_000);
  });

  it("clamps absurdly large values to the 60s ceiling", () => {
    expect(parseRetryAfter("999999")).toBe(60_000);
    expect(parseRetryAfter("3600")).toBe(60_000);
  });
});

describe("pickCoverUrl", () => {
  const images = [
    { url: "https://x/300", width: 300, height: 300 },
    { url: "https://x/64", width: 64, height: 64 },
    { url: "https://x/640", width: 640, height: 640 },
  ];

  it("returns null on empty input", () => {
    expect(pickCoverUrl([])).toBeNull();
    expect(pickCoverUrl(undefined)).toBeNull();
  });

  it("returns the largest by width when preferred is 'largest'", () => {
    expect(pickCoverUrl(images, "largest")).toBe("https://x/640");
  });

  it("defaults to 'largest' when no preferred argument is passed", () => {
    expect(pickCoverUrl(images)).toBe("https://x/640");
  });

  it("returns the closest match for a numeric preferred width", () => {
    expect(pickCoverUrl(images, 70)).toBe("https://x/64");
    expect(pickCoverUrl(images, 320)).toBe("https://x/300");
    expect(pickCoverUrl(images, 700)).toBe("https://x/640");
  });
});
