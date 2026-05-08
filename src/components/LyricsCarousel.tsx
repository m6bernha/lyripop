import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { useLyrics } from "../hooks/useLyrics";
import type { SpotifyTrack } from "../lib/spotify";
import type { LyricsLine } from "../lib/lrclib";

interface Props {
  track: SpotifyTrack | null;
  progressMs: number;
  onSeek?: (ms: number) => void;
}

const VISIBLE_BEFORE = 2;
const VISIBLE_AFTER = 2;
const SNAP_BACK_MS = 4000;
const WHEEL_THROTTLE_MS = 90;

export default function LyricsCarousel({ track, progressMs, onSeek }: Props) {
  const { lyricsEnabled } = useSettings();
  const { syncedLines, plainLyrics, instrumental, activeIndex, loading } =
    useLyrics(track, progressMs, lyricsEnabled);

  // Plain lyrics → text-only line list (no timestamps).
  const plainLines = useMemo<LyricsLine[] | null>(() => {
    if (!plainLyrics) return null;
    const lines = plainLyrics
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (lines.length === 0) return null;
    return lines.map((text) => ({ ms: 0, text }));
  }, [plainLyrics]);

  const isSynced = !!syncedLines;
  const lines = syncedLines ?? plainLines ?? null;

  // For synced: offset relative to currently-playing line (snaps back to 0).
  // For plain: absolute index of the centered line (no auto-advance).
  const [offset, setOffset] = useState(0);
  const lastWheelMsRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset offset when track changes.
  useEffect(() => {
    setOffset(0);
  }, [track?.id]);

  // Synced: after idle, snap the view back to whichever line is now playing.
  useEffect(() => {
    if (!isSynced || offset === 0) return;
    const id = window.setTimeout(() => setOffset(0), SNAP_BACK_MS);
    return () => window.clearTimeout(id);
  }, [offset, isSynced]);

  // Native wheel handler (React's onWheel uses passive listeners and can't
  // preventDefault, which means the page scrolls instead of our carousel).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !lines || lines.length === 0) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheelMsRef.current < WHEEL_THROTTLE_MS) return;
      lastWheelMsRef.current = now;
      const dir = e.deltaY > 0 ? 1 : -1;
      setOffset((prev) => {
        if (isSynced) return prev + dir;
        return Math.max(0, Math.min(lines.length - 1, prev + dir));
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [lines, isSynced]);

  if (!track) return null;
  if (!lyricsEnabled) {
    return (
      <CenteredText>
        Lyrics fetching is disabled.
        <br />
        Enable it in Settings to fetch from lrclib.net.
      </CenteredText>
    );
  }
  if (loading) return <CenteredText>loading lyrics…</CenteredText>;
  if (instrumental) {
    return (
      <div className="flex items-center justify-center h-full text-white/60 text-sm tracking-widest">
        ♪ ♪ ♪
      </div>
    );
  }
  if (!lines || lines.length === 0) {
    return <CenteredText>no lyrics found</CenteredText>;
  }

  const centerIdx = isSynced
    ? Math.max(0, Math.min(lines.length - 1, activeIndex + offset))
    : Math.max(0, Math.min(lines.length - 1, offset));

  const visibleLines: {
    line: string;
    ms: number;
    visualOffset: number;
    idx: number;
  }[] = [];
  for (let i = centerIdx - VISIBLE_BEFORE; i <= centerIdx + VISIBLE_AFTER; i++) {
    if (i < 0 || i >= lines.length) continue;
    visibleLines.push({
      line: lines[i].text || "—",
      ms: lines[i].ms,
      visualOffset: i - centerIdx,
      idx: i,
    });
  }

  const onLineClick = (idx: number) => {
    if (!isSynced || !syncedLines || !onSeek) return;
    const line = syncedLines[idx];
    if (line) {
      onSeek(line.ms);
      setOffset(0);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-hidden flex flex-col items-start justify-center px-4 select-none"
    >
      {!isSynced && (
        <div
          className="absolute top-1.5 right-2 flex items-center gap-1 text-white/40 text-[9px] uppercase tracking-wider cursor-help"
          title="No synced lyrics found for this track. The open lyrics database (lrclib.net) only has plain text — scroll the wheel to read through them at your own pace."
        >
          <Info size={10} strokeWidth={2.5} />
          <span>not synced</span>
        </div>
      )}
      {visibleLines.map(({ line, visualOffset, idx }) => (
        <motion.div
          key={idx}
          layout
          initial={{ opacity: 0, y: 6 }}
          animate={{
            opacity: opacityFor(visualOffset),
            y: 0,
            scale: visualOffset === 0 ? 1 : 0.93,
          }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => onLineClick(idx)}
          className={`w-full py-0.5 leading-tight ${
            visualOffset === 0
              ? "font-bold text-white text-[17px] tracking-tight"
              : "font-semibold text-white/45 text-[14px]"
          } ${
            isSynced
              ? "cursor-pointer hover:text-white"
              : "cursor-default"
          }`}
          title={isSynced ? "Click to skip to this line" : undefined}
        >
          {line}
        </motion.div>
      ))}
    </div>
  );
}

function CenteredText({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center h-full text-white/40 text-xs">
      {children}
    </div>
  );
}

function opacityFor(offset: number): number {
  if (offset === 0) return 1;
  if (Math.abs(offset) === 1) return 0.55;
  if (Math.abs(offset) === 2) return 0.28;
  return 0.15;
}
