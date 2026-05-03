import "./styles/globals.css";
import { useEffect, useState } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import AuthGate from "./components/AuthGate";
import MiniPlayer, { type View } from "./components/MiniPlayer";

const VIEW_PREF_KEY = "view";
const MODE_PREF_KEY = "mode";

const COMPACT_WIDTH = 320;
const EXPANDED_WIDTH = 640;
const DEFAULT_HEIGHT_WITH_VIEW = 540;
const DEFAULT_HEIGHT_NO_VIEW = 360;

export type Mode = "compact" | "expanded";

const VALID_VIEWS: View[] = ["lyrics", "queue", "none"];
const VALID_MODES: Mode[] = ["compact", "expanded"];

function readStoredView(): View {
  try {
    const v = localStorage.getItem(VIEW_PREF_KEY);
    if (v && (VALID_VIEWS as string[]).includes(v)) return v as View;
  } catch {
    /* ignore */
  }
  return "lyrics";
}

function readStoredMode(): Mode {
  try {
    const m = localStorage.getItem(MODE_PREF_KEY);
    if (m && (VALID_MODES as string[]).includes(m)) return m as Mode;
  } catch {
    /* ignore */
  }
  return "compact";
}

function sizeFor(mode: Mode, view: View): { width: number; height: number } {
  if (mode === "expanded") {
    return { width: EXPANDED_WIDTH, height: DEFAULT_HEIGHT_WITH_VIEW };
  }
  return {
    width: COMPACT_WIDTH,
    height: view === "none" ? DEFAULT_HEIGHT_NO_VIEW : DEFAULT_HEIGHT_WITH_VIEW,
  };
}

export default function App() {
  const [view, setView] = useState<View>(readStoredView);
  const [mode, setMode] = useState<Mode>(readStoredMode);
  const [aggressiveColors, _setAggressiveColors] = useState(false);

  // Drive the Tauri window size from (mode, view). Persist mode each change.
  useEffect(() => {
    const { width, height } = sizeFor(mode, view);
    getCurrentWindow()
      .setSize(new LogicalSize(width, height))
      .catch(() => {});
    try {
      localStorage.setItem(MODE_PREF_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode, view]);

  const handleSetView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_PREF_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const handleToggleMode = () => {
    setMode((prev) => (prev === "expanded" ? "compact" : "expanded"));
  };

  return (
    <AuthGate>
      <MiniPlayer
        view={view}
        mode={mode}
        aggressiveColors={aggressiveColors}
        onSetView={handleSetView}
        onToggleMode={handleToggleMode}
      />
    </AuthGate>
  );
}
