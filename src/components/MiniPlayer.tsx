import { AnimatePresence } from "framer-motion";
import { Heart, ListMusic, Mic2, X } from "lucide-react";
import { useCallback, useContext, useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Mode } from "../App";
import { useSpotify } from "../hooks/useSpotify";
import { pickCoverUrl } from "../lib/spotify";
import AmbientBackground from "./AmbientBackground";
import { AuthContext } from "./AuthGate";
import ExpandToggle from "./ExpandToggle";
import HoverControls from "./HoverControls";
import LyricsCarousel from "./LyricsCarousel";
import QueuePanel from "./QueuePanel";

export type View = "lyrics" | "queue" | "none";

interface Props {
  view: View;
  mode: Mode;
  aggressiveColors: boolean;
  onSetView: (v: View) => void;
  onToggleMode: () => void;
}

export default function MiniPlayer({
  view,
  mode,
  aggressiveColors,
  onSetView,
  onToggleMode,
}: Props) {
  const auth = useContext(AuthContext);
  // Wrap forceReauth in a stable callback so useSpotify's ref pattern stays
  // referentially equal across re-renders. AuthContext is non-null inside
  // AuthGate's "ready" branch, but we guard defensively in case MiniPlayer
  // ever ships outside that subtree.
  const onAuthFailure = useCallback(() => {
    void auth?.forceReauth();
  }, [auth]);
  const {
    state,
    liked,
    error,
    client,
    togglePlay,
    next,
    previous,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    toggleLiked,
    seek,
  } = useSpotify({ onAuthFailure });
  const [hovered, setHovered] = useState(false);
  const [widgetHovered, setWidgetHovered] = useState(false);

  const track = state?.item ?? null;
  const cover = pickCoverUrl(track?.album?.images, "largest");
  const isExpanded = mode === "expanded";

  const onShare = async () => {
    const url = track?.external_urls?.spotify;
    if (!url) return;
    try {
      await writeText(url);
    } catch {
      /* ignore */
    }
  };

  const onClose = async () => {
    try {
      await getCurrentWindow().hide();
    } catch {
      /* ignore */
    }
  };

  const onToggleLyrics = () => onSetView(view === "lyrics" ? "none" : "lyrics");
  const onToggleQueue = () => onSetView(view === "queue" ? "none" : "queue");

  return (
    <div
      data-tauri-drag-region
      onMouseEnter={() => setWidgetHovered(true)}
      onMouseLeave={() => setWidgetHovered(false)}
      className="relative w-full h-full flex flex-col rounded-2xl overflow-hidden border border-white/5 shadow-2xl"
    >
      <AmbientBackground coverUrl={cover} aggressive={aggressiveColors} />

      {/* Cover area (top, dominant) */}
      <div
        data-tauri-drag-region
        className="relative px-4 pt-4 pb-2 flex items-center justify-center"
      >
        <div
          className="relative aspect-square w-full max-w-[280px] rounded-xl overflow-hidden bg-black/40 shadow-xl"
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
                onSeek={seek}
                onShare={onShare}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Info strip */}
      <div
        data-tauri-drag-region
        className="relative px-4 py-2 flex items-center gap-1"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-white truncate leading-tight">
            {track?.name ?? "Nothing playing"}
          </div>
          <div className="text-[12px] text-white/65 truncate mt-0.5">
            {track?.artists?.map((a) => a.name).join(", ") ?? ""}
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
          <Heart size={18} strokeWidth={2} fill={liked ? "currentColor" : "none"} />
        </button>

        {!isExpanded && (
          <>
            <button
              onClick={onToggleLyrics}
              title={view === "lyrics" ? "Hide lyrics" : "Show lyrics"}
              className={`shrink-0 grid place-items-center w-8 h-8 rounded-full transition-colors ${
                view === "lyrics"
                  ? "text-spotify-green hover:text-spotify-green-bright"
                  : "text-white/70 hover:text-white"
              }`}
            >
              <Mic2 size={16} strokeWidth={2} />
            </button>

            <button
              onClick={onToggleQueue}
              title={view === "queue" ? "Hide queue" : "Show queue"}
              className={`shrink-0 grid place-items-center w-8 h-8 rounded-full transition-colors ${
                view === "queue"
                  ? "text-spotify-green hover:text-spotify-green-bright"
                  : "text-white/70 hover:text-white"
              }`}
            >
              <ListMusic size={16} strokeWidth={2} />
            </button>
          </>
        )}

        <button
          onClick={onClose}
          title="Hide widget"
          className="shrink-0 grid place-items-center w-8 h-8 rounded-full text-white/70 hover:text-white transition-colors"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Bottom view: compact = single panel toggle, expanded = both side-by-side */}
      {isExpanded ? (
        <div className="relative flex-1 min-h-0 flex flex-row border-t border-white/5">
          <div className="relative flex-1 min-w-0">
            <LyricsCarousel
              track={track}
              progressMs={state?.progress_ms ?? 0}
              onSeek={seek}
            />
          </div>
          <div className="relative flex-1 min-w-0 border-l border-white/5">
            <QueuePanel client={client} trackId={track?.id ?? null} />
          </div>
        </div>
      ) : (
        <>
          {view === "lyrics" && (
            <div className="relative flex-1 min-h-0 border-t border-white/5">
              <LyricsCarousel
                track={track}
                progressMs={state?.progress_ms ?? 0}
                onSeek={seek}
              />
            </div>
          )}
          {view === "queue" && (
            <div className="relative flex-1 min-h-0 border-t border-white/5">
              <QueuePanel client={client} trackId={track?.id ?? null} />
            </div>
          )}
        </>
      )}

      {error && (
        <div className="absolute bottom-1 left-3 right-3 text-[10px] text-red-300/80 truncate">
          {error}
        </div>
      )}

      <ExpandToggle mode={mode} visible={widgetHovered} onToggle={onToggleMode} />
    </div>
  );
}
