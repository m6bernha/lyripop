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
  Volume2,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { PlaybackState, RepeatState } from "../lib/spotify";

interface Props {
  state: PlaybackState | null;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onVolume: (percent: number) => void;
  onShare: () => void;
}

const repeatLabel: Record<RepeatState, string> = {
  off: "Off",
  context: "Context",
  track: "Track",
};

export default function HoverControls({
  state,
  onPlayPause,
  onNext,
  onPrevious,
  onShuffle,
  onRepeat,
  onVolume,
  onShare,
}: Props) {
  const isPlaying = state?.is_playing ?? false;
  const shuffle = state?.shuffle_state ?? false;
  const repeat = state?.repeat_state ?? "off";
  const volumeFromState = state?.device?.volume_percent ?? 50;
  const [volume, setVolume] = useState(volumeFromState);

  useEffect(() => {
    setVolume(volumeFromState);
  }, [volumeFromState]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md rounded-xl"
      onMouseDown={(e) => e.stopPropagation()}
    >
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
      <div className="absolute bottom-1.5 left-2 right-2 flex items-center gap-2">
        <Volume2 size={11} className="text-white/70 shrink-0" />
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          onMouseUp={() => onVolume(volume)}
          onTouchEnd={() => onVolume(volume)}
          className="flex-1 h-0.5 accent-white cursor-pointer"
        />
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
