import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchLyrics,
  findActiveLineIndex,
  parseLrc,
  type LyricsLine,
} from "../lrclib";

interface FakeResponseInit {
  status?: number;
  body?: unknown;
}

function fakeResponse({ status = 200, body }: FakeResponseInit): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response;
}

describe("parseLrc", () => {
  it("returns empty array for empty input", () => {
    expect(parseLrc("")).toEqual([]);
  });

  it("parses a single timestamped line", () => {
    const lrc = "[01:23.45]Hello world";
    expect(parseLrc(lrc)).toEqual<LyricsLine[]>([
      { ms: 83_450, text: "Hello world" },
    ]);
  });

  it("rounds sub-millisecond fractions to nearest ms", () => {
    // [00:00.123] -> 123 ms; [00:00.1234] -> round(123.4) = 123
    expect(parseLrc("[00:00.123]a")).toEqual([{ ms: 123, text: "a" }]);
    expect(parseLrc("[00:00.1234]b")).toEqual([{ ms: 123, text: "b" }]);
  });

  it("expands multi-timestamp lines into one entry per timestamp", () => {
    const lrc = "[00:01.00][00:30.00]Repeat me";
    expect(parseLrc(lrc)).toEqual<LyricsLine[]>([
      { ms: 1_000, text: "Repeat me" },
      { ms: 30_000, text: "Repeat me" },
    ]);
  });

  it("sorts output ascending by ms regardless of input order", () => {
    const lrc = ["[00:30.00]later", "[00:10.00]earlier", "[00:20.00]middle"].join(
      "\n"
    );
    const result = parseLrc(lrc);
    expect(result.map((l) => l.ms)).toEqual([10_000, 20_000, 30_000]);
    expect(result.map((l) => l.text)).toEqual(["earlier", "middle", "later"]);
  });

  it("skips lines without timestamps (titles, blank, plain text)", () => {
    const lrc = [
      "Title: Foo",
      "",
      "[00:01.00]first",
      "Artist: Bar",
      "[00:02.00]second",
    ].join("\n");
    expect(parseLrc(lrc)).toEqual<LyricsLine[]>([
      { ms: 1_000, text: "first" },
      { ms: 2_000, text: "second" },
    ]);
  });

  it("trims surrounding whitespace from line text", () => {
    expect(parseLrc("[00:01.00]   spaced   ")).toEqual([
      { ms: 1_000, text: "spaced" },
    ]);
  });

  it("handles CRLF line endings (Windows lyrics)", () => {
    const lrc = "[00:01.00]first\r\n[00:02.00]second";
    expect(parseLrc(lrc)).toEqual<LyricsLine[]>([
      { ms: 1_000, text: "first" },
      { ms: 2_000, text: "second" },
    ]);
  });
});

describe("findActiveLineIndex", () => {
  const lines: LyricsLine[] = [
    { ms: 1_000, text: "a" },
    { ms: 2_000, text: "b" },
    { ms: 3_000, text: "c" },
    { ms: 4_000, text: "d" },
  ];

  it("returns -1 for empty input", () => {
    expect(findActiveLineIndex([], 0)).toBe(-1);
    expect(findActiveLineIndex([], 1_000)).toBe(-1);
  });

  it("returns -1 when current time is before the first line", () => {
    expect(findActiveLineIndex(lines, 0)).toBe(-1);
    expect(findActiveLineIndex(lines, 999)).toBe(-1);
  });

  it("returns the last index when current time is after the last line", () => {
    expect(findActiveLineIndex(lines, 4_000)).toBe(3);
    expect(findActiveLineIndex(lines, 60_000)).toBe(3);
  });

  it("returns the matching index for an exact timestamp hit", () => {
    expect(findActiveLineIndex(lines, 1_000)).toBe(0);
    expect(findActiveLineIndex(lines, 2_000)).toBe(1);
    expect(findActiveLineIndex(lines, 3_000)).toBe(2);
  });

  it("returns the previous line's index between two timestamps", () => {
    expect(findActiveLineIndex(lines, 1_500)).toBe(0);
    expect(findActiveLineIndex(lines, 2_999)).toBe(1);
    expect(findActiveLineIndex(lines, 3_001)).toBe(2);
  });

  it("binary-searches a 1000-line input correctly", () => {
    const big: LyricsLine[] = Array.from({ length: 1_000 }, (_, i) => ({
      ms: i * 10,
      text: `line${i}`,
    }));
    // Spot-check: at ms=4_995 the active line should be index 499 (ms=4_990,
    // because 5_000 is the next line and we want the last <= currentMs).
    expect(findActiveLineIndex(big, 4_995)).toBe(499);
    expect(findActiveLineIndex(big, 5_000)).toBe(500);
    expect(findActiveLineIndex(big, 9_990)).toBe(999);
    expect(findActiveLineIndex(big, 0)).toBe(0);
  });
});

