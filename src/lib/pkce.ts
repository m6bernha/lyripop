// PKCE (RFC 7636) helpers for Spotify's OAuth 2.0 Authorization Code flow.
//
// Extracted from auth.ts so they're directly unit-testable without the
// Tauri Store / OAuth-server / openUrl side effects that auth.ts pulls in.
// Kept narrowly focused on the math; auth.ts owns the OAuth orchestration.

/** Base64url-encode raw bytes (no padding, `+`→`-`, `/`→`_`). */
export function base64UrlEncode(bytes: ArrayBuffer): string {
  const b = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Generate a PKCE code verifier per RFC 7636 §4.1.
 * 32 random bytes → base64url-encoded → 43-character string of unreserved chars.
 */
export function generateCodeVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(bytes.buffer);
}

/**
 * Compute the S256 code challenge from a verifier per RFC 7636 §4.2.
 * SHA-256 of the verifier's UTF-8 bytes, base64url-encoded.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}
