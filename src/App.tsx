import "./styles/globals.css";

export default function App() {
  return (
    <div
      data-tauri-drag-region
      className="w-full h-full rounded-2xl bg-spotify-card/90 border border-white/5 backdrop-blur-xl flex items-center justify-center text-spotify-text-subdued text-sm overflow-hidden shadow-2xl"
    >
      <span data-tauri-drag-region className="pointer-events-none">
        Spotify widget — phase 1 shell
      </span>
    </div>
  );
}
