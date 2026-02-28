import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Heart, X, User, Users, Gift, Flame, Building2, Coins, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { WalletAddress } from '@/components/WalletAddress';
import { TipDialog } from '@/components/TipDialog';
import { useStakingInfo } from '@/hooks/useStakingInfo';
import { useFollowers } from '@/hooks/useFollowers';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { useNavigate } from 'react-router-dom';
import { UserBadges } from '@/components/UserBadges';
import { getAvatarUrl } from '@/lib/defaultAvatars';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import arenaLogo from '@/assets/arena-logo.png';
import avloLogo from '@/assets/avlo-logo.jpg';
import { UserStatsPopup } from '@/components/UserStatsPopup';
import { BoostProfileButton } from '@/components/discover/BoostProfileButton';
import { ProfileBoostInfo } from '@/components/discover/ProfileBoostInfo';
import { useIsMobile } from '@/hooks/use-mobile';
import { useProfileSwipeRevenue } from '@/hooks/useProfileSwipeRevenue';

// Featured staking pool type (random approved pool)
interface FeaturedPool {
  id: string;
  title: string;
  stake_token_logo: string | null;
}
interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  photo_urls: string[] | null;
  bio: string | null;
  gender: string;
  location: string | null;
  interests: string[] | null;
  date_of_birth: string | null;
  wallet_address: string | null;
  twitter_username?: string | null;
  instagram_username?: string | null;
  linkedin_username?: string | null;
  arena_username?: string | null;
  arena_verified?: boolean | null;
  distance?: number;
  special_badge?: boolean | null;
  swipe_boost_amount?: number | null;
  swipe_boosted_at?: string | null;
}

interface PaymentTokenInfo {
  token_symbol: string;
  token_logo_url: string | null;
}

// Swipe mode types: gift, burn, team
type SwipeMode = 'gift' | 'burn' | 'team';

interface SwipeModeInfo {
  mode: SwipeMode;
  tokenSymbol: string;
  tokenLogo: string | null;
  swipePrice?: number; // Token amount for swipe
  priceUsd?: number; // Token price in USD
}

interface SwipeCardProps {
  profile: Profile;
  onSwipe: (direction: 'left' | 'right') => void;
  canSwipeRight?: boolean;
  selectedPaymentToken?: PaymentTokenInfo | null;
  swipeModeInfo?: SwipeModeInfo | null;
}

