import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, Minimize2 } from "lucide-react";
import type { Mode } from "../App";

interface Props {
  mode: Mode;
  visible: boolean;
  onToggle: () => void;
}

export default function ExpandToggle({ mode, visible, onToggle }: Props) {
  const Icon = mode === "expanded" ? Minimize2 : Maximize2;
  const label = mode === "expanded" ? "Compact" : "Expand";

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={onToggle}
          onMouseDown={(e) => e.stopPropagation()}
          title={label}
          aria-label={label}
          className="absolute bottom-2 right-2 z-20 grid place-items-center w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm text-white/85 hover:text-white hover:bg-black/60 transition-colors"
        >
          <Icon size={13} strokeWidth={2.25} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
