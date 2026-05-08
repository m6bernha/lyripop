import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// auth.ts imports four Tauri plugins at module-load time. Hoist mocks for
// each one so the real plugin code never runs in this test environment.
//
// `@tauri-apps/plugin-store`: replaced with a Map-backed fake. Each
// `Store.load(file)` call returns a fresh fake so tests don't bleed state.
// We expose the Map on `__inner` so test cases can poke at the raw bytes
// when needed (e.g. to seed a stored Client ID before importing auth.ts).
//
// `@fabianlars/tauri-plugin-oauth` and `@tauri-apps/plugin-opener` are
// orchestration-only — auth.ts pulls them in but the helpers we test here
// (isValidClientIdFormat, get/setStoredClientId, getEffectiveClientId,
// clearStoredTokens, clearStoredClientId) never reach them. Mock as no-ops.

interface FakeStore {
  __inner: Map<string, unknown>;
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  save(): Promise<void>;
}

function createFakeStore(): FakeStore {
  const map = new Map<string, unknown>();
  return {
    __inner: map,
    get: async <T>(key: string) => map.get(key) as T | undefined,
    set: async (key: string, value: unknown) => {
      map.set(key, value);
    },
    delete: async (key: string) => {
      map.delete(key);
    },
    save: async () => {},
  };
}

// Module-scoped `currentStore` so test cases can swap which Map a fresh
// `Store.load` returns. Re-pointed in beforeEach.
let currentStore: FakeStore = createFakeStore();

vi.mock("@tauri-apps/plugin-store", () => ({
  Store: {
    load: vi.fn(async () => currentStore),
  },
}));