export const SwipeCard = ({ profile, onSwipe, canSwipeRight = true, selectedPaymentToken, swipeModeInfo }: SwipeCardProps) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-30, 30]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);
  const { totalStaked, pendingRewards, loading: stakingLoading } = useStakingInfo(profile.id);
  const { profile: currentUserProfile } = useWalletAuth();
  const { followersCount, isFollowing, toggleFollow } = useFollowers(profile.id, currentUserProfile?.id);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // Swipe statistics
  const [swipeStats, setSwipeStats] = useState({ likes: 0, passes: 0 });
  const [showStatsPopup, setShowStatsPopup] = useState(false);
  
  // Profile swipe revenue stats (gift/burn/team)
  const { stats: revenueStats, isLoading: revenueLoading } = useProfileSwipeRevenue(profile.id);
  
  // Featured staking pool (random approved)
  const [featuredPool, setFeaturedPool] = useState<FeaturedPool | null>(null);
  
  useEffect(() => {
    const fetchSwipeStats = async () => {
      const { data, error } = await supabase
        .from('swipes')
        .select('direction')
        .eq('swiped_id', profile.id);
      
      if (data && !error) {
        const likes = data.filter(s => s.direction === 'right').length;
        const passes = data.filter(s => s.direction === 'left').length;
        setSwipeStats({ likes, passes });
      }
    };
    
    fetchSwipeStats();
  }, [profile.id]);

  // Fetch featured staking pool - boosted first, then random approved
  useEffect(() => {
    const fetchFeaturedPool = async () => {
      try {
        const now = new Date().toISOString();

        // Fetch active boosts
        const { data: activeBoosts } = await supabase
          .from('staking_pool_boosts')
          .select('pool_id, amount, expires_at')
          .gt('expires_at', now);

        // Calculate active boost amounts per pool
        const poolBoostMap: Record<string, number> = {};
        if (activeBoosts && activeBoosts.length > 0) {
          for (const boost of activeBoosts) {
            if (!poolBoostMap[boost.pool_id]) {
              poolBoostMap[boost.pool_id] = 0;
            }
            poolBoostMap[boost.pool_id] += Number(boost.amount);
          }
        }

        const boostedPoolIds = Object.keys(poolBoostMap);

        if (boostedPoolIds.length > 0) {
          // Get the highest boosted pool
          const topBoostedPoolId = boostedPoolIds.sort(
            (a, b) => poolBoostMap[b] - poolBoostMap[a]
          )[0];

          const { data: topPool } = await supabase
            .from('staking_pools')
            .select('id, title, stake_token_logo')
            .eq('id', topBoostedPoolId)
            .single();

          if (topPool) {
            setFeaturedPool(topPool);
            return;
          }
        }

        // No boosted pools - fetch random approved
        const { data: pools } = await supabase
          .from('staking_pools')
          .select('id, title, stake_token_logo')
          .is('is_rejected', false)
          .is('is_pending', false)
          .limit(20);

        if (pools && pools.length > 0) {
          const randomIndex = Math.floor(Math.random() * pools.length);
          setFeaturedPool(pools[randomIndex]);
        }
      } catch (err) {
        console.error('Error fetching featured pool:', err);
      }
    };

    fetchFeaturedPool();
  }, []);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (Math.abs(velocity) >= 500 || Math.abs(offset) >= 150) {
      const direction = offset > 0 ? 'right' : 'left';
      
      // Allow swipe to proceed - parent handleSwipe will check balance and show popup if needed
      onSwipe(direction);
    }
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Check if profile is boosted
  const isBoosted = (profile.swipe_boost_amount || 0) > 0;
  
  // Generate random glow color for elite users or boosted users
  const eliteGlowColors = [
    'from-orange-500 via-yellow-500 to-orange-500',
    'from-purple-500 via-pink-500 to-purple-500', 
    'from-cyan-500 via-blue-500 to-cyan-500',
    'from-emerald-500 via-green-500 to-emerald-500',
  ];
  
  // Boosted profiles get purple glow
  const glowColor = isBoosted
    ? 'from-purple-500 via-pink-500 to-purple-500'
    : profile.special_badge 
      ? eliteGlowColors[Math.abs(profile.id.charCodeAt(0)) % eliteGlowColors.length]
      : 'from-pink-500/30 via-purple-500/30 to-cyan-500/30';

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      style={{ x, rotate, opacity }}
      onDragEnd={handleDragEnd}
      className="absolute inset-0 cursor-grab active:cursor-grabbing max-w-full"
    >
      {/* Tech Pitch - Outer animated glow effect */}
      <motion.div 
        className={`absolute -inset-3 rounded-3xl ${
          isBoosted
            ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-fuchsia-500'
            : profile.special_badge 
              ? `bg-gradient-to-r ${glowColor}`
              : 'bg-gradient-to-r from-primary via-secondary to-cyan-500'
        }`}
        animate={{
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{ filter: 'blur(20px)' }}
      />
      
      {/* Tech corners - animated */}
      <div className="absolute -inset-1 pointer-events-none z-10">
        {/* Top Left Corner */}
        <motion.div 
          className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-primary rounded-tl-2xl"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        {/* Top Right Corner */}
        <motion.div 
          className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-cyan-400 rounded-tr-2xl"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        {/* Bottom Left Corner */}
        <motion.div 
          className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-secondary rounded-bl-2xl"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        {/* Bottom Right Corner */}
        <motion.div 
          className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-primary rounded-br-2xl"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>
      
      <Card className={`relative h-full w-full max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black/95 ${
        isBoosted ? 'ring-2 ring-purple-500/50 shadow-[0_0_40px_rgba(168,85,247,0.4)]' : profile.special_badge ? 'ring-1 ring-primary/30' : ''
      }`}>
        {/* Animated border gradient sweep */}
        <motion.div 
          className="absolute inset-0 rounded-2xl p-[1px] pointer-events-none overflow-hidden"
          style={{
            background: 'linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)'
          }}
          animate={{
            backgroundPosition: ['200% 0', '-200% 0']
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        
        <div className="relative h-full overflow-hidden rounded-2xl">
          {/* Grid pattern overlay - tech aesthetic */}
          <div className="absolute inset-0 pointer-events-none z-[5] opacity-[0.03]" style={{
            backgroundImage: `
              linear-gradient(to right, hsl(var(--primary) / 0.3) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(var(--primary) / 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px'
          }} />
          
          {/* Always show photos/avatar - use default if none */}
          <Carousel className="w-full h-full">
            <CarouselContent>
              {/* Show avatar (real or default) as first slide */}
              <CarouselItem>
                <div className="w-full h-full relative">
                  {(() => {
                    const avatarSrc = getAvatarUrl(profile.avatar_url, profile.username || profile.id);
                    const isVideo = avatarSrc.match(/\.(mp4|webm)$/i);
                    
                    if (isVideo) {
                      return (
                        <video 
                          src={avatarSrc} 
                          autoPlay 
                          loop 
                          muted 
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      );
                    }
                    return (
                      <img 
                        src={avatarSrc} 
                        alt={profile.display_name || profile.username}
                        className="w-full h-full object-cover"
                      />
                    );
                  })()}
                </div>
              </CarouselItem>
              {/* Additional photos */}
              {profile.photo_urls?.map((photoUrl, index) => (
                <CarouselItem key={index}>
                  <div className="w-full h-full">
                    {photoUrl.match(/\.(mp4|webm)$/i) ? (
                      <video 
                        src={photoUrl} 
                        autoPlay 
                        loop 
                        muted 
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img 
                        src={photoUrl} 
                        alt={`${profile.display_name || profile.username} - Photo ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {(profile.photo_urls && profile.photo_urls.length > 0) && (
              <>
                <CarouselPrevious 
                  className="left-3 top-1/2 -translate-y-1/2 bg-black/80 hover:bg-black border-primary/30 backdrop-blur-sm h-10 w-10 text-primary" 
                  onClick={(e) => e.stopPropagation()} 
                />
                <CarouselNext 
                  className="right-3 top-1/2 -translate-y-1/2 bg-black/80 hover:bg-black border-primary/30 backdrop-blur-sm h-10 w-10 text-primary" 
                  onClick={(e) => e.stopPropagation()} 
                />
              </>
            )}
          </Carousel>
          
          {/* Premium gradient overlay - enhanced tech look */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-cyan-500/5 pointer-events-none" />
          
          {/* Scan lines effect - enhanced */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
          }} />
          
          {/* Horizontal shimmer line */}
          <motion.div
            className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent pointer-events-none z-10"
            animate={{
              top: ['0%', '100%'],
              opacity: [0, 1, 0]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "linear"
            }}
          />
          
          {/* Tech Status Bar - Top */}
          <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between">
            {/* Swipe Statistics - Left Side (Passes) - Tech Style */}
            <motion.div 
              className="relative"
              whileHover={{ scale: 1.05 }}
            >
              <div className="absolute inset-0 bg-red-500/20 blur-xl" />
              <div className="relative flex items-center gap-2 bg-black/90 backdrop-blur-md border border-red-500/40 rounded-lg px-3 py-2">
                <div className="flex items-center justify-center w-6 h-6 rounded bg-red-500/20 border border-red-500/30">
                  <X className="w-3.5 h-3.5 text-red-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-red-400 font-mono">{swipeStats.passes}</span>
                  <span className="text-[8px] text-red-400/60 uppercase tracking-widest">PASS</span>
                </div>
              </div>
            </motion.div>

            {/* Swipe Statistics - Right Side (Likes) - Tech Style */}
            <motion.div 
              className="relative"
              whileHover={{ scale: 1.05 }}
            >
              <div className="absolute inset-0 bg-green-500/20 blur-xl" />
              <div className="relative flex items-center gap-2 bg-black/90 backdrop-blur-md border border-green-500/40 rounded-lg px-3 py-2">
                <div className="flex items-center justify-center w-6 h-6 rounded bg-green-500/20 border border-green-500/30">
                  <Heart className="w-3.5 h-3.5 text-green-400" fill="currentColor" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-green-400 font-mono">{swipeStats.likes}</span>
                  <span className="text-[8px] text-green-400/60 uppercase tracking-widest">LIKE</span>
                </div>
              </div>
            </motion.div>
          </div>
          
          {/* Selected Payment Token Badge - Tech Style */}
          <div className="absolute top-16 left-3 z-20">
            <motion.div 
              className="relative"
              whileHover={{ scale: 1.05 }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-primary rounded-lg opacity-30 blur-lg" />
              <div className="relative flex items-center gap-2.5 bg-black/90 backdrop-blur-md border border-primary/40 rounded-lg px-3 py-2">
                <div className="relative">
                  <img 
                    src={swipeModeInfo?.tokenLogo || selectedPaymentToken?.token_logo_url || avloLogo} 
                    alt={swipeModeInfo?.tokenSymbol || selectedPaymentToken?.token_symbol || 'AVLO'}
                    className="w-7 h-7 rounded-lg object-cover border border-white/20"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-black animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <span className="text-white text-xs font-bold font-mono">
                    {swipeModeInfo?.tokenSymbol || selectedPaymentToken?.token_symbol || '$AVLO'}
                  </span>
                  <span className="text-primary text-[10px] font-medium font-mono">
                    $0.10 <span className="text-white/50">/swipe</span>
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
          
          {/* Swipe Mode Indicator - Tech Style */}
          {swipeModeInfo && (
            <div className="absolute top-[120px] left-3 z-20">
              <motion.div 
                className="relative"
                whileHover={{ scale: 1.05 }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0, transition: { delay: 0.1 } }}
              >
                <div className={`absolute inset-0 rounded-lg opacity-30 blur-lg ${
                  swipeModeInfo.mode === 'gift' 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                    : swipeModeInfo.mode === 'burn' 
                    ? 'bg-gradient-to-r from-orange-500 to-red-500' 
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                }`} />
                <div className="relative flex items-center gap-2.5 bg-black/90 backdrop-blur-md border border-white/20 rounded-lg px-3 py-2">
                  <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${
                    swipeModeInfo.mode === 'gift' 
                      ? 'bg-green-500/20 border border-green-500/30' 
                      : swipeModeInfo.mode === 'burn' 
                      ? 'bg-orange-500/20 border border-orange-500/30' 
                      : 'bg-blue-500/20 border border-blue-500/30'
                  }`}>
                    {swipeModeInfo.mode === 'gift' && <Gift className="w-4 h-4 text-green-400" />}
                    {swipeModeInfo.mode === 'burn' && <Flame className="w-4 h-4 text-orange-400" />}
                    {swipeModeInfo.mode === 'team' && <Building2 className="w-4 h-4 text-blue-400" />}
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-xs font-bold font-mono ${
                      swipeModeInfo.mode === 'gift' 
                        ? 'text-green-400' 
                        : swipeModeInfo.mode === 'burn' 
                        ? 'text-orange-400' 
                        : 'text-blue-400'
                    }`}>
                      {swipeModeInfo.mode === 'gift' ? 'GIFT MODE' : swipeModeInfo.mode === 'burn' ? 'BURN MODE' : 'TEAM MODE'}
                    </span>
                    <span className="text-[10px] text-white/50 font-mono uppercase tracking-wider">
                      {swipeModeInfo.mode === 'gift' ? 'Send to user' : swipeModeInfo.mode === 'burn' ? 'Tokens burned' : 'Send to team'}
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
          
          {/* Featured Staking Pool - Tech Style */}
          {featuredPool && (
            <div className="absolute top-16 right-3 z-20">
              <motion.button
                className="relative"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/staking?pool=${featuredPool.id}`);
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500 rounded-lg opacity-40 blur-lg" />
                <div className="relative flex items-center gap-2 bg-black/90 backdrop-blur-md border border-emerald-500/50 rounded-lg px-2.5 py-1.5 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  <div className="relative">
                    {featuredPool.stake_token_logo ? (
                      <img 
                        src={featuredPool.stake_token_logo} 
                        alt={featuredPool.title}
                        className="w-6 h-6 rounded-full object-cover border border-emerald-400/50"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                        <Coins className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <motion.div 
                      className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-black"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-300 font-mono uppercase tracking-wider">
                    STAKE
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              </motion.button>
            </div>
          )}
          
          {/* Tech Swipe Indicators */}
          <motion.div 
            className="absolute top-1/2 right-6 z-30 -translate-y-1/2"
            style={{ opacity: useTransform(x, [-100, 0], [1, 0]) }}
          >
            <motion.div 
              className="relative"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <div className="absolute inset-0 bg-red-500 blur-2xl opacity-60" />
              <div className="relative bg-black/90 border-2 border-red-500 text-red-400 p-4 rounded-xl shadow-[0_0_30px_rgba(239,68,68,0.5)]">
                <X size={48} className="drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
              </div>
            </motion.div>
          </motion.div>
          
          <motion.div 
            className="absolute top-1/2 left-6 z-30 -translate-y-1/2"
            style={{ opacity: useTransform(x, [0, 100], [0, 1]) }}
          >
            <motion.div 
              className="relative"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <div className="absolute inset-0 bg-green-500 blur-2xl opacity-60" />
              <div className="relative bg-black/90 border-2 border-green-500 text-green-400 p-4 rounded-xl shadow-[0_0_30px_rgba(34,197,94,0.5)]">
                <Heart size={48} fill="currentColor" className="drop-shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
              </div>
            </motion.div>
          </motion.div>

          {/* Content on Image - Compact Golden Ratio Layout */}
          <div className="absolute bottom-0 left-0 right-0 p-3 text-white pointer-events-auto max-w-full overflow-hidden">
            {/* Tech decorative line */}
            <div className="absolute top-0 left-3 right-3 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            
            <div className="space-y-1.5 max-w-full">
              {/* Name Row - Compact */}
              <div className="flex items-center gap-1.5 flex-wrap max-w-full overflow-hidden">
                <motion.h2 
                  className="text-xl font-bold truncate bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {profile.display_name || profile.username}
                </motion.h2>
                <UserBadges userId={profile.id} size="sm" maxBadges={2} showNames={false} />
                
                {/* Boosted Badge - Compact */}
                {isBoosted && (
                  <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 border border-purple-500/50">
                    <Flame className="w-3 h-3 text-purple-400" />
                    <span className="font-mono">BOOSTED</span>
                  </div>
                )}
                
                {/* Special Badge - Compact */}
                {profile.special_badge && (
                  <div className="bg-gradient-to-r from-orange-500/20 to-yellow-500/20 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 border border-orange-500/50">
                    <img src={avloLogo} alt="AVLO" className="w-3 h-3 rounded" />
                    <span className="font-mono">BURNERKING</span>
                  </div>
                )}
              </div>

              {/* Info row - Compact Single Line */}
              <div className="flex items-center gap-1.5 text-[10px] text-white/80 flex-wrap">
                {/* Gender Badge - Compact */}
                {profile.gender && (
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                    profile.gender === 'male' 
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/40' 
                      : profile.gender === 'female'
                      ? 'bg-pink-500/10 text-pink-400 border-pink-500/40'
                      : 'bg-purple-500/10 text-purple-400 border-purple-500/40'
                  }`}>
                    <span>{profile.gender === 'male' ? '♂' : profile.gender === 'female' ? '♀' : '⚧'}</span>
                    {profile.gender === 'male' ? 'M' : profile.gender === 'female' ? 'F' : 'O'}
                  </span>
                )}
                
                {profile.wallet_address && (
                  <div onClick={(e) => e.stopPropagation()} className="bg-black/50 rounded px-1.5 py-0.5 border border-white/10">
                    <WalletAddress address={profile.wallet_address} className="text-white/80 font-mono text-[9px]" />
                  </div>
                )}
                
                <span className="flex items-center gap-0.5 bg-black/50 rounded px-1.5 py-0.5 border border-white/10 font-mono text-[9px]">
                  <Users size={9} className="text-primary" />
                  <span className="text-white/80">{followersCount}</span>
                </span>
                
                {profile.arena_username && profile.arena_verified && (
                  <a
                    href={`https://arena.social/${profile.arena_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-0.5 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/30 text-orange-400 hover:text-orange-300 font-mono text-[9px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <img src={arenaLogo} alt="Arena" className="w-2.5 h-2.5" />
                    @{profile.arena_username}
                  </a>
                )}
                
                {/* Revenue Stats Inline */}
                {revenueStats.burn.count > 0 && (
                  <div className="flex items-center gap-0.5 bg-orange-500/10 border border-orange-500/30 rounded px-1.5 py-0.5">
                    <Flame className="w-2.5 h-2.5 text-orange-400" />
                    {revenueStats.burn.topToken?.logo_url && (
                      <img src={revenueStats.burn.topToken.logo_url} alt="" className="w-3 h-3 rounded-full object-cover" />
                    )}
                    <span className="text-[9px] font-mono text-orange-400">${revenueStats.burn.usd.toFixed(2)}</span>
                  </div>
                )}
                {revenueStats.team.count > 0 && (
                  <div className="flex items-center gap-0.5 bg-blue-500/10 border border-blue-500/30 rounded px-1.5 py-0.5">
                    <Building2 className="w-2.5 h-2.5 text-blue-400" />
                    {revenueStats.team.topToken?.logo_url && (
                      <img src={revenueStats.team.topToken.logo_url} alt="" className="w-3 h-3 rounded-full object-cover" />
                    )}
                    <span className="text-[9px] font-mono text-blue-400">${revenueStats.team.usd.toFixed(2)}</span>
                  </div>
                )}
                {revenueStats.gift.count > 0 && (
                  <div className="flex items-center gap-0.5 bg-green-500/10 border border-green-500/30 rounded px-1.5 py-0.5">
                    <Gift className="w-2.5 h-2.5 text-green-400" />
                    {revenueStats.gift.topToken?.logo_url && (
                      <img src={revenueStats.gift.topToken.logo_url} alt="" className="w-3 h-3 rounded-full object-cover" />
                    )}
                    <span className="text-[9px] font-mono text-green-400">${revenueStats.gift.usd.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Action buttons - Compact Grid */}
              {profile.wallet_address && (
                <div onClick={(e) => e.stopPropagation()} className="grid grid-cols-4 gap-1 w-full">
                  {currentUserProfile?.id && currentUserProfile.id !== profile.id && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFollow();
                      }}
                      className={`h-7 text-[9px] px-1 font-mono w-full ${isFollowing 
                        ? "bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40" 
                        : "bg-white/5 hover:bg-white/10 text-white border border-white/20"
                      }`}
                    >
                      <Users className="w-2.5 h-2.5 mr-0.5" />
                      {isFollowing ? 'FOLLOWING' : 'FOLLOW'}
                    </Button>
                  )}
                  {currentUserProfile?.id && currentUserProfile.id !== profile.id && (
                    <div className="w-full [&>button]:w-full">
                      <TipDialog 
                        receiverId={profile.id}
                        receiverName={profile.display_name || profile.username}
                        receiverWallet={profile.wallet_address}
                        receiverAvatar={getAvatarUrl(profile.avatar_url, profile.id)}
                        context="discover"
                        variant="discover"
                      />
                    </div>
                  )}
                  {currentUserProfile?.id && currentUserProfile.id !== profile.id && (
                    <div className="w-full">
                      <BoostProfileButton
                        profileId={profile.id}
                        profileName={profile.display_name || profile.username}
                      />
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/profile/${profile.id}`)}
                    className="h-7 text-[9px] px-1 bg-white/5 border-white/20 text-white hover:bg-white/10 font-mono w-full"
                  >
                    <User className="w-2.5 h-2.5 mr-0.5" />
                    PROFILE
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
      
      {/* Stats Popup */}
      <UserStatsPopup
        isOpen={showStatsPopup}
        onClose={() => setShowStatsPopup(false)}
        userId={profile.id}
        username={profile.display_name || profile.username}
      />
    </motion.div>
  );
};
