import { describe, it, expect } from "vitest";
import {
  base64UrlEncode,
  generateCodeChallenge,
  generateCodeVerifier,
} from "../pkce";

// PKCE test surface (RFC 7636). jsdom (Vitest's default DOM env) ships a
// real WebCrypto via jsdom's bundled webcrypto polyfill, so getRandomValues
// and subtle.digest are exercised end-to-end here — no mocks.

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

describe("base64UrlEncode", () => {
  it("encodes bytes to base64url with no padding and url-safe chars", () => {
    // Bytes chosen to force `+`, `/`, and `=` in standard base64. Standard
    // base64 of [0xfb, 0xff, 0xbf] is "+/+/" with one `=` of padding;
    // base64url should produce "-_-_" with no padding.
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf, 0xfb, 0xff, 0xbf]).buffer;
    const out = base64UrlEncode(bytes);
    expect(out).not.toMatch(/[+/=]/);
    expect(out).toMatch(BASE64URL_RE);
  });

  it("returns empty string for empty input", () => {
    const empty = new Uint8Array(0).buffer;
    expect(base64UrlEncode(empty)).toBe("");
  });
});

describe("generateCodeVerifier", () => {
  it("produces a verifier of length ≥43 (RFC 7636 minimum for SHA-256)", () => {
    // 32 random bytes → base64url no-padding = exactly 43 chars.
    const v = generateCodeVerifier();
    expect(v.length).toBe(43);
  });

  it("uses only the unreserved-charset (A-Z, a-z, 0-9, '-', '_')", () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(BASE64URL_RE);
  });

  it("returns different verifiers on consecutive calls (sanity)", () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

describe("generateCodeChallenge", () => {
  it("returns a 43-char base64url-encoded SHA-256 digest", async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    // SHA-256 = 32 bytes → base64url no-padding = 43 chars.
    expect(challenge.length).toBe(43);
    expect(challenge).toMatch(BASE64URL_RE);
  });

  it("matches the RFC 7636 §B test vector", async () => {
    // RFC 7636 Appendix B publishes one canonical PKCE test vector. If the
    // implementation drifts (e.g. wrong hash, different encoding), this test
    // catches it deterministically.
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const expected = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).toBe(expected);
  });

  it("is deterministic: same verifier ⇒ same challenge", async () => {
    const verifier = generateCodeVerifier();
    const a = await generateCodeChallenge(verifier);
    const b = await generateCodeChallenge(verifier);
    expect(a).toBe(b);
  });
});
