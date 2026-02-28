import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Gamepad2, Play, Coins, Heart, TrendingUp, ExternalLink } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWalletAuth } from "@/contexts/WalletAuthContext";
import WelcomeOnboardingModal from "@/components/WelcomeOnboardingModal";

interface Game {
  id: string;
  title: string;
  thumbnail: string;
  category: string;
}

interface Video {
  id: string;
  title: string;
  embed_id: string;
  views_count: number;
}

const Index = () => {
  const navigate = useNavigate();
  const { isConnected } = useWalletAuth();
  const isMobile = useIsMobile();
  const [games, setGames] = useState<Game[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // Disable heavy animations on desktop to reduce GPU load
  const enableHeavyAnimations = isMobile;

  useEffect(() => {
    fetchContent();
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchContent = async () => {
    // Fetch games
    const { data: gamesData } = await supabase
      .from("online_games")
      .select("id, title, thumbnail, category")
      .limit(12);
    
    if (gamesData) setGames(gamesData);

    // Fetch videos
    const { data: videosData } = await supabase
      .from("watch_videos")
      .select("id, title, embed_id, views_count")
      .limit(12);
    
    if (videosData) setVideos(videosData);
  };

  const heroSlides = [
    {
      title: "Play to Earn",
      description: "Compete in exciting games and earn AVLO tokens",
      icon: Gamepad2,
      gradient: "from-purple-600/20 via-pink-600/20 to-red-600/20",
    },
    {
      title: "Watch to Earn",
      description: "Watch videos and get rewarded with AVLO",
      icon: Play,
      gradient: "from-blue-600/20 via-purple-600/20 to-pink-600/20",
    },
    {
      title: "Connect & Thrive",
      description: "Join the AvaLove community and start earning",
      icon: Heart,
      gradient: "from-pink-600/20 via-red-600/20 to-orange-600/20",
    },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Welcome onboarding modal for new users */}
      <WelcomeOnboardingModal />
      
      {/* Animated Background Grid - Only animate on mobile */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Games Grid - Left Side */}
        <motion.div
          className="absolute left-0 top-0 w-1/3 h-full grid grid-cols-2 gap-2 p-4 opacity-30"
          animate={enableHeavyAnimations ? { y: [0, -50, 0] } : undefined}
          transition={enableHeavyAnimations ? { duration: 20, repeat: Infinity, ease: "linear" } : undefined}
        >
          {games.slice(0, 6).map((game, index) => (
            <motion.div
              key={game.id}
              className="relative rounded-lg overflow-hidden aspect-video"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.6, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <img
                src={game.thumbnail}
                alt={game.title}
                className={`w-full h-full object-cover ${enableHeavyAnimations ? 'blur-sm' : ''}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </motion.div>
          ))}
        </motion.div>

        {/* Videos Grid - Right Side */}
        <motion.div
          className="absolute right-0 top-0 w-1/3 h-full grid grid-cols-2 gap-2 p-4 opacity-30"
          animate={enableHeavyAnimations ? { y: [0, 50, 0] } : undefined}
          transition={enableHeavyAnimations ? { duration: 25, repeat: Infinity, ease: "linear" } : undefined}
        >
          {videos.slice(0, 6).map((video, index) => (
            <motion.div
              key={video.id}
              className="relative rounded-lg overflow-hidden aspect-video"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.6, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <img
                src={`https://img.youtube.com/vi/${video.embed_id}/mqdefault.jpg`}
                alt={video.title}
                className={`w-full h-full object-cover ${enableHeavyAnimations ? 'blur-sm' : ''}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </motion.div>
          ))}
        </motion.div>

        {/* Center Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-background/80 to-background" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-4xl"
          >
            {/* Icon with Glow - Reduced animation on desktop */}
            <motion.div
              className={`inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br ${heroSlides[currentSlide].gradient} mb-8 relative`}
              animate={enableHeavyAnimations ? {
                boxShadow: [
                  "0 0 20px rgba(168, 85, 247, 0.4)",
                  "0 0 60px rgba(236, 72, 153, 0.6)",
                  "0 0 20px rgba(168, 85, 247, 0.4)",
                ],
              } : undefined}
              transition={enableHeavyAnimations ? { duration: 2, repeat: Infinity } : undefined}
              style={!enableHeavyAnimations ? { boxShadow: "0 0 30px rgba(168, 85, 247, 0.5)" } : undefined}
            >
              {(() => {
                const Icon = heroSlides[currentSlide].icon;
                return <Icon className="w-12 h-12 text-white" />;
              })()}
            </motion.div>

            {/* Main Title - Reduced animation on desktop */}
            <motion.h1
              className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent"
              animate={enableHeavyAnimations ? {
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              } : undefined}
              transition={enableHeavyAnimations ? { duration: 5, repeat: Infinity } : undefined}
              style={{ backgroundSize: "200% 200%" }}
            >
              {heroSlides[currentSlide].title}
            </motion.h1>

            {/* Description */}
            <p className="text-xl md:text-2xl text-foreground/80 mb-12 max-w-2xl mx-auto">
              {heroSlides[currentSlide].description}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isConnected ? (
                <>
                  <Button
                    size="lg"
                    onClick={() => navigate("/mini-games")}
                    className="group relative overflow-hidden bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg px-8 py-6"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <Gamepad2 className="w-5 h-5" />
                      Start Playing
                    </span>
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-pink-600 to-purple-600"
                      initial={{ x: "-100%" }}
                      whileHover={{ x: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => navigate("/connect")}
                    className="text-lg px-8 py-6 border-2 border-purple-600/50 hover:border-purple-600 hover:bg-purple-600/10"
                  >
                    <Heart className="w-5 h-5 mr-2" />
                    Find Matches
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="lg"
                    asChild
                    className="group relative overflow-hidden bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white text-lg px-8 py-6"
                  >
                    <a 
                      href="https://arena.social/app-store/avalove-app" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        <ExternalLink className="w-5 h-5" />
                        Enter The Arena
                      </span>
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-500"
                        initial={{ x: "-100%" }}
                        whileHover={{ x: 0 }}
                        transition={{ duration: 0.3 }}
                      />
                    </a>
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => navigate("/connect")}
                    variant="outline"
                    className="text-lg px-8 py-6 border-2 border-purple-600/50 hover:border-purple-600 hover:bg-purple-600/10"
                  >
                    <span className="flex items-center gap-2">
                      <Coins className="w-5 h-5" />
                      Connect Wallet
                    </span>
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Slide Indicators */}
        <div className="flex gap-2 mt-12">
          {heroSlides.map((_, index) => (
            <motion.button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentSlide
                  ? "bg-purple-600 w-8"
                  : "bg-foreground/30 hover:bg-foreground/50"
              }`}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
            />
          ))}
        </div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-3xl"
        >
          <div className="text-center p-6 rounded-xl bg-gradient-to-br from-purple-600/10 to-transparent border border-purple-600/20">
            <div className="text-3xl font-bold text-purple-400 mb-2">
              {games.length}+
            </div>
            <div className="text-foreground/60">Games Available</div>
          </div>
          <div className="text-center p-6 rounded-xl bg-gradient-to-br from-pink-600/10 to-transparent border border-pink-600/20">
            <div className="text-3xl font-bold text-pink-400 mb-2">
              {videos.length}+
            </div>
            <div className="text-foreground/60">Videos to Watch</div>
          </div>
          <div className="text-center p-6 rounded-xl bg-gradient-to-br from-red-600/10 to-transparent border border-red-600/20">
            <div className="text-3xl font-bold text-red-400 mb-2">
              <TrendingUp className="w-8 h-8 inline" />
            </div>
            <div className="text-foreground/60">Earn AVLO Tokens</div>
          </div>
        </motion.div>
      </div>

      {/* Footer Links */}
      <div className="relative z-10 pb-8 flex justify-center gap-6 text-sm">
        <Button
          onClick={() => navigate('/privacy')}
          variant="outline"
          className="bg-black border-orange-500/50 text-white hover:bg-orange-500/10 hover:border-orange-500"
        >
          Privacy Policy
        </Button>
        <Button
          onClick={() => navigate('/terms')}
          variant="outline"
          className="bg-black border-orange-500/50 text-white hover:bg-orange-500/10 hover:border-orange-500"
        >
          Terms of Service
        </Button>
      </div>

      {/* Floating Elements - Only on mobile */}
      {enableHeavyAnimations && (
        <>
          <motion.div
            className="absolute top-20 left-10 w-20 h-20 bg-purple-600/20 rounded-full blur-xl"
            animate={{
              y: [0, 30, 0],
              x: [0, 20, 0],
            }}
            transition={{ duration: 5, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-20 right-10 w-32 h-32 bg-pink-600/20 rounded-full blur-xl"
            animate={{
              y: [0, -30, 0],
              x: [0, -20, 0],
            }}
            transition={{ duration: 7, repeat: Infinity }}
          />
        </>
      )}
    </div>
  );
};

export default Index;
