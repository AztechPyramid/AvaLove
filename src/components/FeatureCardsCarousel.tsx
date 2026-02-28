import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Compass, 
  MessageCircle, 
  TrendingUp, 
  Trophy, 
  Palette, 
  Gamepad2, 
  PlayCircle, 
  Search 
} from 'lucide-react';

interface FeatureCard {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  route: string;
  gradient: string;
  iconBg: string;
}

const featureCards: FeatureCard[] = [
  {
    title: 'Discover',
    subtitle: 'Find your match',
    icon: <Compass className="w-6 h-6" />,
    route: '/',
    gradient: 'from-pink-500/20 via-rose-500/10 to-transparent',
    iconBg: 'bg-gradient-to-br from-pink-500 to-rose-600'
  },
  {
    title: 'Matches',
    subtitle: 'Chat with matches',
    icon: <MessageCircle className="w-6 h-6" />,
    route: '/matches',
    gradient: 'from-purple-500/20 via-violet-500/10 to-transparent',
    iconBg: 'bg-gradient-to-br from-purple-500 to-violet-600'
  },
  {
    title: 'Staking',
    subtitle: 'Earn rewards',
    icon: <TrendingUp className="w-6 h-6" />,
    route: '/staking',
    gradient: 'from-emerald-500/20 via-green-500/10 to-transparent',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-green-600'
  },
  {
    title: 'Leaderboard',
    subtitle: 'Top players',
    icon: <Trophy className="w-6 h-6" />,
    route: '/reward-tracker',
    gradient: 'from-amber-500/20 via-yellow-500/10 to-transparent',
    iconBg: 'bg-gradient-to-br from-amber-500 to-yellow-600'
  },
  {
    title: 'LoveART',
    subtitle: 'Pixel canvas',
    icon: <Palette className="w-6 h-6" />,
    route: '/loveart',
    gradient: 'from-cyan-500/20 via-blue-500/10 to-transparent',
    iconBg: 'bg-gradient-to-br from-cyan-500 to-blue-600'
  },
  {
    title: 'Games Earn',
    subtitle: 'Play & earn',
    icon: <Gamepad2 className="w-6 h-6" />,
    route: '/mini-games',
    gradient: 'from-blue-500/20 via-indigo-500/10 to-transparent',
    iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600'
  },
  {
    title: 'Watch Earn',
    subtitle: 'Watch & earn',
    icon: <PlayCircle className="w-6 h-6" />,
    route: '/watch-earn',
    gradient: 'from-red-500/20 via-pink-500/10 to-transparent',
    iconBg: 'bg-gradient-to-br from-red-500 to-pink-600'
  },
  {
    title: 'AvaScan',
    subtitle: 'Token explorer',
    icon: <Search className="w-6 h-6" />,
    route: '/avascan',
    gradient: 'from-slate-500/20 via-zinc-500/10 to-transparent',
    iconBg: 'bg-gradient-to-br from-slate-500 to-zinc-600'
  }
];

export const FeatureCardsCarousel = () => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-scroll effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featureCards.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      const cardWidth = 160; // w-40 = 160px
      const gap = 12; // gap-3 = 12px
      scrollRef.current.scrollTo({
        left: currentIndex * (cardWidth + gap),
        behavior: 'smooth'
      });
    }
  }, [currentIndex]);

  return (
    <div className="w-full">
      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {featureCards.map((card, index) => (
          <div
            key={card.route}
            onClick={() => navigate(card.route)}
            className={`
              flex-shrink-0 w-40 snap-start cursor-pointer
              relative overflow-hidden rounded-xl
              bg-gradient-to-br ${card.gradient}
              border border-white/10 backdrop-blur-sm
              hover:border-white/20 hover:scale-105
              transition-all duration-300 ease-out
              group
            `}
          >
            {/* Glow effect */}
            <div className={`absolute -top-10 -right-10 w-24 h-24 ${card.iconBg} opacity-20 blur-2xl group-hover:opacity-40 transition-opacity`} />
            
            <div className="relative p-4">
              {/* Icon */}
              <div className={`${card.iconBg} w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg mb-3`}>
                {card.icon}
              </div>
              
              {/* Text */}
              <h3 className="text-white font-bold text-sm truncate">{card.title}</h3>
              <p className="text-zinc-400 text-xs truncate">{card.subtitle}</p>
            </div>

            {/* Shine effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          </div>
        ))}
      </div>
    </div>
  );
};
