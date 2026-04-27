import "./styles/globals.css";
import { useState } from "react";
import AuthGate from "./components/AuthGate";
import MiniPlayer from "./components/MiniPlayer";

export default function App() {
  const [showLyrics, _setShowLyrics] = useState(true);
  const [aggressiveColors, _setAggressiveColors] = useState(false);

  return (
    <AuthGate>
      <MiniPlayer
        showLyrics={showLyrics}
        aggressiveColors={aggressiveColors}
      />
    </AuthGate>
  );
}
