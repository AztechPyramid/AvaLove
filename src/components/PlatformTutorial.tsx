import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, 
  Heart, 
  X, 
  Flame, 
  Trophy, 
  Coins, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Gift, 
  Users, 
  Target,
  ChevronLeft,
  ChevronRight,
  Trash2,
  MessageSquare,
  Star
} from 'lucide-react';

interface TutorialSlide {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  gradient: string;
}

const TutorialSlides: TutorialSlide[] = [
  {
    title: "SCORE SYSTEM",
    subtitle: "Your Reputation Currency",
    icon: <Trophy className="w-12 h-12" />,
    gradient: "from-amber-500 via-orange-500 to-red-500",
    content: (
      <div className="space-y-6">
        <p className="text-zinc-300 text-center text-sm">
          Your Score reflects your activity and reputation on AvaLove. Higher scores unlock exclusive features and visibility.
        </p>
        
        <div className="grid grid-cols-2 gap-4">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-bold text-sm">GAIN SCORE</span>
            </div>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2 text-zinc-300">
                <Heart className="w-3.5 h-3.5 text-green-400" fill="currentColor" />
                <span>Right swipe (like)</span>
              </li>
              <li className="flex items-center gap-2 text-zinc-300">
                <Users className="w-3.5 h-3.5 text-green-400" />
                <span>Match with someone</span>
              </li>
              <li className="flex items-center gap-2 text-zinc-300">
                <Gift className="w-3.5 h-3.5 text-green-400" />
                <span>Gift tokens</span>
              </li>
              <li className="flex items-center gap-2 text-zinc-300">
                <Flame className="w-3.5 h-3.5 text-green-400" />
                <span>Burn mode swipes</span>
              </li>
            </ul>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-red-500/20 to-pink-500/10 border border-red-500/30 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-5 h-5 text-red-400" />
              <span className="text-red-400 font-bold text-sm">LOSE SCORE</span>
            </div>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2 text-zinc-300">
                <X className="w-3.5 h-3.5 text-red-400" />
                <span>Left swipe (pass)</span>
              </li>
              <li className="flex items-center gap-2 text-zinc-300">
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Delete a match</span>
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    )
  },
  {
    title: "SWIPE MECHANICS",
    subtitle: "Token-Powered Interactions",
    icon: <Heart className="w-12 h-12" />,
    gradient: "from-pink-500 via-rose-500 to-red-500",
    content: (
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center p-3 bg-gradient-to-b from-red-500/20 to-transparent border border-red-500/30 rounded-xl"
          >
            <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400 font-bold text-xs">LEFT</p>
            <p className="text-zinc-400 text-[10px] mt-1">Pass</p>
            <div className="mt-2 text-red-400 text-xs font-mono">-SCORE</div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center p-3 bg-gradient-to-b from-green-500/20 to-transparent border border-green-500/30 rounded-xl"
          >
            <Heart className="w-8 h-8 text-green-400 mx-auto mb-2" fill="currentColor" />
            <p className="text-green-400 font-bold text-xs">RIGHT</p>
            <p className="text-zinc-400 text-[10px] mt-1">Like</p>
            <div className="mt-2 text-green-400 text-xs font-mono">+SCORE</div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center p-3 bg-gradient-to-b from-orange-500/20 to-transparent border border-orange-500/30 rounded-xl"
          >
            <Users className="w-8 h-8 text-orange-400 mx-auto mb-2" />
            <p className="text-orange-400 font-bold text-xs">MATCH</p>
            <p className="text-zinc-400 text-[10px] mt-1">Mutual Like</p>
            <div className="mt-2 text-orange-400 text-xs font-mono">+SCORE</div>
          </motion.div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700"
        >
          <h4 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            SWIPE MODES
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300 flex items-center gap-2">
                <Gift className="w-3.5 h-3.5 text-green-400" /> Gift Mode
              </span>
              <span className="text-green-400">Tokens → User</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-300 flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-orange-400" /> Burn Mode
              </span>
              <span className="text-orange-400">Tokens → Burned 🔥</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-300 flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-cyan-400" /> Team Mode
              </span>
              <span className="text-cyan-400">Tokens → Team</span>
            </div>
          </div>
        </motion.div>
      </div>
    )
  },
  {
    title: "AVLO CREDITS",
    subtitle: "Earn & Spend Your Way",
    icon: <Coins className="w-12 h-12" />,
    gradient: "from-yellow-500 via-amber-500 to-orange-500",
    content: (
      <div className="space-y-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/30 rounded-xl p-4"
        >
          <h4 className="text-green-400 font-bold text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            EARN CREDITS
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="text-green-400">🎮</span> Play Games
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="text-green-400">📺</span> Watch Videos
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="text-green-400">🤝</span> Peer Payments
            </div>
          </div>
          <p className="text-zinc-400 text-[10px] mt-3 leading-relaxed">
            💡 Users can pay each other's rewards. Spend your earned rewards as AVLO credits!
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-red-500/10 to-pink-500/5 border border-red-500/30 rounded-xl p-4"
        >
          <h4 className="text-red-400 font-bold text-sm mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            SPEND CREDITS
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="text-red-400">💬</span> Send Messages
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="text-red-400">📝</span> Create Posts
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="text-red-400">🎁</span> Gift Tokens
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="text-red-400">🔥</span> Burn Tokens
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="text-red-400">⚡</span> Boost Profile
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="text-red-400">🤖</span> LoveBot AI
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="text-red-400">💭</span> Post Comments
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="text-red-400">🎨</span> LoveArt Pixels
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700"
        >
          <p className="text-zinc-300 text-[10px] text-center leading-relaxed">
            💰 Rewards are paid weekly/monthly in AVLO from the team's collected swipe funds.
          </p>
        </motion.div>
      </div>
    )
  },
  {
    title: "STAKING POOLS",
    subtitle: "Community-Powered Rewards",
    icon: <Star className="w-12 h-12" />,
    gradient: "from-purple-500 via-violet-500 to-indigo-500",
    content: (
      <div className="space-y-4">
        <p className="text-zinc-300 text-center text-sm">
          Stake tokens in community pools to earn rewards and support your favorite creators.
        </p>
        
        <div className="space-y-3">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3 bg-zinc-800/50 rounded-xl p-3 border border-purple-500/30"
          >
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Coins className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">Stake & Earn</p>
              <p className="text-zinc-400 text-xs">Lock tokens to receive passive rewards</p>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3 bg-zinc-800/50 rounded-xl p-3 border border-cyan-500/30"
          >
            <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">Pool Chat Access</p>
              <p className="text-zinc-400 text-xs">Join exclusive community discussions</p>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-3 bg-zinc-800/50 rounded-xl p-3 border border-amber-500/30"
          >
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">Leaderboard Ranking</p>
              <p className="text-zinc-400 text-xs">Compete for top staker positions</p>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }
];
export const PlatformTutorial = ({ children }: { children?: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % TutorialSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + TutorialSlides.length) % TutorialSlides.length);
  };

  const slide = TutorialSlides[currentSlide];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 hover:bg-zinc-800 flex items-center gap-1.5 group"
          >
            <BookOpen className="w-4 h-4 text-amber-400 group-hover:text-amber-300 transition-colors" />
            <span className="text-xs text-zinc-400 group-hover:text-white transition-colors hidden sm:inline">Guide</span>
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-700 p-0 overflow-hidden">
        <div className="relative">
          {/* Header with gradient */}
          <div className={`bg-gradient-to-r ${slide.gradient} p-6 pb-12`}>
            <div className="flex items-center justify-center mb-3">
              <motion.div 
                key={currentSlide}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-white/90"
              >
                {slide.icon}
              </motion.div>
            </div>
            <motion.h2 
              key={`title-${currentSlide}`}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-white font-black text-2xl text-center tracking-tight"
            >
              {slide.title}
            </motion.h2>
            <motion.p 
              key={`subtitle-${currentSlide}`}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-white/80 text-sm text-center mt-1"
            >
              {slide.subtitle}
            </motion.p>
          </div>
          
          {/* Content */}
          <div className="p-5 -mt-6 relative">
            <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-700 min-h-[280px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {slide.content}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          
          {/* Navigation */}
          <div className="px-5 pb-5">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={prevSlide}
                className="text-zinc-400 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              
              {/* Dots */}
              <div className="flex gap-1.5">
                {TutorialSlides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === currentSlide 
                        ? 'bg-white w-4' 
                        : 'bg-zinc-600 hover:bg-zinc-500'
                    }`}
                  />
                ))}
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={nextSlide}
                className="text-zinc-400 hover:text-white"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Inline Tutorial Card for Discover empty state
export const TutorialCard = () => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  return (
    <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 p-4 border-b border-zinc-700">
        <div className="flex items-center justify-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-400" />
          <h3 className="text-white font-bold">Platform Guide</h3>
        </div>
        <p className="text-zinc-400 text-xs text-center mt-1">Master the AvaLove ecosystem</p>
      </div>
      
      <div className="p-4 space-y-3">
        {/* Score Section */}
        <motion.button
          onClick={() => setExpandedSection(expandedSection === 'score' ? null : 'score')}
          className="w-full bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-amber-500/30 rounded-xl p-3 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">Score System</p>
              <p className="text-zinc-400 text-xs">Build your reputation</p>
            </div>
            <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${expandedSection === 'score' ? 'rotate-90' : ''}`} />
          </div>
          
          <AnimatePresence>
            {expandedSection === 'score' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-zinc-700 grid grid-cols-2 gap-2 text-xs">
                  <div className="text-green-400">✓ Right swipe → +Score</div>
                  <div className="text-green-400">✓ Match → +Score</div>
                  <div className="text-red-400">✗ Left swipe → -Score</div>
                  <div className="text-red-400">✗ Delete match → -Score</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
        
        {/* Credits Section */}
        <motion.button
          onClick={() => setExpandedSection(expandedSection === 'credits' ? null : 'credits')}
          className="w-full bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-yellow-500/30 rounded-xl p-3 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">AVLO Credits</p>
              <p className="text-zinc-400 text-xs">Earn & spend tokens</p>
            </div>
            <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${expandedSection === 'credits' ? 'rotate-90' : ''}`} />
          </div>
          
          <AnimatePresence>
            {expandedSection === 'credits' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-zinc-700 space-y-2 text-xs">
                  <p className="text-green-400 font-medium">💰 Earn:</p>
                  <p className="text-zinc-400 pl-4">Games • Videos • Peer Payments</p>
                  <p className="text-red-400 font-medium">💸 Spend:</p>
                  <p className="text-zinc-400 pl-4">Messages • Posts • Gifts • Boosts • AI</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
        
        {/* Swipe Modes Section */}
        <motion.button
          onClick={() => setExpandedSection(expandedSection === 'swipe' ? null : 'swipe')}
          className="w-full bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-pink-500/30 rounded-xl p-3 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" fill="currentColor" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">Swipe Modes</p>
              <p className="text-zinc-400 text-xs">Gift • Burn • Team</p>
            </div>
            <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${expandedSection === 'swipe' ? 'rotate-90' : ''}`} />
          </div>
          
          <AnimatePresence>
            {expandedSection === 'swipe' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-zinc-700 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Gift className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-zinc-300">Gift → Tokens go to user</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-zinc-300">Burn → Tokens destroyed 🔥</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-zinc-300">Team → Support development</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
        
        {/* Full Tutorial Button */}
        <PlatformTutorial>
          <button className="w-full mt-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30 rounded-xl p-3 text-center transition-all group">
            <span className="text-amber-400 font-bold text-sm group-hover:text-amber-300">
              View Full Tutorial →
            </span>
          </button>
        </PlatformTutorial>
      </div>
    </div>
  );
};
