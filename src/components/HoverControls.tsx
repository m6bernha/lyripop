import { motion } from "framer-motion";
import {
  Pause,
  Play,
  Repeat,
  Repeat1,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PlaybackState, RepeatState } from "../lib/spotify";

interface Props {
  state: PlaybackState | null;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onVolume: (percent: number) => void;
  onSeek: (ms: number) => void;
  onShare: () => void;
}

const repeatLabel: Record<RepeatState, string> = {
  off: "Off",
  context: "Context",
  track: "Track",
};

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function HoverControls({
  state,
  onPlayPause,
  onNext,
  onPrevious,
  onShuffle,
  onRepeat,
  onVolume,
  onSeek,
  onShare,
}: Props) {
  const isPlaying = state?.is_playing ?? false;
  const shuffle = state?.shuffle_state ?? false;
  const repeat = state?.repeat_state ?? "off";
  const duration = state?.item?.duration_ms ?? 0;
  const progress = state?.progress_ms ?? 0;
  const volumeFromState = state?.device?.volume_percent ?? 50;

  // Local scrubber state — while dragging, ignore the polled progress so the
  // thumb doesn't jitter back to the live position.
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(progress);
  const displayProgress = scrubbing ? scrubValue : progress;

  // Volume popover + local volume slider state.
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [localVolume, setLocalVolume] = useState(volumeFromState);
  const volumeWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!volumeOpen) setLocalVolume(volumeFromState);
  }, [volumeFromState, volumeOpen]);

  // Click outside the popover closes it.
  useEffect(() => {
    if (!volumeOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (
        volumeWrapRef.current &&
        !volumeWrapRef.current.contains(e.target as Node)
      ) {
        setVolumeOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [volumeOpen]);

  const VolumeIcon =
    localVolume === 0 ? VolumeX : localVolume < 50 ? Volume1 : Volume2;

  const commitScrub = () => {
    if (scrubbing) {
      onSeek(scrubValue);
      setScrubbing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md rounded-xl"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Top playback row */}
      <div className="flex items-center gap-1 text-white">
        <IconButton
          onClick={onShuffle}
          active={shuffle}
          title={`Shuffle: ${shuffle ? "On" : "Off"}`}
        >
          <Shuffle size={14} strokeWidth={2.25} />
        </IconButton>
        <IconButton onClick={onPrevious} title="Previous">
          <SkipBack size={16} strokeWidth={2.25} fill="currentColor" />
        </IconButton>
        <button
          onClick={onPlayPause}
          title={isPlaying ? "Pause" : "Play"}
          className="grid place-items-center w-9 h-9 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-transform"
        >
          {isPlaying ? (
            <Pause size={16} strokeWidth={2.25} fill="currentColor" />
          ) : (
            <Play size={16} strokeWidth={2.25} fill="currentColor" />
          )}
        </button>
        <IconButton onClick={onNext} title="Next">
          <SkipForward size={16} strokeWidth={2.25} fill="currentColor" />
        </IconButton>
        <IconButton
          onClick={onRepeat}
          active={repeat !== "off"}
          title={`Repeat: ${repeatLabel[repeat]}`}
        >
          {repeat === "track" ? (
            <Repeat1 size={14} strokeWidth={2.25} />
          ) : (
            <Repeat size={14} strokeWidth={2.25} />
          )}
        </IconButton>
      </div>

      {/* Bottom strip: scrubber + volume + share */}
      <div className="absolute bottom-1.5 left-2 right-2 flex items-center gap-2">
        <span className="text-white/70 text-[9px] tabular-nums shrink-0 min-w-[26px] text-right">
          {formatTime(displayProgress)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 1}
          value={Math.min(displayProgress, duration || 1)}
          onChange={(e) => {
            setScrubbing(true);
            setScrubValue(Number(e.target.value));
          }}
          onMouseUp={commitScrub}
          onTouchEnd={commitScrub}
          onKeyUp={commitScrub}
          className="flex-1 h-0.5 accent-white cursor-pointer"
          title="Seek"
        />
        <span className="text-white/70 text-[9px] tabular-nums shrink-0 min-w-[26px]">
          {formatTime(duration)}
        </span>

        {/* Volume button + popover */}
        <div ref={volumeWrapRef} className="relative shrink-0">
          <button
            onClick={() => setVolumeOpen((v) => !v)}
            title={`Volume: ${localVolume}%`}
            className={`grid place-items-center w-5 h-5 transition-colors ${
              volumeOpen ? "text-white" : "text-white/85 hover:text-white"
            }`}
          >
            <VolumeIcon size={12} strokeWidth={2.25} />
          </button>
          {volumeOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full right-0 mb-1.5 px-2 py-1.5 bg-black/90 border border-white/10 rounded-md shadow-xl"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <input
                type="range"
                min={0}
                max={100}
                value={localVolume}
                onChange={(e) => setLocalVolume(Number(e.target.value))}
                onMouseUp={() => onVolume(localVolume)}
                onTouchEnd={() => onVolume(localVolume)}
                onKeyUp={() => onVolume(localVolume)}
                className="w-[90px] h-0.5 accent-white cursor-pointer"
                title={`${localVolume}%`}
              />
            </motion.div>
          )}
        </div>

        <button
          onClick={onShare}
          title="Copy track link"
          className="text-white/70 hover:text-white shrink-0 transition-colors"
        >
          <Share2 size={11} strokeWidth={2.25} />
        </button>
      </div>
    </motion.div>
  );
}

interface IconButtonProps {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}

function IconButton({ onClick, title, active, children }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`grid place-items-center w-7 h-7 rounded-full transition-colors ${
        active
          ? "text-spotify-green hover:text-spotify-green-bright"
          : "text-white/85 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
