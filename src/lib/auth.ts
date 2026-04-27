import { Store } from "@tauri-apps/plugin-store";
import {
  start as startOAuthServer,
  cancel as cancelOAuthServer,
  onUrl,
} from "@fabianlars/tauri-plugin-oauth";
import { openUrl } from "@tauri-apps/plugin-opener";

// Lyripop's bundled Spotify Developer app Client ID.
// PKCE flow doesn't use a client secret, so it's safe to ship the Client ID
// publicly — Spotify's public-client docs explicitly endorse this.
// Power users can override via VITE_SPOTIFY_CLIENT_ID in .env.local for their
// own Spotify Developer app (sovereignty / quota independence).
//
// To swap this for your own Spotify app: set DEFAULT_CLIENT_ID below.
const DEFAULT_CLIENT_ID = "";

const CLIENT_ID =
  (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined) ||
  DEFAULT_CLIENT_ID;

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

function base64UrlEncode(bytes: ArrayBuffer): string {
  const b = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateCodeVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(bytes.buffer);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}

async function exchangeCode(code: string, verifier: string): Promise<Tokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
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

async function refreshAccessToken(refreshToken: string): Promise<Tokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
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
  if (!CLIENT_ID) {
    throw new Error(
      "VITE_SPOTIFY_CLIENT_ID is not set. Create a Spotify app at developer.spotify.com and add the Client ID to .env.local"
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
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("state", stateNonce);

  await openUrl(authUrl.toString());

  const code = await codePromise;
  const tokens = await exchangeCode(code, codeVerifier);
  await setStoredTokens(tokens);
  return tokens;
}

export async function getValidAccessToken(): Promise<string> {
  let tokens = await getStoredTokens();
  if (!tokens) {
    tokens = await startLogin();
  } else if (Date.now() > tokens.expires_at - 60_000) {
    tokens = await refreshAccessToken(tokens.refresh_token);
    await setStoredTokens(tokens);
  }
  return tokens.access_token;
}

export function isConfigured(): boolean {
  return Boolean(CLIENT_ID);
}
