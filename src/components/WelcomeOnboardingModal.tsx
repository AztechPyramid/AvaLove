import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Sparkles, Gamepad2, Play, ArrowRight, Zap, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useWalletAuth } from "@/contexts/WalletAuthContext";

const ONBOARDING_KEY = "avalove_onboarding_shown";

interface WelcomeOnboardingModalProps {
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export default function WelcomeOnboardingModal({ 
  externalOpen, 
  onExternalOpenChange 
}: WelcomeOnboardingModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [initialBonus, setInitialBonus] = useState(1);
  const navigate = useNavigate();
  const { profile } = useWalletAuth();

  // Use external control if provided, otherwise use internal state
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = onExternalOpenChange || setInternalOpen;

  useEffect(() => {
    // Only auto-show for new users if not externally controlled
    if (externalOpen !== undefined) return;

    const checkOnboarding = async () => {
      if (!profile?.id) return;

      // Check if user has already seen onboarding
      const shown = localStorage.getItem(`${ONBOARDING_KEY}_${profile.id}`);
      if (shown) return;

      // Fetch initial bonus from config
      const { data } = await supabase
        .from('game_config')
        .select('config_value')
        .eq('config_key', 'score_points')
        .single();

      if (data?.config_value) {
        const config = data.config_value as { initial_bonus?: number };
        setInitialBonus(config.initial_bonus || 1);
      }

      // Small delay for better UX
      setTimeout(() => setInternalOpen(true), 1000);
    };

    checkOnboarding();
  }, [profile?.id, externalOpen]);

  // Fetch initial bonus when externally opened
  useEffect(() => {
    if (externalOpen) {
      const fetchBonus = async () => {
        const { data } = await supabase
          .from('game_config')
          .select('config_value')
          .eq('config_key', 'score_points')
          .single();

        if (data?.config_value) {
          const config = data.config_value as { initial_bonus?: number };
          setInitialBonus(config.initial_bonus || 1);
        }
      };
      fetchBonus();
    }
  }, [externalOpen]);

  const handleClose = () => {
    if (profile?.id && externalOpen === undefined) {
      localStorage.setItem(`${ONBOARDING_KEY}_${profile.id}`, "true");
    }
    setIsOpen(false);
  };

  const handleNavigate = (path: string) => {
    handleClose();
    navigate(path);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden !bg-black bg-gradient-to-br from-black via-black to-primary/20 border border-primary/30 [&>button]:bg-black [&>button]:border [&>button]:border-white/20">
        {/* Animated background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-secondary/20 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwRkZGRjEwIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />
        </div>

        <div className="relative z-10 p-6 space-y-6">
          {/* Header with animated icon */}
          <motion.div 
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 0.8 }}
            className="flex justify-center"
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/50">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"
              >
                <Zap className="w-3 h-3 text-white" />
              </motion.div>
            </div>
          </motion.div>

          {/* Welcome text */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center space-y-2"
          >
            <h2 className="text-2xl font-bold text-white">
              Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Avalove</span>
            </h2>
            <p className="text-white/70 text-sm">
              Your journey to earn rewards begins now
            </p>
          </motion.div>

          {/* Initial bonus display */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/40 rounded-xl p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/30 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-white/60 text-xs uppercase tracking-wider">Initial Bonus</p>
                  <p className="text-white font-bold text-lg">You earned</p>
                </div>
              </div>
              <div className="text-right">
                <motion.p 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.7, type: "spring" }}
                  className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary"
                >
                  {initialBonus}
                </motion.p>
                <p className="text-white/60 text-xs">SCORE POINTS</p>
              </div>
            </div>
          </motion.div>

          {/* Action cards */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="space-y-3"
          >
            <p className="text-white/80 text-sm text-center mb-4">
              Use your score to unlock earning features:
            </p>

            {/* Watch to Earn */}
            <button
              onClick={() => handleNavigate("/watch-earn")}
              className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 p-4 text-left transition-all hover:border-purple-500/60 hover:shadow-lg hover:shadow-purple-500/20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Watch to Earn</p>
                    <p className="text-white/50 text-xs">Earn AVLO by watching videos</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Games to Earn */}
            <button
              onClick={() => handleNavigate("/mini-games")}
              className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 p-4 text-left transition-all hover:border-cyan-500/60 hover:shadow-lg hover:shadow-cyan-500/20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Gamepad2 className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Play to Earn</p>
                    <p className="text-white/50 text-xs">Earn AVLO by playing games</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </motion.div>

          {/* Pro tips */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-2"
          >
            <p className="text-white/70 text-xs text-center">
              💡 <span className="text-white font-medium">Pro tip:</span> Swipe right on profiles in Discover to earn more score points and unlock matches!
            </p>
          </motion.div>

          {/* Skip button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <Button
              variant="ghost"
              onClick={handleClose}
              className="w-full text-white/50 hover:text-white hover:bg-white/10"
            >
              Got it, let's go!
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
