import { Store } from "@tauri-apps/plugin-store";
import {
  start as startOAuthServer,
  cancel as cancelOAuthServer,
  onUrl,
} from "@fabianlars/tauri-plugin-oauth";
import { openUrl } from "@tauri-apps/plugin-opener";
import { generateCodeChallenge, generateCodeVerifier } from "./pkce";

// Spotify dev quotas changed in May 2025 — extended quota mode is now only
// granted to organizations (not individuals). Dev-mode apps are capped at
// 5 explicitly-allowlisted users, which makes a single bundled Client ID
// unviable for a public OSS desktop app.
//
// Lyripop's model: each user creates their own personal Spotify Developer
// app (a one-time ~3-minute step) and pastes the Client ID into the in-app
// wizard. Their own dev app authorizes them automatically as the owner.
//
// Resolution order for the effective Client ID at runtime:
//   1. VITE_SPOTIFY_CLIENT_ID env var (dev / power users)
//   2. Stored client-id from the in-app setup wizard
//   3. DEFAULT_CLIENT_ID source-bake (forks who want a different default)
//   4. empty -> AuthGate routes the user to the wizard
const DEFAULT_CLIENT_ID = "";
const ENV_CLIENT_ID =
  (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined) || "";

const CLIENT_ID_KEY = "clientId";
const CALLBACK_PORT = 8888;
const REDIRECT_URI = `http://127.0.0.1:${CALLBACK_PORT}/callback`;
// Scope minimisation: only what the app actually uses.
//   user-read-currently-playing: cover/title/artist/progress polling
//   user-read-playback-state:    is_playing, shuffle, repeat, device.volume
//   user-modify-playback-state:  play/pause/next/previous/seek/volume/shuffle/repeat
//   user-library-modify:         heart toggle (add/remove from Liked Songs)
//   user-library-read:           heart filled-state (is the track in Liked Songs)
const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-library-modify",
  "user-library-read",
].join(" ");

const STORE_FILE = "tokens.json";
const TOKENS_KEY = "spotify";

export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

let storePromise: Promise<Store> | null = null;
function store(): Promise<Store> {
  if (!storePromise) storePromise = Store.load(STORE_FILE);
  return storePromise;
}

export async function getStoredTokens(): Promise<Tokens | null> {
  const s = await store();
  return ((await s.get<Tokens>(TOKENS_KEY)) as Tokens | undefined) ?? null;
}

async function setStoredTokens(t: Tokens): Promise<void> {
  const s = await store();
  await s.set(TOKENS_KEY, t);
  await s.save();
}

export async function clearStoredTokens(): Promise<void> {
  const s = await store();
  await s.delete(TOKENS_KEY);
  await s.save();
}

// Client-ID storage (BYO wizard). Stored in the same store file as tokens
// at %APPDATA%\com.m6bernha.lyripop\tokens.json under key "clientId".
export async function getStoredClientId(): Promise<string | null> {
  const s = await store();
  const v = (await s.get<string>(CLIENT_ID_KEY)) as string | undefined;
  return v && v.length > 0 ? v : null;
}

export async function setStoredClientId(id: string): Promise<void> {
  const s = await store();
  await s.set(CLIENT_ID_KEY, id);
  // Tokens are bound to a specific Spotify app — clear them whenever the
  // user changes Client IDs so they re-auth against the new app.
  await s.delete(TOKENS_KEY);
  await s.save();
}

export async function clearStoredClientId(): Promise<void> {
  const s = await store();
  await s.delete(CLIENT_ID_KEY);
  await s.delete(TOKENS_KEY);
  await s.save();
}

// Effective Client ID: env -> stored -> default. Returns empty string when
// no Client ID is configured (AuthGate uses this to route to the wizard).
export async function getEffectiveClientId(): Promise<string> {
  if (ENV_CLIENT_ID) return ENV_CLIENT_ID;
  const stored = await getStoredClientId();
  if (stored) return stored;
  return DEFAULT_CLIENT_ID;
}

