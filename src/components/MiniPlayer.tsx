import { AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import { useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useSpotify } from "../hooks/useSpotify";
import { pickCoverUrl } from "../lib/spotify";
import AmbientBackground from "./AmbientBackground";
import HoverControls from "./HoverControls";
import LyricsCarousel from "./LyricsCarousel";

interface Props {
  showLyrics: boolean;
  aggressiveColors: boolean;
}

export default function MiniPlayer({ showLyrics, aggressiveColors }: Props) {
  const {
    state,
    liked,
    error,
    togglePlay,
    next,
    previous,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    toggleLiked,
  } = useSpotify();
  const [hovered, setHovered] = useState(false);

  const track = state?.item ?? null;
  const cover = pickCoverUrl(track?.album?.images, 300);

  const onShare = async () => {
    const url = track?.external_urls?.spotify;
    if (!url) return;
    try {
      await writeText(url);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      data-tauri-drag-region
      className="relative w-full h-full flex flex-col rounded-2xl overflow-hidden border border-white/5 shadow-2xl"
    >
      <AmbientBackground coverUrl={cover} aggressive={aggressiveColors} />

      <div
        data-tauri-drag-region
        className="flex items-center gap-3 p-3 min-h-0"
      >
        <div
          className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-black/40 cursor-default"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {cover ? (
            <img
              src={cover}
              alt={track?.album?.name ?? ""}
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full grid place-items-center text-white/40 text-xs">
              no track
            </div>
          )}
          <AnimatePresence>
            {hovered && state && (
              <HoverControls
                state={state}
                onPlayPause={togglePlay}
                onNext={next}
                onPrevious={previous}
                onShuffle={toggleShuffle}
                onRepeat={cycleRepeat}
                onVolume={setVolume}
                onShare={onShare}
              />
            )}
          </AnimatePresence>
        </div>

        <div
          data-tauri-drag-region
          className="flex-1 min-w-0 flex flex-col justify-center"
        >
          <div className="text-[15px] font-semibold text-white truncate leading-tight">
            {track?.name ?? "Nothing playing"}
          </div>
          <div className="text-[12px] text-white/70 truncate mt-0.5">
            {track?.artists?.map((a) => a.name).join(", ") ?? ""}
          </div>
          <div className="text-[11px] text-white/45 truncate mt-0.5">
            {track?.album?.name ?? ""}
          </div>
        </div>

        <button
          onClick={toggleLiked}
          disabled={!track?.id}
          title={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
          className={`shrink-0 grid place-items-center w-8 h-8 rounded-full transition-colors ${
            liked
              ? "text-spotify-green hover:text-spotify-green-bright"
              : "text-white/70 hover:text-white"
          } ${!track?.id ? "opacity-40 cursor-not-allowed" : ""}`}
        >
          <Heart
            size={18}
            strokeWidth={2}
            fill={liked ? "currentColor" : "none"}
          />
        </button>
      </div>

      {showLyrics && (
        <div className="border-t border-white/5">
          <LyricsCarousel track={track} progressMs={state?.progress_ms ?? 0} />
        </div>
      )}

      {error && (
        <div className="absolute bottom-1 left-3 right-3 text-[10px] text-red-300/80 truncate">
          {error}
        </div>
      )}
    </div>
  );
}