describe("fetchLyrics", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the empty result on 404 (lrclib has no entry)", async () => {
    fetchSpy.mockResolvedValueOnce(fakeResponse({ status: 404 }));
    const result = await fetchLyrics({
      trackName: "Mystery Song",
      artistName: "Unknown",
    });
    expect(result).toEqual({
      syncedLyrics: null,
      plainLyrics: null,
      instrumental: false,
    });
  });

  it("throws on non-2xx, non-404 errors so the caller can back off", async () => {
    fetchSpy.mockResolvedValueOnce(fakeResponse({ status: 500 }));
    await expect(
      fetchLyrics({ trackName: "x", artistName: "y" })
    ).rejects.toThrow(/lrclib 500/);
  });

  it("parses synced + plain lyrics on a successful response", async () => {
    fetchSpy.mockResolvedValueOnce(
      fakeResponse({
        body: {
          syncedLyrics: "[00:01.00]hello\n[00:02.00]world",
          plainLyrics: "hello\nworld",
          instrumental: false,
        },
      })
    );
    const result = await fetchLyrics({ trackName: "x", artistName: "y" });
    expect(result.syncedLyrics).toEqual([
      { ms: 1_000, text: "hello" },
      { ms: 2_000, text: "world" },
    ]);
    expect(result.plainLyrics).toBe("hello\nworld");
    expect(result.instrumental).toBe(false);
  });

  it("flags instrumentals (synced + plain are null)", async () => {
    fetchSpy.mockResolvedValueOnce(
      fakeResponse({
        body: {
          syncedLyrics: null,
          plainLyrics: null,
          instrumental: true,
        },
      })
    );
    const result = await fetchLyrics({ trackName: "x", artistName: "y" });
    expect(result).toEqual({
      syncedLyrics: null,
      plainLyrics: null,
      instrumental: true,
    });
  });

  it("includes album_name + duration in the query when provided", async () => {
    fetchSpy.mockResolvedValueOnce(
      fakeResponse({
        body: { syncedLyrics: null, plainLyrics: "x", instrumental: false },
      })
    );
    await fetchLyrics({
      trackName: "Track",
      artistName: "Artist",
      albumName: "Album",
      durationSec: 180,
    });
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("track_name=Track");
    expect(url).toContain("artist_name=Artist");
    expect(url).toContain("album_name=Album");
    expect(url).toContain("duration=180");
  });

  it("omits album_name + duration when not provided", async () => {
    fetchSpy.mockResolvedValueOnce(
      fakeResponse({
        body: { syncedLyrics: null, plainLyrics: "x", instrumental: false },
      })
    );
    await fetchLyrics({ trackName: "Track", artistName: "Artist" });
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).not.toContain("album_name");
    expect(url).not.toContain("duration");
  });

  it("defaults instrumental to false when the field is missing", async () => {
    fetchSpy.mockResolvedValueOnce(
      fakeResponse({
        // Older lrclib responses don't always include the instrumental field.
        body: { syncedLyrics: null, plainLyrics: "x" },
      })
    );
    const result = await fetchLyrics({ trackName: "x", artistName: "y" });
    expect(result.instrumental).toBe(false);
  });
});