// Spotify Client IDs are 32-character lowercase hex strings. We accept that
// shape for a basic sanity check — full validation happens at OAuth time.
const CLIENT_ID_PATTERN = /^[a-f0-9]{32}$/i;
export function isValidClientIdFormat(id: string): boolean {
  return CLIENT_ID_PATTERN.test(id.trim());
}

async function exchangeCode(
  code: string,
  verifier: string,
  clientId: string
): Promise<Tokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    code_verifier: verifier,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(
      `Token exchange failed: ${res.status} ${await res.text().catch(() => "")}`
    );
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string
): Promise<Tokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

export async function startLogin(): Promise<Tokens> {
  const clientId = await getEffectiveClientId();
  if (!clientId) {
    throw new Error(
      "No Spotify Client ID configured. Run the in-app setup wizard to create your Spotify Developer app and paste your Client ID."
    );
  }
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  // CSRF/binding defense: random state we'll match against the callback.
  // PKCE alone blocks code injection, but `state` is the standard belt-and-
  // suspenders defense and Spotify recommends including it.
  const stateNonce = generateCodeVerifier();

  const port = await startOAuthServer({ ports: [CALLBACK_PORT] });

  const codePromise = new Promise<string>((resolve, reject) => {
    let unlisten: (() => void) | null = null;
    const timeout = setTimeout(
      () => {
        cancelOAuthServer(port).catch(() => {});
        unlisten?.();
        reject(new Error("OAuth flow timed out (5 min)"));
      },
      5 * 60 * 1000
    );

    onUrl((cbUrl) => {
      try {
        const u = new URL(cbUrl);
        const code = u.searchParams.get("code");
        const error = u.searchParams.get("error");
        const returnedState = u.searchParams.get("state");
        clearTimeout(timeout);
        cancelOAuthServer(port).catch(() => {});
        unlisten?.();
        if (error) {
          reject(new Error(`Spotify auth error: ${error}`));
        } else if (returnedState !== stateNonce) {
          reject(
            new Error(
              "OAuth state mismatch — possible CSRF or replay. Aborting."
            )
          );
        } else if (code) {
          resolve(code);
        } else {
          reject(new Error("No code in callback"));
        }
      } catch (e) {
        clearTimeout(timeout);
        cancelOAuthServer(port).catch(() => {});
        unlisten?.();
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    }).then((u) => (unlisten = u));
  });

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("state", stateNonce);

  await openUrl(authUrl.toString());

  const code = await codePromise;
  const tokens = await exchangeCode(code, codeVerifier, clientId);
  await setStoredTokens(tokens);
  return tokens;
}

export async function getValidAccessToken(): Promise<string> {
  let tokens = await getStoredTokens();
  if (!tokens) {
    tokens = await startLogin();
  } else if (Date.now() > tokens.expires_at - 60_000) {
    const clientId = await getEffectiveClientId();
    if (!clientId) {
      throw new Error(
        "No Spotify Client ID configured. Run the in-app setup wizard."
      );
    }
    tokens = await refreshAccessToken(tokens.refresh_token, clientId);
    await setStoredTokens(tokens);
  }
  return tokens.access_token;
}

export async function isConfigured(): Promise<boolean> {
  const id = await getEffectiveClientId();
  return Boolean(id);
}

// Bypass the 60-second pre-emptive window in `getValidAccessToken` and refresh
// the access token unconditionally. Used by the API client when Spotify
// returns 401 — the local clock might be skewed, the access token might have
// been revoked early at the server, or our cached `expires_at` could be stale.
// On a successful refresh we get a fresh token with `Date.now()`-relative
// `expires_at`; on failure (e.g. refresh token revoked) the caller is expected
// to surface a re-auth signal and route the user back to AuthGate.
export async function forceRefreshAccessToken(): Promise<string> {
  const tokens = await getStoredTokens();
  if (!tokens) {
    throw new Error("No tokens to refresh");
  }
  const clientId = await getEffectiveClientId();
  if (!clientId) {
    throw new Error("No Spotify Client ID configured");
  }
  const fresh = await refreshAccessToken(tokens.refresh_token, clientId);
  await setStoredTokens(fresh);
  return fresh.access_token;
}
