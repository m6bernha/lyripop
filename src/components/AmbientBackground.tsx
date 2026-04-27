import { AnimatePresence, motion } from "framer-motion";
import { useAlbumColor } from "../hooks/useAlbumColor";

interface Props {
  coverUrl: string | null;
  aggressive: boolean;
}

export default function AmbientBackground({ coverUrl, aggressive }: Props) {
  const palette = useAlbumColor(coverUrl, aggressive);
  const key = `${coverUrl ?? "none"}|${aggressive}`;

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden rounded-2xl">
      <AnimatePresence>
        <motion.div
          key={key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 0% 0%, ${palette.vibrant}cc 0%, transparent 55%),
              radial-gradient(circle at 100% 100%, ${palette.darkVibrant}aa 0%, transparent 60%),
              linear-gradient(135deg, ${palette.darkMuted} 0%, ${palette.darkVibrant} 100%)
            `,
          }}
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
    </div>
  );
}
