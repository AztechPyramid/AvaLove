import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { Heart, Wallet, Loader2, Sparkles, Gamepad2, Tv, Coins, Target, Shield, Globe, ChevronRight, Play, Zap } from 'lucide-react';
import logo from '@/assets/avalove-logo.jpg';
import avloLogo from '@/assets/avlo-logo.jpg';
import arenaLogo from '@/assets/arena-logo.png';
import { motion, useScroll, useTransform } from 'framer-motion';
import { toast } from 'sonner';
import ConnectCaptcha from '@/components/ConnectCaptcha';

import { ArenaArchLogoAnimated } from '@/components/ArenaArchLogo';

export default function Connect() {
  const { isConnected, isVerified, profile, loading, verifyWallet, isArena, refreshProfile, walletAddress } = useWalletAuth();
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(false);
  const [randomUsers] = useState<{id: string; avatar_url: string | null; username: string}[]>([]);
  const [profileCreationAttempted, setProfileCreationAttempted] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [captchaPassed, setCaptchaPassed] = useState(false);
  const MAX_RETRIES = 5;

  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0.3]);
  const heroScale = useTransform(scrollY, [0, 300], [1, 0.95]);

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Hard timeout: never let user be stuck on /connect for more than 12 seconds
  useEffect(() => {
    if (!isArena || !captchaPassed) return;
    const hardTimeout = setTimeout(() => {
      console.warn('[CONNECT] Hard timeout reached — forcing navigation');
      navigate('/', { replace: true });
    }, 12000);
    return () => clearTimeout(hardTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isArena, captchaPassed]);

  // Navigate when profile is ready (only after captcha)
  useEffect(() => {
    if (isArena) {
      if (!captchaPassed) return; // Wait for CAPTCHA
      
      // Arena: navigate INSTANTLY after CAPTCHA — profile loads in background via WalletAuthContext
      if (isConnected && walletAddress) {
        console.log('[CONNECT] Arena CAPTCHA passed, navigating immediately');
        navigate('/', { replace: true });
        return;
      }

      return;
    }

    if (!loading) {
      if (isConnected && isVerified && profile) {
        navigate('/');
      } else if (isConnected && isVerified && !profile) {
        navigate('/profile-setup');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isArena, isConnected, isVerified, profile, loading, navigate, walletAddress, profileCreationAttempted, isCreatingProfile, retryCount]);

  // Removed: 5-second polling and fetchRandomUsers to reduce DB load





  const handleVerifyWallet = async () => {
    setIsVerifying(true);
    try {
      await verifyWallet();
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Failed to verify wallet');
    } finally {
      setIsVerifying(false);
    }
  };




  const features = [
    { icon: Target, label: 'Discover', desc: 'Swipe & Match', gradient: 'from-orange-500 to-amber-500', delay: 0 },
    { icon: Gamepad2, label: 'Games', desc: 'Play & Earn', gradient: 'from-green-500 to-emerald-500', delay: 0.1 },
    { icon: Tv, label: 'Watch', desc: 'View & Earn', gradient: 'from-blue-500 to-cyan-500', delay: 0.2 },
    { icon: Coins, label: 'Staking', desc: 'Lock & Earn', gradient: 'from-yellow-500 to-amber-500', delay: 0.3 },
    { icon: Heart, label: 'LoveArt', desc: 'Create & Earn', gradient: 'from-pink-500 to-rose-500', delay: 0.4 },
  ];

  return (
    <div className="min-h-screen bg-black overflow-x-hidden relative">
      {/* CAPTCHA Gate - show after wallet connected, before profile load */}
      {isArena && isConnected && !captchaPassed && (
        <ConnectCaptcha onPass={() => {
          setCaptchaPassed(true);
          localStorage.setItem('hourly_captcha_passed_at', Date.now().toString());
        }} />
      )}
      {/* Cyber Grid Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Main grid */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(249, 115, 22, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(249, 115, 22, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
        
        {/* Perspective grid floor */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-[50vh] opacity-20"
          style={{
            background: `
              linear-gradient(to top, transparent, black),
              linear-gradient(rgba(249, 115, 22, 0.2) 1px, transparent 1px)
            `,
            backgroundSize: '100% 100%, 40px 40px',
            transform: 'perspective(500px) rotateX(60deg)',
            transformOrigin: 'center bottom',
          }}
        />
        
        {/* Mouse following orb - desktop only */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-[150px] opacity-20 hidden lg:block"
          animate={{
            left: mousePosition.x - 300,
            top: mousePosition.y - 300,
          }}
          transition={{ type: "spring", damping: 30, stiffness: 200 }}
          style={{
            background: `radial-gradient(circle, rgba(249, 115, 22, 0.5), rgba(236, 72, 153, 0.3), transparent 70%)`,
          }}
        />
        
        {/* Floating orbs */}
        <motion.div
          animate={{ 
            y: [0, -30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 left-[10%] w-[200px] md:w-[400px] h-[200px] md:h-[400px] bg-gradient-to-br from-orange-500/20 to-pink-500/10 rounded-full blur-[100px]"
        />
        <motion.div
          animate={{ 
            y: [0, 20, 0],
            scale: [1.1, 1, 1.1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-40 right-[5%] w-[150px] md:w-[350px] h-[150px] md:h-[350px] bg-gradient-to-br from-pink-500/15 to-purple-500/10 rounded-full blur-[80px]"
        />
        <motion.div
          animate={{ 
            x: [-20, 20, -20],
            y: [10, -10, 10],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-gradient-to-br from-orange-500/10 to-transparent rounded-full blur-[120px]"
        />
      </div>

      {/* Connection Status Badge */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="fixed top-3 right-3 md:top-6 md:right-6 z-50"
      >
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/30 to-pink-500/30 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative px-3 py-2 md:px-5 md:py-2.5 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10 hover:border-orange-500/30 transition-all">
            <div className="flex items-center gap-2 md:gap-3">
              {isConnected ? (
                <>
                  <div className="relative">
                    <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-green-400 rounded-full" />
                    <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-50" />
                  </div>
                  <span className="text-[11px] md:text-sm font-medium text-white">Connected</span>
                  <div className="hidden md:flex items-center gap-1.5 pl-2 border-l border-white/10">
                    <img src={arenaLogo} alt="Arena" className="w-4 h-4 rounded-full" />
                    <span className="text-[11px] text-zinc-400">The Arena</span>
                  </div>
                </>
              ) : (
                <>
                  <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin text-orange-400" />
                  <span className="text-[11px] md:text-sm text-zinc-300">Connecting...</span>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <motion.section 
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="min-h-screen flex flex-col items-center justify-center px-4 py-16 md:py-8"
        >
          {/* Logo */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 150, damping: 20 }}
            className="relative mb-6 md:mb-8"
          >
            {/* Multiple glow layers */}
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full blur-3xl opacity-40 scale-150 animate-pulse" />
            <div className="absolute inset-0 bg-orange-500/30 rounded-full blur-2xl scale-125" />
            
            {/* Rotating ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-[-8px] md:inset-[-12px] rounded-full border border-dashed border-orange-500/30"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              className="absolute inset-[-16px] md:inset-[-24px] rounded-full border border-dashed border-pink-500/20"
            />
            
            <img
              src={logo}
              alt="AvaLove"
              className="relative w-28 h-28 md:w-36 lg:w-44 md:h-36 lg:h-44 rounded-full shadow-2xl border-4 border-orange-500/50 hover:border-orange-400 transition-all duration-500"
            />
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-center space-y-3 md:space-y-4 mb-6 md:mb-8"
          >
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-pink-500 to-orange-400 animate-gradient">
                AvaLove
              </span>
            </h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-lg md:text-2xl lg:text-3xl font-bold text-white"
            >
              Built for <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">The Arena</span>
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-center justify-center gap-2 pt-1"
            >
              <img src={avloLogo} alt="AVLO" className="w-5 h-5 md:w-6 md:h-6 rounded-full ring-2 ring-white/10" />
              <span className="text-sm md:text-base text-zinc-400">Powered by <span className="text-white font-semibold">$AVLO</span></span>
            </motion.div>
          </motion.div>

          {/* CTA Button */}
          <motion.a
            href="https://arena.social/app-store/avalove-app"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="relative group mb-8 md:mb-10"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-pink-500 to-orange-500 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-pink-500 rounded-2xl opacity-80" />
            
            <div className="relative flex items-center gap-3 md:gap-4 px-6 py-3.5 md:px-10 md:py-4 rounded-2xl bg-black/50 backdrop-blur-sm border border-white/20 group-hover:border-white/40 transition-all">
              <img src={arenaLogo} alt="Arena" className="w-6 h-6 md:w-7 md:h-7 rounded-full" />
              <span className="font-bold text-base md:text-lg text-white">Enter The Arena</span>
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.a>

          {/* User Avatars */}
          {randomUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mb-8 md:mb-12"
            >
              <div className="flex flex-wrap justify-center gap-1.5 md:gap-2 max-w-md mx-auto">
                {randomUsers.slice(0, 12).map((user, index) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.9 + index * 0.04 }}
                    whileHover={{ scale: 1.2, zIndex: 10 }}
                    className="relative"
                  >
                    <img
                      src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                      alt={user.username}
                      className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-zinc-800 hover:border-orange-500/60 transition-all shadow-lg"
                    />
                  </motion.div>
                ))}
              </div>
              <p className="text-center text-xs md:text-sm text-zinc-500 mt-3">
                Join the community on AvaLove
              </p>
            </motion.div>
          )}

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex flex-col items-center gap-2 text-zinc-500"
            >
              <span className="text-[10px] md:text-xs uppercase tracking-widest">Scroll</span>
              <div className="w-5 h-8 md:w-6 md:h-10 rounded-full border border-zinc-700 flex justify-center pt-2">
                <motion.div
                  animate={{ y: [0, 12, 0], opacity: [1, 0, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-1 h-1 md:w-1.5 md:h-1.5 bg-orange-500 rounded-full"
                />
              </div>
            </motion.div>
          </motion.div>
        </motion.section>




        {/* Arena Branding Section */}
        <section className="py-12 md:py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-col items-center gap-6 md:gap-8"
            >
              {/* Badges */}
              <div className="flex flex-wrap justify-center gap-3 md:gap-4">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center gap-2.5 px-4 py-2.5 md:px-5 md:py-3 rounded-2xl bg-gradient-to-r from-orange-500/10 to-pink-500/10 border border-orange-500/20 backdrop-blur-sm"
                >
                  <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-orange-400" />
                  <span className="text-xs md:text-sm text-white font-medium">Native Arena Experience</span>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center gap-2.5 px-4 py-2.5 md:px-5 md:py-3 rounded-2xl bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 backdrop-blur-sm"
                >
                  <Shield className="w-4 h-4 md:w-5 md:h-5 text-pink-400" />
                  <span className="text-xs md:text-sm text-white font-medium">Secure & Decentralized</span>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center gap-2.5 px-4 py-2.5 md:px-5 md:py-3 rounded-2xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 backdrop-blur-sm"
                >
                  <Zap className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
                  <span className="text-xs md:text-sm text-white font-medium">Earn While You Date</span>
                </motion.div>
              </div>

              {/* Arena Logo */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="mt-4 md:mt-8"
              >
                <ArenaArchLogoAnimated className="scale-75 md:scale-100" />
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Footer spacer */}
        <div className="h-8 md:h-12" />
      </div>
    </div>
  );
}
