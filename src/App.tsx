import "./styles/globals.css";
import { useEffect, useState } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import AuthGate from "./components/AuthGate";
import MiniPlayer, { type View } from "./components/MiniPlayer";

const VIEW_PREF_KEY = "view";
// 280 cover + 60 info strip + ~160 lyrics/queue (5 visible items) + 40 padding.
const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT_WITH_VIEW = 540;
const DEFAULT_HEIGHT_NO_VIEW = 360;

const VALID_VIEWS: View[] = ["lyrics", "queue", "none"];

function readStoredView(): View {
  try {
    const v = localStorage.getItem(VIEW_PREF_KEY);
    if (v && (VALID_VIEWS as string[]).includes(v)) return v as View;
  } catch {
    /* ignore */
  }
  return "lyrics";
}

function heightFor(view: View): number {
  return view === "none" ? DEFAULT_HEIGHT_NO_VIEW : DEFAULT_HEIGHT_WITH_VIEW;
}

export default function App() {
  const [view, setView] = useState<View>(readStoredView);
  const [aggressiveColors, _setAggressiveColors] = useState(false);

  // Set window height to match the persisted view on launch.
  useEffect(() => {
    getCurrentWindow()
      .setSize(new LogicalSize(DEFAULT_WIDTH, heightFor(view)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSetView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_PREF_KEY, next);
    } catch {
      /* ignore */
    }
    getCurrentWindow()
      .setSize(new LogicalSize(DEFAULT_WIDTH, heightFor(next)))
      .catch(() => {});
  };

  return (
    <AuthGate>
      <MiniPlayer
        view={view}
        aggressiveColors={aggressiveColors}
        onSetView={handleSetView}
      />
    </AuthGate>
  );
}