vi.mock("@fabianlars/tauri-plugin-oauth", () => ({
  start: vi.fn(),
  cancel: vi.fn(),
  onUrl: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

beforeEach(() => {
  // Fresh fake store + reset module registry so auth.ts's module-level
  // `storePromise` cache doesn't carry over between tests.
  currentStore = createFakeStore();
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isValidClientIdFormat", () => {
  it("accepts a 32-char lowercase hex string", async () => {
    const { isValidClientIdFormat } = await import("../auth");
    expect(isValidClientIdFormat("abcdef0123456789abcdef0123456789")).toBe(true);
  });

  it("accepts uppercase hex (case-insensitive)", async () => {
    const { isValidClientIdFormat } = await import("../auth");
    expect(isValidClientIdFormat("ABCDEF0123456789ABCDEF0123456789")).toBe(true);
  });

  it("trims surrounding whitespace before validating", async () => {
    const { isValidClientIdFormat } = await import("../auth");
    expect(
      isValidClientIdFormat("  abcdef0123456789abcdef0123456789  ")
    ).toBe(true);
  });

  it("rejects strings shorter than 32 chars", async () => {
    const { isValidClientIdFormat } = await import("../auth");
    expect(isValidClientIdFormat("abcdef0123456789abcdef012345678")).toBe(
      false
    );
  });

  it("rejects strings longer than 32 chars", async () => {
    const { isValidClientIdFormat } = await import("../auth");
    expect(isValidClientIdFormat("abcdef0123456789abcdef01234567890")).toBe(
      false
    );
  });

  it("rejects non-hex characters", async () => {
    const { isValidClientIdFormat } = await import("../auth");
    expect(isValidClientIdFormat("ghijklmnop!@#$%^&*()ghijklmnopqr")).toBe(
      false
    );
    expect(isValidClientIdFormat("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz")).toBe(
      false
    );
  });

  it("rejects empty string", async () => {
    const { isValidClientIdFormat } = await import("../auth");
    expect(isValidClientIdFormat("")).toBe(false);
  });
});

describe("getStoredClientId / setStoredClientId / getEffectiveClientId", () => {
  it("returns null when no Client ID is stored", async () => {
    const { getStoredClientId } = await import("../auth");
    expect(await getStoredClientId()).toBeNull();
  });

  it("returns the stored Client ID when one exists", async () => {
    const { getStoredClientId, setStoredClientId } = await import("../auth");
    await setStoredClientId("abcdef0123456789abcdef0123456789");
    expect(await getStoredClientId()).toBe(
      "abcdef0123456789abcdef0123456789"
    );
  });

  it("treats a stored empty string as null (no Client ID)", async () => {
    const { getStoredClientId } = await import("../auth");
    // Seed the fake store with an empty string directly; getStoredClientId
    // should normalise that to null.
    currentStore.__inner.set("clientId", "");
    expect(await getStoredClientId()).toBeNull();
  });

  it("setStoredClientId clears existing tokens (force re-auth on app swap)", async () => {
    const { setStoredClientId, getStoredTokens } = await import("../auth");
    // Seed pre-existing tokens, then set a new Client ID.
    currentStore.__inner.set("spotify", {
      access_token: "stale",
      refresh_token: "stale",
      expires_at: Date.now() + 60_000,
    });
    await setStoredClientId("abcdef0123456789abcdef0123456789");
    expect(await getStoredTokens()).toBeNull();
  });

  it("getEffectiveClientId returns empty string when nothing is configured", async () => {
    const { getEffectiveClientId } = await import("../auth");
    expect(await getEffectiveClientId()).toBe("");
  });

  it("getEffectiveClientId returns the stored value when env is empty", async () => {
    const { setStoredClientId, getEffectiveClientId } = await import(
      "../auth"
    );
    await setStoredClientId("abcdef0123456789abcdef0123456789");
    expect(await getEffectiveClientId()).toBe(
      "abcdef0123456789abcdef0123456789"
    );
  });

  it("getEffectiveClientId prefers the env var over the stored value", async () => {
    vi.stubEnv("VITE_SPOTIFY_CLIENT_ID", "envvalue123envvalue123envvalue12");
    const { setStoredClientId, getEffectiveClientId } = await import(
      "../auth"
    );
    await setStoredClientId("storedvalueabcdefabcdefabcdef012");
    expect(await getEffectiveClientId()).toBe(
      "envvalue123envvalue123envvalue12"
    );
  });
});

describe("clearStoredTokens / clearStoredClientId", () => {
  it("clearStoredTokens removes only the tokens", async () => {
    const { clearStoredTokens } = await import("../auth");
    currentStore.__inner.set("spotify", { access_token: "x" });
    currentStore.__inner.set("clientId", "abcdef0123456789abcdef0123456789");
    await clearStoredTokens();
    expect(currentStore.__inner.has("spotify")).toBe(false);
    expect(currentStore.__inner.has("clientId")).toBe(true);
  });

  it("clearStoredClientId removes both Client ID and tokens", async () => {
    const { clearStoredClientId } = await import("../auth");
    currentStore.__inner.set("spotify", { access_token: "x" });
    currentStore.__inner.set("clientId", "abcdef0123456789abcdef0123456789");
    await clearStoredClientId();
    expect(currentStore.__inner.has("spotify")).toBe(false);
    expect(currentStore.__inner.has("clientId")).toBe(false);
  });

  it("clearStoredClientId routes the app back to the wizard (isConfigured -> false)", async () => {
    // The user-facing contract behind the Settings "Reset Spotify connection"
    // button: after the reset, AuthGate must route to the first-run wizard.
    // AuthGate's routing decision is `isConfigured()`, so we lock the
    // composition in a single integration assertion rather than rely on the
    // two helpers staying consistent on their own.
    const { setStoredClientId, clearStoredClientId, isConfigured } =
      await import("../auth");
    await setStoredClientId("abcdef0123456789abcdef0123456789");
    expect(await isConfigured()).toBe(true);
    await clearStoredClientId();
    expect(await isConfigured()).toBe(false);
  });
});

describe("isConfigured", () => {
  it("returns false when no Client ID is set", async () => {
    const { isConfigured } = await import("../auth");
    expect(await isConfigured()).toBe(false);
  });

  it("returns true when a Client ID is stored", async () => {
    const { isConfigured, setStoredClientId } = await import("../auth");
    await setStoredClientId("abcdef0123456789abcdef0123456789");
    expect(await isConfigured()).toBe(true);
  });

  it("returns true when only the env var is set", async () => {
    vi.stubEnv("VITE_SPOTIFY_CLIENT_ID", "envvalue123envvalue123envvalue12");
    const { isConfigured } = await import("../auth");
    expect(await isConfigured()).toBe(true);
  });
});

// Helpers for the network-touching auth fns.
function fakeTokenResponse({
  status = 200,
  body,
}: {
  status?: number;
  body?: unknown;
}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => "",
  } as unknown as Response;
}

describe("forceRefreshAccessToken", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws when no tokens are stored", async () => {
    const { setStoredClientId, forceRefreshAccessToken } = await import(
      "../auth"
    );
    await setStoredClientId("abcdef0123456789abcdef0123456789");
    await expect(forceRefreshAccessToken()).rejects.toThrow(
      /No tokens to refresh/
    );
  });

  it("throws when no Client ID is configured", async () => {
    const { forceRefreshAccessToken } = await import("../auth");
    currentStore.__inner.set("spotify", {
      access_token: "old",
      refresh_token: "rt",
      expires_at: Date.now() + 60_000,
    });
    await expect(forceRefreshAccessToken()).rejects.toThrow(
      /No Spotify Client ID configured/
    );
  });

  it("posts to the token endpoint with refresh_token grant + persists fresh tokens", async () => {
    const { setStoredClientId, forceRefreshAccessToken, getStoredTokens } =
      await import("../auth");
    await setStoredClientId("abcdef0123456789abcdef0123456789");
    currentStore.__inner.set("spotify", {
      access_token: "old",
      refresh_token: "rt-1",
      expires_at: 0, // intentionally stale
    });
    fetchSpy.mockResolvedValueOnce(
      fakeTokenResponse({
        body: {
          access_token: "new-access",
          refresh_token: "rt-2",
          expires_in: 3_600,
        },
      })
    );
    const result = await forceRefreshAccessToken();
    expect(result).toBe("new-access");
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://accounts.spotify.com/api/token");
    expect(init.method).toBe("POST");
    expect(init.body?.toString()).toContain("grant_type=refresh_token");
    expect(init.body?.toString()).toContain("refresh_token=rt-1");
    // Persisted tokens have the new access token + a future expires_at.
    const stored = await getStoredTokens();
    expect(stored?.access_token).toBe("new-access");
    expect(stored?.refresh_token).toBe("rt-2");
    expect(stored?.expires_at).toBeGreaterThan(Date.now());
  });

  it("keeps the old refresh_token if the response omits one", async () => {
    const { setStoredClientId, forceRefreshAccessToken, getStoredTokens } =
      await import("../auth");
    await setStoredClientId("abcdef0123456789abcdef0123456789");
    currentStore.__inner.set("spotify", {
      access_token: "old",
      refresh_token: "rt-original",
      expires_at: 0,
    });
    fetchSpy.mockResolvedValueOnce(
      fakeTokenResponse({
        body: {
          access_token: "new-access",
          // no refresh_token — Spotify only rotates these occasionally
          expires_in: 3_600,
        },
      })
    );
    await forceRefreshAccessToken();
    expect((await getStoredTokens())?.refresh_token).toBe("rt-original");
  });

  it("propagates HTTP failures from the token endpoint", async () => {
    const { setStoredClientId, forceRefreshAccessToken } = await import(
      "../auth"
    );
    await setStoredClientId("abcdef0123456789abcdef0123456789");
    currentStore.__inner.set("spotify", {
      access_token: "old",
      refresh_token: "rt",
      expires_at: 0,
    });
    fetchSpy.mockResolvedValueOnce(fakeTokenResponse({ status: 400 }));
    await expect(forceRefreshAccessToken()).rejects.toThrow(/Token refresh/);
  });
});

describe("getValidAccessToken", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the stored access token when far from expiry", async () => {
    const { getValidAccessToken } = await import("../auth");
    currentStore.__inner.set("spotify", {
      access_token: "still-valid",
      refresh_token: "rt",
      expires_at: Date.now() + 600_000, // 10 min away
    });
    expect(await getValidAccessToken()).toBe("still-valid");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refreshes pre-emptively when within the 60s window", async () => {
    const { setStoredClientId, getValidAccessToken } = await import(
      "../auth"
    );
    await setStoredClientId("abcdef0123456789abcdef0123456789");
    currentStore.__inner.set("spotify", {
      access_token: "stale",
      refresh_token: "rt",
      expires_at: Date.now() + 30_000, // inside the 60s window
    });
    fetchSpy.mockResolvedValueOnce(
      fakeTokenResponse({
        body: {
          access_token: "fresh",
          refresh_token: "rt-2",
          expires_in: 3_600,
        },
      })
    );
    expect(await getValidAccessToken()).toBe("fresh");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
