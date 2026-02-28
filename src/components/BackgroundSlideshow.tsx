import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Import actual screenshots
import discoverImg from '@/assets/screenshots/discover.png';
import matchesImg from '@/assets/screenshots/matches.png';
import postsImg from '@/assets/screenshots/posts.png';
import stakingImg from '@/assets/screenshots/staking.png';
import leaderboardImg from '@/assets/screenshots/leaderboard.png';
import loveartImg from '@/assets/screenshots/loveart.png';
import gamesImg from '@/assets/screenshots/games.png';
import watchImg from '@/assets/screenshots/watch.png';
import rewardImg from '@/assets/screenshots/reward.png';

const slides = [
  { id: 1, label: 'Discover', image: discoverImg },
  { id: 2, label: 'Matches', image: matchesImg },
  { id: 3, label: 'Posts', image: postsImg },
  { id: 4, label: 'Staking', image: stakingImg },
  { id: 5, label: 'Leaderboard', image: leaderboardImg },
  { id: 6, label: 'LoveArt', image: loveartImg },
  { id: 7, label: 'Games', image: gamesImg },
  { id: 8, label: 'Watch', image: watchImg },
  { id: 9, label: 'Rewards', image: rewardImg },
];

// Desktop monitor frame
const DesktopFrame = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative">
      {/* Monitor frame */}
      <div className="w-[600px] md:w-[900px] lg:w-[1100px] bg-zinc-800/80 rounded-t-xl p-2 border border-zinc-700/50">
        {/* Screen bezel dots */}
        <div className="absolute top-2 left-4 flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500/60" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
          <div className="w-2 h-2 rounded-full bg-green-500/60" />
        </div>
        {/* Screen */}
        <div className="bg-black/50 rounded-lg overflow-hidden aspect-[16/9]">
          {children}
        </div>
      </div>
      {/* Monitor stand */}
      <div className="flex flex-col items-center">
        <div className="w-20 h-10 bg-zinc-700/60 border-x border-zinc-600/30" />
        <div className="w-40 h-3 bg-zinc-600/60 rounded-b-xl" />
      </div>
    </div>
  );
};

export const BackgroundSlideshow = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const currentSlide = slides[currentIndex];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 80 }}
          animate={{ opacity: 0.35, x: 0 }}
          exit={{ opacity: 0, x: -80 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="relative"
        >
          <DesktopFrame>
            <img 
              src={currentSlide.image} 
              alt={currentSlide.label}
              className="w-full h-full object-cover object-top opacity-90"
            />
          </DesktopFrame>
        </motion.div>
      </AnimatePresence>

      {/* Page label */}
      <motion.div
        key={`label-${currentIndex}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="absolute bottom-16 left-1/2 -translate-x-1/2"
      >
        <span className="text-xs text-white/50 font-medium tracking-widest uppercase bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm">
          {currentSlide.label}
        </span>
      </motion.div>

      {/* Slide indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === currentIndex ? 'bg-orange-500 w-6' : 'bg-white/20 w-1.5'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
