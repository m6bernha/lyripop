import { motion } from "framer-motion";
import { useLyrics } from "../hooks/useLyrics";
import type { SpotifyTrack } from "../lib/spotify";

interface Props {
  track: SpotifyTrack | null;
  progressMs: number;
}

const VISIBLE_BEFORE = 1;
const VISIBLE_AFTER = 2;

export default function LyricsCarousel({ track, progressMs }: Props) {
  const { syncedLines, plainLyrics, instrumental, activeIndex, loading } =
    useLyrics(track, progressMs);

  if (!track) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-white/40 text-xs">
        loading lyrics…
      </div>
    );
  }
  if (instrumental) {
    return (
      <div className="flex items-center justify-center py-6 text-white/60 text-sm tracking-widest">
        ♪ ♪ ♪
      </div>
    );
  }

  if (syncedLines && syncedLines.length > 0) {
    const window: { line: string; offset: number; idx: number }[] = [];
    for (
      let i = activeIndex - VISIBLE_BEFORE;
      i <= activeIndex + VISIBLE_AFTER;
      i++
    ) {
      if (i < 0 || i >= syncedLines.length) continue;
      window.push({
        line: syncedLines[i].text || "—",
        offset: i - activeIndex,
        idx: i,
      });
    }

    return (
      <div className="relative h-32 overflow-hidden flex flex-col items-start justify-center px-3 select-none">
        {window.map(({ line, offset, idx }) => (
          <motion.div
            key={idx}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{
              opacity: opacityFor(offset),
              y: 0,
              scale: offset === 0 ? 1.0 : 0.96,
            }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            className={`leading-tight w-full ${
              offset === 0
                ? "font-bold text-white text-base"
                : "text-white/55 text-sm"
            }`}
          >
            {line}
          </motion.div>
        ))}
      </div>
    );
  }

  if (plainLyrics) {
    return (
      <div className="h-32 overflow-y-auto px-3 text-sm text-white/70 whitespace-pre-line leading-snug">
        {plainLyrics}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-6 text-white/40 text-xs">
      no lyrics found
    </div>
  );
}

function opacityFor(offset: number): number {
  switch (offset) {
    case 0:
      return 1;
    case -1:
      return 0.6;
    case 1:
      return 0.6;
    case 2:
      return 0.35;
    default:
      return 0.2;
  }
}
