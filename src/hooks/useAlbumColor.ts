import { useEffect, useRef, useState } from "react";
import { Vibrant } from "node-vibrant/browser";

export interface AlbumPalette {
  vibrant: string;
  muted: string;
  darkVibrant: string;
  darkMuted: string;
  lightVibrant: string;
}

const FALLBACK: AlbumPalette = {
  vibrant: "#1db954",
  muted: "#535353",
  darkVibrant: "#0d3a1f",
  darkMuted: "#1a1a1a",
  lightVibrant: "#a3e6c0",
};

export function useAlbumColor(
  coverUrl: string | null,
  aggressive = false
): AlbumPalette {
  const cacheRef = useRef<Map<string, AlbumPalette>>(new Map());
  const [palette, setPalette] = useState<AlbumPalette>(FALLBACK);

  useEffect(() => {
    if (!coverUrl) {
      setPalette(FALLBACK);
      return;
    }
    const key = `${coverUrl}|${aggressive}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setPalette(cached);
      return;
    }

    let cancelled = false;
    Vibrant.from(coverUrl)
      .quality(3)
      .getPalette()
      .then((p) => {
        if (cancelled) return;
        const next: AlbumPalette = {
          vibrant: hex(p.Vibrant?.hex, FALLBACK.vibrant, aggressive),
          muted: hex(p.Muted?.hex, FALLBACK.muted, aggressive),
          darkVibrant: hex(
            p.DarkVibrant?.hex,
            FALLBACK.darkVibrant,
            aggressive
          ),
          darkMuted: hex(p.DarkMuted?.hex, FALLBACK.darkMuted, aggressive),
          lightVibrant: hex(
            p.LightVibrant?.hex,
            FALLBACK.lightVibrant,
            aggressive
          ),
        };
        cacheRef.current.set(key, next);
        setPalette(next);
      })
      .catch(() => {
        if (!cancelled) setPalette(FALLBACK);
      });

    return () => {
      cancelled = true;
    };
  }, [coverUrl, aggressive]);

  return palette;
}

function hex(value: string | undefined, fallback: string, aggressive: boolean): string {
  if (!value) return fallback;
  if (!aggressive) return value;
  return boostSaturation(value, 0.3);
}

function boostSaturation(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const newS = Math.min(1, s + amount);
  const { r: nr, g: ng, b: nb } = hslToRgb(h, newS, l);
  return rgbToHex(nr, ng, nb);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const v = parseInt(clean, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const v = (r << 16) | (g << 8) | b;
  return `#${v.toString(16).padStart(6, "0")}`;
}

function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case rn:
      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
      break;
    case gn:
      h = ((bn - rn) / d + 2) * 60;
      break;
    default:
      h = ((rn - gn) / d + 4) * 60;
  }
  return { h, s, l };
}

function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  const tr = (t: number) => {
    let v = t;
    if (v < 0) v += 1;
    if (v > 1) v -= 1;
    if (v < 1 / 6) return p + (q - p) * 6 * v;
    if (v < 1 / 2) return q;
    if (v < 2 / 3) return p + (q - p) * (2 / 3 - v) * 6;
    return p;
  };
  return {
    r: Math.round(tr(hk + 1 / 3) * 255),
    g: Math.round(tr(hk) * 255),
    b: Math.round(tr(hk - 1 / 3) * 255),
  };
}
