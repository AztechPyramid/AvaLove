import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { useWeb3Auth } from '@/hooks/useWeb3Auth';
import { SwipeCard } from '@/components/SwipeCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Heart, X, Flame, Loader2, Settings, AlertCircle, Coins, Search, ChevronLeft, ChevronRight, Clock, Building2, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { motion, AnimatePresence } from 'framer-motion';
import { TOKEN_CONTRACT, DEAD_ADDRESS, BURN_AMOUNT } from '@/config/wagmi';

// Team wallet address for team swipes
const TEAM_WALLET = '0xB799CD1f2ED5dB96ea94EdF367fBA2d90dfd9634';
import { Contract, BrowserProvider, parseUnits, JsonRpcProvider, formatUnits } from 'ethers';
import { calculateDistance } from '@/hooks/useGeolocation';
import { TokenBalanceDisplay } from '@/components/TokenBalanceDisplay';
import { ActivityFeed } from '@/components/ActivityFeed';

import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { useWalletTokenBalances, WalletToken } from '@/hooks/useWalletTokenBalances';
import { useAvloPrice } from '@/hooks/useAvloPrice';
import { GenderPreferenceModal } from '@/components/GenderPreferenceModal';
import { AvaxGasPrice } from '@/components/AvaxGasPrice';
import { PaymentTokenSelector } from '@/components/PaymentTokenSelector';

import { MatchDialog } from '@/components/MatchDialog';
import { useMilestones } from '@/hooks/useMilestones';
import { DiscoverLeaderboards } from '@/components/DiscoverLeaderboards';
import { TransactionProgress } from '@/components/TransactionProgress';
import { InsufficientBalancePopup } from '@/components/InsufficientBalancePopup';
import { InsufficientGasPopup } from '@/components/InsufficientGasPopup';
import { LeftSwipeInfoPopup } from '@/components/LeftSwipeInfoPopup';

import { PendingMatches } from '@/components/discover/PendingMatches';
import { TutorialCard } from '@/components/PlatformTutorial';

// Funny burn messages for when user burns instead of gifting
const BURN_MESSAGES = [
  "🔥 Burned tokens instead of gifting! Better luck next time, they say fortune favors the bold... but not today!",
  "🔥 Plot twist: Your tokens went to the void! Maybe the universe needed them more.",
  "🔥 Tokens sacrificed to the crypto gods! Consider it a spiritual investment.",
  "🔥 Instead of a gift, you chose fire! Very dramatic, very iconic.",
  "🔥 Oops! Tokens burned! At least you're reducing supply, you deflationary hero!",
  "🔥 Gift? Nah, arson it is! Your tokens are now stardust.",
  "🔥 The burn address thanks you for your generous donation to absolutely nothing!",
  "🔥 Congratulations! You just made everyone else's tokens slightly more valuable!",
  "🔥 No gift for you! *burns tokens* This is the way.",
  "🔥 Tokens? What tokens? They never existed. *poof*",
];

// Team support messages for when tokens go to team wallet
const TEAM_MESSAGES = [
  "🏢 Supporting the team! Your contribution helps build the future of AVLO.",
  "🏢 Team power-up! Thanks for fueling development and community growth.",
  "🏢 Direct team support! Every token helps us improve the platform.",
  "🏢 Building together! Your support keeps the innovation rolling.",
  "🏢 Team treasury boost! Strengthening the foundation for everyone.",
];

// Swipe cycle modes: 0 = GIFT, 1 = BURN, 2 = TEAM
type SwipeMode = 'gift' | 'burn' | 'team';
const SWIPE_CYCLE_MODES: SwipeMode[] = ['gift', 'burn', 'team'];

// Custom Token Showcase Component - Compact Version
const CustomTokenShowcase = ({ tokens, onSelect }: { tokens: WalletToken[], onSelect: (token: WalletToken) => void }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    if (tokens.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % tokens.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [tokens.length]);

  const currentToken = tokens[currentIndex];
  if (!currentToken) return null;

  return (
    <motion.button
      onClick={() => onSelect(currentToken)}
      className="w-full h-full relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all cursor-pointer"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Supported Badge - Smaller */}
      <div className="absolute top-0 left-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[6px] font-bold px-1.5 py-0.5 rounded-br-lg uppercase tracking-wide z-10">
        Supported
      </div>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={currentToken.id}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center gap-2 px-3 py-1.5 h-full"
        >
          {currentToken.logo_url ? (
            <img 
              src={currentToken.logo_url} 
              alt={currentToken.token_symbol} 
              className="w-5 h-5 rounded-full object-cover ring-1 ring-purple-500/30" 
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Coins className="w-2.5 h-2.5 text-white" />
            </div>
          )}
          <span className="text-xs font-bold text-white">
            {currentToken.token_symbol}
          </span>
          <span className="text-[10px] text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded-full font-medium">
            {currentToken.swipe_price.toLocaleString()}
          </span>
        </motion.div>
      </AnimatePresence>
      
      {/* Token indicator dots - Smaller */}
      {tokens.length > 1 && (
        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
          {tokens.map((_, i) => (
            <div 
              key={i} 
              className={`w-0.5 h-0.5 rounded-full transition-all ${i === currentIndex ? 'bg-purple-400 w-1' : 'bg-white/30'}`} 
            />
          ))}
        </div>
      )}
    </motion.button>
  );
};

interface DiscoverProfile {
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
  latitude?: number | null;
  longitude?: number | null;
  distance?: number;
  special_badge?: boolean | null;
  arena_verified?: boolean | null;
  swipe_boost_amount?: number | null;
  swipe_boosted_at?: string | null;
}

export default function Discover() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, refreshProfile } = useWalletAuth();
  const { walletAddress, isConnected, arenaSDK, isArena, ensureConnected } = useWeb3Auth();
  const { playSwipeSound, playLikeSound, playPassSound, playMatchSound } = useSoundEffects();
  const { checkFirstSwipe, checkFirstMatch } = useMilestones();
  const { avloBalance, isLoading: avloLoading } = useTokenBalances();
  const { tokens: walletTokens, hasTokens: hasWalletTokens, refetch: refetchWalletTokens } = useWalletTokenBalances();
  const { price: avloPriceUsd, formatAvloWithUsd } = useAvloPrice();
  
  // Selected wallet token for payment (uses WalletToken from useWalletTokenBalances which already filters by price & balance)
  const [selectedWalletToken, setSelectedWalletToken] = useState<WalletToken | null>(null);
  const isCustomPayment = selectedWalletToken !== null;
  
  // Fixed USD value for swipes
  const FIXED_USD_VALUE = 0.10;
  
  // Calculate AVLO amount for $0.10 USD
  const avloAmountForSwipe = avloPriceUsd && avloPriceUsd > 0 
    ? FIXED_USD_VALUE / avloPriceUsd 
    : parseInt(BURN_AMOUNT);
  
  const requiredSwipeAmount = avloAmountForSwipe;
  const hasEnoughForSwipe = parseFloat(avloBalance) >= requiredSwipeAmount || hasWalletTokens;
  const burnFormatted = formatAvloWithUsd(requiredSwipeAmount);

  // Swipe cycle state - fetched from database (0=gift, 1=burn, 2=team)
  const [swipeCycleIndex, setSwipeCycleIndex] = useState<number>(0);
  const currentSwipeMode: SwipeMode = SWIPE_CYCLE_MODES[swipeCycleIndex] || 'gift';
  
  // Get current price based on selected token (WalletToken already has swipe_price calculated for $0.10)
  const currentSwipePrice = isCustomPayment && selectedWalletToken
    ? selectedWalletToken.swipe_price
    : requiredSwipeAmount;

  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swipedProfiles, setSwipedProfiles] = useState<Set<string>>(new Set());
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [genderFilter, setGenderFilter] = useState<'female' | 'male' | 'other' | null>(null);
  
  const [reviewedProfiles, setReviewedProfiles] = useState<Set<string>>(new Set());
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [matchedUser, setMatchedUser] = useState<DiscoverProfile | null>(null);
  const [txProgress, setTxProgress] = useState<{
    isOpen: boolean;
    status: "waiting" | "processing" | "success" | "error";
    message: string;
    txHash?: string | null;
    tokenLogo?: string | null;
    tokenSymbol?: string;
    successTitle?: string;
  }>({
    isOpen: false,
    status: "waiting",
    message: "",
    txHash: null,
    tokenLogo: null,
    tokenSymbol: 'AVLO',
    successTitle: 'Gift Sent! 🎁',
  });

  // Insufficient balance popup state
  const [insufficientBalancePopup, setInsufficientBalancePopup] = useState<{
    isOpen: boolean;
    tokenSymbol: string;
    requiredAmount: number;
    tokenLogo?: string;
  }>({
  isOpen: false,
    tokenSymbol: '$AVLO',
    requiredAmount: 0,
    tokenLogo: undefined,
  });

  // Insufficient gas popup state
  const [insufficientGasPopup, setInsufficientGasPopup] = useState<{
    isOpen: boolean;
    currentBalance: string;
    requiredBalance: string;
  }>({
    isOpen: false,
    currentBalance: '0',
    requiredBalance: '0.01',
  });

  // Left swipe info popup state
  const [showLeftSwipeInfo, setShowLeftSwipeInfo] = useState(false);
  const [leftSwipePopupType, setLeftSwipePopupType] = useState<'cost' | 'insufficient'>('cost');
  const [userScore, setUserScore] = useState(0);
  const [scoreTokenId, setScoreTokenId] = useState<string | null>(null);
  const LEFT_SWIPE_COST = 10; // Score cost for left swipe
  const MIN_PROTECTED_SCORE = 10; // Initial bonus that can never be spent
  const SCORE_TOKEN_ADDRESS = '0xb5B3e63540fD53DCFFD4e65c726a84aA67B24E61'; // Used by sidebar leaderboard

  // User search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchedProfile, setSearchedProfile] = useState<DiscoverProfile | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Gender statistics
  const [genderStats, setGenderStats] = useState<{ male: number; female: number }>({ male: 0, female: 0 });

  // Leaderboard refetch trigger (increment after swipe to refresh leaderboard data)
  const [leaderboardRefetchTrigger, setLeaderboardRefetchTrigger] = useState(0);

  // Supported tokens panel state
  const [supportedTokensOpen, setSupportedTokensOpen] = useState(false);
  const [allSupportedTokens, setAllSupportedTokens] = useState<{ id: string; token_symbol: string; logo_url: string | null }[]>([]);

  // Fetch all supported tokens for display
  useEffect(() => {
    const fetchSupportedTokens = async () => {
      const { data } = await supabase
        .from('user_token_submissions')
        .select('id, token_symbol, logo_url')
        .eq('is_active', true)
        .order('token_symbol');
      if (data) {
        setAllSupportedTokens(data);
      }
    };
    fetchSupportedTokens();
  }, []);

  useEffect(() => {
    const fetchSwipeCycle = async () => {
      if (!profile?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('swipe_cycle_index')
        .eq('id', profile.id)
        .single();
      if (data?.swipe_cycle_index !== undefined) {
        setSwipeCycleIndex(data.swipe_cycle_index);
      }
    };
    fetchSwipeCycle();
  }, [profile?.id]);

  // User selects token manually via PaymentTokenSelector - no auto-locking

  // Check if user needs to set gender preferences
  useEffect(() => {
    if (profile && (!profile.gender || !profile.looking_for || profile.looking_for.length === 0)) {
      setShowGenderModal(true);
    }
  }, [profile]);

  const handleGenderPreferenceComplete = async () => {
    setShowGenderModal(false);
    // Refresh auth-context profile so we don't re-prompt on navigation
    await refreshProfile();
    // profiles will refetch via the [profile, walletAddress] effect
  };

  // Fetch gender statistics (only count users with avatar - same as discovery filter)
  useEffect(() => {
    const fetchGenderStats = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('gender')
        .not('gender', 'is', null)
        .not('avatar_url', 'is', null);
      
      if (!error && data) {
        const stats = data.reduce((acc, p) => {
          const gender = p.gender as string;
          if (gender === 'male') acc.male++;
          else if (gender === 'female') acc.female++;
          return acc;
        }, { male: 0, female: 0 });
        setGenderStats(stats);
      }
    };
    fetchGenderStats();
  }, []);

  // Fetch user score for left swipe cost check (use same token as the sidebar leaderboard)
  useEffect(() => {
    let cancelled = false;

    const fetchScore = async () => {
      if (!profile?.id) return;

      const { data: tokenRow } = await supabase
        .from('dao_tokens')
        .select('id')
        .eq('token_address', SCORE_TOKEN_ADDRESS)
        .limit(1)
        .maybeSingle();

      const tokenId = tokenRow?.id ?? null;
      if (cancelled) return;
      setScoreTokenId(tokenId);

      if (!tokenId) {
        setUserScore(0);
        return;
      }

      const { data: scoreData } = await supabase
        .from('user_scores')
        .select('total_score')
        .eq('user_id', profile.id)
        .eq('token_id', tokenId)
        .maybeSingle();

      if (!cancelled) {
        setUserScore(scoreData?.total_score || 0);
      }
    };

    fetchScore();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  // Poll score every 60s instead of realtime
  useEffect(() => {
    if (!profile?.id) return;
    const interval = setInterval(async () => {
      if (!scoreTokenId) return;
      const { data } = await supabase
        .from('user_scores')
        .select('total_score')
        .eq('user_id', profile.id)
        .eq('token_id', scoreTokenId)
        .maybeSingle();
      if (data?.total_score !== undefined) {
        setUserScore(data.total_score);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [profile?.id, scoreTokenId]);

  useEffect(() => {
    if (profile && walletAddress) {
      fetchProfiles();
    }
  }, [profile, walletAddress]);

  const fetchProfiles = async (filterGender?: 'female' | 'male' | 'other' | null) => {
    if (!profile || !walletAddress) return;

    setLoading(true);
    try {
      // Determine gender to fetch - use filter if set, otherwise use user's looking_for preference
      const activeFilter = filterGender !== undefined ? filterGender : genderFilter;
      const genderToFetch = activeFilter === 'other' ? null : (activeFilter || (profile.looking_for?.length ? profile.looking_for[0] : undefined));

      // Parallel fetch: swipes and profiles at the same time
      const [swipedResult, profilesResult] = await Promise.all([
        supabase
          .from('swipes')
          .select('swiped_id')
          .eq('swiper_id', profile.id)
          .eq('hidden', false), // Only exclude non-hidden swipes
        supabase.functions.invoke('get-profiles', {
          body: {
            walletAddress: walletAddress.toLowerCase(),
            excludeIds: [], // Edge function will filter, we update after
            gender: activeFilter === 'other' ? 'null' : genderToFetch,
            limit: 100, // Fetch more to filter client-side
          },
        })
      ]);

      const swipedIds = swipedResult.data?.map(s => s.swiped_id) || [];
      setSwipedProfiles(new Set(swipedIds));
      const swipedSet = new Set(swipedIds);

      if (profilesResult.error) throw profilesResult.error;
      
      const data = profilesResult.data?.profiles || [];
      
      // Filter out already swiped profiles client-side (faster than waiting for sequential calls)
      let filteredProfiles: DiscoverProfile[] = data.filter((p: DiscoverProfile) => !swipedSet.has(p.id));
      
      // Apply active gender filter (redundant but safe)
      if (activeFilter === 'female') {
        filteredProfiles = filteredProfiles.filter(p => p.gender === 'female');
      } else if (activeFilter === 'male') {
        filteredProfiles = filteredProfiles.filter(p => p.gender === 'male');
      } else if (activeFilter === 'other') {
        filteredProfiles = filteredProfiles.filter(p => !p.gender || p.gender === null);
      } else if (profile.looking_for && profile.looking_for.length > 1) {
        filteredProfiles = filteredProfiles.filter(p => {
          return profile.looking_for!.includes(p.gender as any);
        });
      }
      
      // Calculate distance for filtered profiles
      if (profile.latitude && profile.longitude) {
        filteredProfiles = filteredProfiles.map(p => {
          if (p.latitude && p.longitude) {
            const distance = calculateDistance(
              profile.latitude!,
              profile.longitude!,
              p.latitude,
              p.longitude
            );
            return { ...p, distance };
          }
          return { ...p, distance: undefined };
        });
      } else {
        filteredProfiles = filteredProfiles.map(p => ({ ...p, distance: undefined }));
      }
      
      // Limit to 50 for display
      setProfiles(filteredProfiles.slice(0, 50));
    } catch (error: any) {
      toast.error('Failed to load profiles');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Search users function - find user and show their swipe card
  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .neq('id', profile?.id || '')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(5);

      if (error) throw error;
      setSearchResults(data || []);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  // Handle selecting a user from search results
  const handleSelectSearchedUser = async (userId: string) => {
    // Check if user was already swiped - show warning but still allow
    const alreadySwiped = swipedProfiles.has(userId);

    try {
      // Fetch full profile data for the swipe card
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (data) {
        // Map to DiscoverProfile format
        const searchedUser: DiscoverProfile = {
          id: data.id,
          username: data.username,
          display_name: data.display_name,
          avatar_url: data.avatar_url,
          photo_urls: data.photo_urls,
          bio: data.bio,
          gender: data.gender,
          location: data.location,
          interests: data.interests,
          date_of_birth: data.date_of_birth,
          wallet_address: data.wallet_address,
          twitter_username: data.twitter_username,
          instagram_username: data.instagram_username,
          linkedin_username: data.linkedin_username,
          arena_username: data.arena_username,
          latitude: data.latitude,
          longitude: data.longitude,
          special_badge: data.special_badge,
          arena_verified: data.arena_verified,
          swipe_boost_amount: data.swipe_boost_amount,
          swipe_boosted_at: data.swipe_boosted_at,
        };
        
        setSearchedProfile(searchedUser);
        setSearchQuery('');
        setShowSearchResults(false);
        
        if (alreadySwiped) {
          toast.info(`Showing ${data.display_name || data.username}'s profile (previously swiped)`);
        } else {
          toast.success(`Showing ${data.display_name || data.username}'s profile`);
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast.error('Failed to load user profile');
    }
  };

  // Clear searched profile and go back to normal queue
  const clearSearchedProfile = () => {
    setSearchedProfile(null);
    // Also clear the URL parameter
    if (searchParams.has('showUser')) {
      searchParams.delete('showUser');
      setSearchParams(searchParams, { replace: true });
    }
  };

  // Handle showUser URL parameter (from pending matches page)
  useEffect(() => {
    const showUserId = searchParams.get('showUser');
    if (showUserId && profile?.id) {
      // Load this user's profile to show in the swipe card
      const loadShowUser = async () => {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', showUserId)
            .single();
          
          if (data) {
            setSearchedProfile({
              id: data.id,
              username: data.username || 'unknown',
              display_name: data.display_name,
              avatar_url: data.avatar_url,
              photo_urls: data.photo_urls,
              bio: data.bio,
              gender: data.gender || 'other',
              location: data.location,
              interests: data.interests,
              date_of_birth: data.date_of_birth,
              wallet_address: data.wallet_address,
              twitter_username: data.twitter_username,
              instagram_username: data.instagram_username,
              linkedin_username: data.linkedin_username,
              arena_username: data.arena_username,
              latitude: data.latitude,
              longitude: data.longitude,
              special_badge: data.special_badge,
              arena_verified: data.arena_verified,
              swipe_boost_amount: data.swipe_boost_amount,
              swipe_boosted_at: data.swipe_boosted_at,
            });
            toast.success(`Swipe right to match with ${data.display_name || data.username}! 💕`);
          }
        } catch (error) {
          console.error('[DISCOVER] Error loading showUser:', error);
        }
      };
      loadShowUser();
    }
  }, [searchParams, profile?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Transfer tokens to swiped user's wallet (gift swipe system)
  const transferTokens = async (token: WalletToken, recipientAddress: string) => {
    if (!walletAddress || !isConnected) {
      toast.error('Please connect your wallet');
      return null;
    }

    if (!recipientAddress) {
      toast.error('Recipient wallet address not found');
      return null;
    }

    try {
      // Use swipe_price from WalletToken (already calculated for $0.10 USD)
      const totalAmount = token.swipe_price;
      const amountWei = parseUnits(totalAmount.toFixed(token.decimals), token.decimals);
      console.log('[DISCOVER GIFT] Starting gift transfer', { token: token.token_symbol, totalAmount, recipient: recipientAddress, isArena, walletAddress });
      
      if (isArena && arenaSDK?.provider) {
        const fromAddress = arenaSDK.provider.accounts?.[0] || walletAddress;
        if (!fromAddress) {
          toast.error('Arena wallet not ready');
          return null;
        }
        
        // ERC20 transfer function: transfer(address,uint256)
        const functionSelector = '0xa9059cbb';
        const paddedAddress = recipientAddress.slice(2).padStart(64, '0');
        const paddedAmount = amountWei.toString(16).padStart(64, '0');
        const data = functionSelector + paddedAddress + paddedAmount;

        const txHash = await arenaSDK.provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: fromAddress,
            to: token.token_address,
            data: data,
            value: '0x0',
            gas: '0x5B8D80'
          }]
        }) as string;

        console.log('[DISCOVER GIFT] ✅ Arena transaction confirmed!', { txHash });
        return txHash;
      } else if (window.ethereum) {
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const erc20Abi = ['function transfer(address to, uint256 amount) returns (bool)'];
        const tokenContract = new Contract(token.token_address, erc20Abi, signer);
        
        const tx = await tokenContract.transfer(recipientAddress, amountWei);
        console.log('[DISCOVER GIFT] Transaction sent:', tx.hash);
        return tx.hash;
      } else {
        toast.error('Please connect your wallet');
        return null;
      }
    } catch (error: any) {
      console.error('[DISCOVER GIFT] Error:', error);
      
      if (error.code === 4001 || error.code === 5000 || error.message?.includes('User rejected')) {
        return null;
      } else if (error.message?.includes('insufficient funds') || error.message?.includes('insufficient')) {
        toast.error(`Insufficient ${token.token_symbol} tokens`);
      } else {
        toast.error('Gift transfer failed. Please try again.');
      }
      
      throw error;
    }
  };

  // Send AVLO tokens to swiped user's wallet (gift swipe system)
  const sendAvloTokens = async (recipientAddress: string) => {
    if (!walletAddress || !isConnected) {
      toast.error('Please connect your wallet to send tokens');
      return null;
    }

    if (!recipientAddress) {
      toast.error('Recipient wallet address not found');
      return null;
    }

    try {
      const amountWei = BigInt(BURN_AMOUNT) * BigInt(10 ** 18);
      console.log('[DISCOVER GIFT] Starting AVLO gift', { amount: BURN_AMOUNT, recipient: recipientAddress, isArena, walletAddress });
      
      if (isArena && arenaSDK?.provider) {
        const fromAddress = arenaSDK.provider.accounts?.[0] || walletAddress;
        if (!fromAddress) {
          toast.error('Arena wallet not ready');
          return null;
        }
        
        console.log('[DISCOVER GIFT] Using Arena SDK with address:', fromAddress);
        
        // ERC20 transfer function: transfer(address,uint256)
        const functionSelector = '0xa9059cbb';
        const paddedAddress = recipientAddress.slice(2).padStart(64, '0');
        const paddedAmount = amountWei.toString(16).padStart(64, '0');
        const data = functionSelector + paddedAddress + paddedAmount;

        const txHash = await arenaSDK.provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: fromAddress,
            to: TOKEN_CONTRACT,
            data: data,
            value: '0x0',
            gas: '0x5B8D80' // 6M gas for Arena SDK
          }]
        }) as string;

        console.log('[DISCOVER GIFT] ✅ Arena transaction confirmed!', { txHash });
        return txHash;
      } else if (window.ethereum) {
        console.log('[DISCOVER GIFT] Using browser wallet');
        
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const erc20Abi = ['function transfer(address to, uint256 amount) returns (bool)'];
        const tokenContract = new Contract(TOKEN_CONTRACT, erc20Abi, signer);
        
        const tx = await tokenContract.transfer(recipientAddress, amountWei);
        console.log('[DISCOVER GIFT] Transaction sent:', tx.hash);
        return tx.hash;
      } else {
        toast.error('Please connect your wallet to send tokens');
        return null;
      }
    } catch (error: any) {
      console.error('[DISCOVER GIFT] Error:', error);
      
      if (error.code === 4001 || error.code === 5000 || error.message?.includes('User rejected')) {
        return null;
      } else if (error.message?.includes('insufficient funds') || error.message?.includes('insufficient')) {
        toast.error('Insufficient $AVLO tokens');
      } else if (error.message?.includes('nonce')) {
        toast.error('Transaction busy, please try again');
      } else {
        toast.error('Token transfer failed. Please try again.');
      }
      
      throw error;
    }
  };

  // Burn tokens to dead address (burn swipe system - alternates with gift)
  const burnTokens = async (token: WalletToken): Promise<string | null> => {
    if (!walletAddress || !isConnected) {
      toast.error('Please connect your wallet');
      return null;
    }

    try {
      // Use swipe_price from WalletToken (already calculated for $0.10 USD)
      const burnAmount = token.swipe_price;
      const amountWei = parseUnits(burnAmount.toFixed(token.decimals), token.decimals);
      console.log('[DISCOVER BURN] Starting token burn', { token: token.token_symbol, amount: burnAmount, to: DEAD_ADDRESS, isArena, walletAddress });
      
      if (isArena && arenaSDK?.provider) {
        const fromAddress = arenaSDK.provider.accounts?.[0] || walletAddress;
        if (!fromAddress) {
          toast.error('Arena wallet not ready');
          return null;
        }
        
        // ERC20 transfer function: transfer(address,uint256)
        const functionSelector = '0xa9059cbb';
        const paddedAddress = DEAD_ADDRESS.slice(2).padStart(64, '0');
        const paddedAmount = amountWei.toString(16).padStart(64, '0');
        const data = functionSelector + paddedAddress + paddedAmount;

        const txHash = await arenaSDK.provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: fromAddress,
            to: token.token_address,
            data: data,
            value: '0x0',
            gas: '0x5B8D80'
          }]
        }) as string;

        console.log('[DISCOVER BURN] ✅ Arena burn transaction confirmed!', { txHash });
        return txHash;
      } else if (window.ethereum) {
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const erc20Abi = ['function transfer(address to, uint256 amount) returns (bool)'];
        const tokenContract = new Contract(token.token_address, erc20Abi, signer);
        
        const tx = await tokenContract.transfer(DEAD_ADDRESS, amountWei);
        console.log('[DISCOVER BURN] Burn transaction sent:', tx.hash);
        return tx.hash;
      } else {
        toast.error('Please connect your wallet');
        return null;
      }
    } catch (error: any) {
      console.error('[DISCOVER BURN] Error:', error);
      
      if (error.code === 4001 || error.code === 5000 || error.message?.includes('User rejected')) {
        return null;
      } else if (error.message?.includes('insufficient funds') || error.message?.includes('insufficient')) {
        toast.error(`Insufficient ${token.token_symbol} tokens`);
      } else {
        toast.error('Burn transfer failed. Please try again.');
      }
      
      throw error;
    }
  };

  // Send burn notification to the swiped user with funny message
  const sendBurnNotification = async (swipedUserId: string, tokenSymbol: string, amount: number) => {
    const randomMessage = BURN_MESSAGES[Math.floor(Math.random() * BURN_MESSAGES.length)];
    const swiperName = profile?.display_name || profile?.username || 'Someone';
    
    await supabase.from('notifications').insert({
      user_id: swipedUserId,
      type: 'burn_instead_of_gift',
      title: `${swiperName} burned ${amount.toLocaleString()} ${tokenSymbol}!`,
      message: randomMessage,
      data: {
        swiper_id: profile?.id,
        swiper_name: swiperName,
        swiper_avatar: profile?.avatar_url,
        token_symbol: tokenSymbol,
        amount: amount,
      },
    });
  };

  const handleReview = async () => {
    if (remainingReviews <= 0 || reviewedProfiles.size >= remainingReviews) {
      toast.error("No re-view rights remaining");
      return;
    }

    // Reset to first profile and mark as reviewed
    setCurrentIndex(0);
    setReviewedProfiles(prev => {
      const newSet = new Set(prev);
      if (currentProfile) {
        newSet.add(currentProfile.id);
      }
      return newSet;
    });

    // Decrement remaining reviews
    await supabase
      .from('profiles')
      .update({ remaining_reviews: remainingReviews - 1 })
      .eq('id', profile?.id);

    toast.success("Using 1 re-view right");
  };

  // Custom token balance check helper - check actual on-chain balance for real-time accuracy
  const checkCustomTokenBalance = async (token: WalletToken): Promise<boolean> => {
    if (!walletAddress) return false;
    
    try {
      const provider = new JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");
      const erc20Abi = ['function balanceOf(address owner) view returns (uint256)'];
      const contract = new Contract(token.token_address, erc20Abi, provider);
      
      const rawBalance = await contract.balanceOf(walletAddress);
      const formattedBalance = parseFloat(formatUnits(rawBalance, token.decimals));
      
      console.log(`[DISCOVER] On-chain balance check: ${token.token_symbol} = ${formattedBalance}, required = ${token.swipe_price}`);
      
      return formattedBalance >= token.swipe_price;
    } catch (error) {
      console.error('[DISCOVER] Error checking on-chain balance:', error);
      // Fallback to cached balance if on-chain check fails
      return token.balance >= token.swipe_price;
    }
  };

  // AVAX gas balance check - minimum 0.01 AVAX required for transactions
  const MIN_GAS_AVAX = 0.01;
  
  const checkAvaxGasBalance = async (): Promise<{ hasGas: boolean; balance: string }> => {
    if (!walletAddress) return { hasGas: false, balance: '0' };
    
    try {
      const provider = new JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");
      const rawBalance = await provider.getBalance(walletAddress);
      const formattedBalance = formatUnits(rawBalance, 18);
      const balanceNum = parseFloat(formattedBalance);
      
      console.log(`[DISCOVER] AVAX gas check: ${formattedBalance} AVAX, required = ${MIN_GAS_AVAX}`);
      
      return { 
        hasGas: balanceNum >= MIN_GAS_AVAX, 
        balance: formattedBalance 
      };
    } catch (error) {
      console.error('[DISCOVER] Error checking AVAX gas balance:', error);
      return { hasGas: false, balance: '0' };
    }
  };

  const handleSwipe = async (
    direction: 'left' | 'right',
    targetProfile?: DiscoverProfile,
    advanceQueue: boolean = true
  ): Promise<boolean> => {
    const swipedProfile = targetProfile ?? profiles[currentIndex];
    if (!profile || !swipedProfile) return false;

    // Only enforce queue bounds when swiping from the queue
    if (!targetProfile && currentIndex >= profiles.length) return false;

    // Block right swipe if no token selected
    if (direction === 'right' && !selectedWalletToken) {
      toast.error('Please select a payment token first');
      return false;
    }

    // CRITICAL: Check AVAX gas balance FIRST before any right swipe transaction
    if (direction === 'right') {
      const gasCheck = await checkAvaxGasBalance();
      if (!gasCheck.hasGas) {
        setInsufficientGasPopup({
          isOpen: true,
          currentBalance: gasCheck.balance,
          requiredBalance: MIN_GAS_AVAX.toString(),
        });
        return false;
      }
    }

    // Check balance for right swipe
    if (direction === 'right' && selectedWalletToken) {
      const requiredAmount = selectedWalletToken.swipe_price;
      
      // Check balance
      const hasBalance = await checkCustomTokenBalance(selectedWalletToken);
      if (!hasBalance) {
        setInsufficientBalancePopup({
          isOpen: true,
          tokenSymbol: selectedWalletToken.token_symbol,
          requiredAmount: requiredAmount,
          tokenLogo: selectedWalletToken.logo_url || undefined,
        });
        return false;
      }
    }

    // Play appropriate sound based on direction
    if (direction === 'right') {
      playLikeSound();
    } else {
      playPassSound();
    }

    try {
      // For left swipes, check score and deduct
      if (direction === 'left') {
        // Check if user is authenticated (has profile)
        if (!profile?.id) {
          toast.error('Please set up your profile first');
          return false;
        }
        
        // Left swipe can only spend score ABOVE the protected minimum (min stays at 10)
        if (userScore < MIN_PROTECTED_SCORE + LEFT_SWIPE_COST) {
          setLeftSwipePopupType('insufficient');
          setShowLeftSwipeInfo(true);
          return false;
        }
        
        // Record left swipe via edge function - includes score deduction
        const { data, error } = await supabase.functions.invoke('record-swipe', {
          body: {
            walletAddress: walletAddress?.toLowerCase() || profile.wallet_address?.toLowerCase(),
            swipedId: swipedProfile.id,
            direction: 'left',
            txHash: null,
            paymentTokenId: null,
            multiplier: 1,
            leftSwipeCost: LEFT_SWIPE_COST,
          },
        });

        if (error || data?.error) {
          const errorMessage = data?.error || error?.message || 'Swipe failed';
          
          // Check for insufficient score error from backend
          if (data?.insufficientScore) {
            setLeftSwipePopupType('insufficient');
            setShowLeftSwipeInfo(true);
            return false;
          }
          
          throw new Error(errorMessage);
        }

        if (advanceQueue) {
          setCurrentIndex((prev) => prev + 1);
        }
        
        // Update local score immediately (never go below the protected minimum)
        setUserScore(prev => Math.max(MIN_PROTECTED_SCORE, prev - LEFT_SWIPE_COST));
        
        // Show cost info popup (first time)
        setLeftSwipePopupType('cost');
        setShowLeftSwipeInfo(true);
        
        return true;
      }

      // RIGHT SWIPE LOGIC - 3-way cycle: GIFT -> BURN -> TEAM
      // Get recipient wallet address for gift swipes (right swipes only)
      const recipientAddress = swipedProfile.wallet_address;
      
      // Handle payment for right swipes (likes) - cycles between gift, burn, team
      let txHash = null;
      let usedToken: WalletToken | null = null;
      const currentMode = currentSwipeMode; // gift, burn, or team
      
      if (isConnected && walletAddress) {
      // Use the user-selected token
      const tokenToUse = selectedWalletToken;
      
      // If no token selected, block swipe
      if (!tokenToUse) {
        toast.error('Please select a payment token first');
        return false;
      }
      
      usedToken = tokenToUse;
      const tokenSymbol = tokenToUse.token_symbol;
      const tokenLogo = tokenToUse.logo_url;
      // Use swipe_price from WalletToken (already calculated for $0.10 USD)
      const swipePrice = tokenToUse.swipe_price;
        
        if (currentMode === 'burn') {
          // BURN SWIPE - Send to dead address
          setTxProgress({
            isOpen: true,
            status: "waiting",
            message: `🔥 BURN MODE! Please confirm burning ${swipePrice.toLocaleString()} ${tokenSymbol}...`,
            txHash: null,
            tokenLogo: tokenLogo,
            tokenSymbol: tokenSymbol,
          });

          try {
            // Convert PaymentToken to WalletToken-like for burnTokens
            const walletTokenLike: WalletToken = {
              id: tokenToUse.id,
              token_address: tokenToUse.token_address,
              token_name: tokenToUse.token_name,
              token_symbol: tokenToUse.token_symbol,
              logo_url: tokenToUse.logo_url,
              swipe_price: tokenToUse.swipe_price,
              decimals: tokenToUse.decimals,
              balance: 0,
              payment_address: tokenToUse.payment_address,
              priceUsd: 0,
            };
            txHash = await burnTokens(walletTokenLike);

            if (txHash) {
              const randomBurnMessage = BURN_MESSAGES[Math.floor(Math.random() * BURN_MESSAGES.length)];
              setTxProgress({
                isOpen: true,
                status: "success",
                message: randomBurnMessage,
                txHash,
                tokenLogo: tokenLogo,
                tokenSymbol: tokenSymbol,
                successTitle: 'Tokens Burned! 🔥',
              });
              
              // Send funny notification to the swiped user
              await sendBurnNotification(swipedProfile.id, tokenSymbol, swipePrice);
            } else {
              setTxProgress({ isOpen: false, status: "waiting", message: "", txHash: null, tokenLogo: null, tokenSymbol: 'AVLO', successTitle: 'Gift Sent! 🎁' });
              return false;
            }
          } catch (txError: any) {
            console.error('Burn transaction error:', txError);

            if (txError.code === 4001 || txError.code === 5000 || txError.message?.includes('User rejected')) {
              setTxProgress({ isOpen: false, status: "waiting", message: "", txHash: null, tokenLogo: null, tokenSymbol: 'AVLO', successTitle: 'Gift Sent! 🎁' });
              return false;
            }

            setTxProgress({
              isOpen: true,
              status: "error",
              message: "Burn failed. Please try again.",
              txHash: null,
              tokenLogo: tokenLogo,
              tokenSymbol: tokenSymbol,
            });

            setTimeout(() => {
              setTxProgress({ isOpen: false, status: "waiting", message: "", txHash: null, tokenLogo: null, tokenSymbol: 'AVLO', successTitle: 'Gift Sent! 🎁' });
            }, 3000);

            return false;
          }
        } else if (currentMode === 'team') {
          // TEAM SWIPE - Send to team wallet
          setTxProgress({
            isOpen: true,
            status: "waiting",
            message: `🏢 TEAM MODE! Please confirm sending ${swipePrice.toLocaleString()} ${tokenSymbol} to team...`,
            txHash: null,
            tokenLogo: tokenLogo,
            tokenSymbol: tokenSymbol,
          });

          try {
            // Transfer directly using WalletToken
            txHash = await transferTokens(tokenToUse, TEAM_WALLET);

            if (txHash) {
              const randomTeamMessage = TEAM_MESSAGES[Math.floor(Math.random() * TEAM_MESSAGES.length)];
              setTxProgress({
                isOpen: true,
                status: "success",
                message: randomTeamMessage,
                txHash,
                tokenLogo: tokenLogo,
                tokenSymbol: tokenSymbol,
                successTitle: 'Team Supported! 🏢',
              });
            } else {
              setTxProgress({ isOpen: false, status: "waiting", message: "", txHash: null, tokenLogo: null, tokenSymbol: 'AVLO', successTitle: 'Gift Sent! 🎁' });
              return false;
            }
          } catch (txError: any) {
            console.error('Team transfer error:', txError);

            if (txError.code === 4001 || txError.code === 5000 || txError.message?.includes('User rejected')) {
              setTxProgress({ isOpen: false, status: "waiting", message: "", txHash: null, tokenLogo: null, tokenSymbol: 'AVLO', successTitle: 'Gift Sent! 🎁' });
              return false;
            }

            setTxProgress({
              isOpen: true,
              status: "error",
              message: "Team transfer failed. Please try again.",
              txHash: null,
              tokenLogo: tokenLogo,
              tokenSymbol: tokenSymbol,
            });

            setTimeout(() => {
              setTxProgress({ isOpen: false, status: "waiting", message: "", txHash: null, tokenLogo: null, tokenSymbol: 'AVLO', successTitle: 'Gift Sent! 🎁' });
            }, 3000);

            return false;
          }
        } else {
          // GIFT SWIPE - Send to user
          if (!recipientAddress) {
            toast.error('Cannot send gift: User has no wallet address');
            return false;
          }
          
          setTxProgress({
            isOpen: true,
            status: "waiting",
            message: `🎁 GIFT MODE! Please confirm sending ${swipePrice.toLocaleString()} ${tokenSymbol}...`,
            txHash: null,
            tokenLogo: tokenLogo,
            tokenSymbol: tokenSymbol,
          });

          try {
            // Transfer directly using WalletToken
            txHash = await transferTokens(tokenToUse, recipientAddress);

            if (txHash) {
              setTxProgress({
                isOpen: true,
                status: "success",
                message: `Sent ${swipePrice.toLocaleString()} ${tokenSymbol} to ${swipedProfile.display_name || swipedProfile.username}!`,
                txHash,
                tokenLogo: tokenLogo,
                tokenSymbol: tokenSymbol,
                successTitle: 'Gift Sent! 🎁',
              });
            } else {
              setTxProgress({ isOpen: false, status: "waiting", message: "", txHash: null, tokenLogo: null, tokenSymbol: 'AVLO', successTitle: 'Gift Sent! 🎁' });
              return false;
            }
          } catch (txError: any) {
            console.error('Gift transaction error:', txError);

            if (txError.code === 4001 || txError.code === 5000 || txError.message?.includes('User rejected')) {
              setTxProgress({ isOpen: false, status: "waiting", message: "", txHash: null, tokenLogo: null, tokenSymbol: 'AVLO', successTitle: 'Gift Sent! 🎁' });
              return false;
            }

            setTxProgress({
              isOpen: true,
              status: "error",
              message: "Gift transfer failed. Please try again.",
              txHash: null,
              tokenLogo: tokenLogo,
              tokenSymbol: tokenSymbol,
            });

            setTimeout(() => {
              setTxProgress({ isOpen: false, status: "waiting", message: "", txHash: null, tokenLogo: null, tokenSymbol: 'AVLO', successTitle: 'Gift Sent! 🎁' });
            }, 3000);

            return false;
          }
        }
        
        // Update swipe cycle in database (0 -> 1 -> 2 -> 0)
        const nextCycleIndex = (swipeCycleIndex + 1) % 3;
        setSwipeCycleIndex(nextCycleIndex);
        
        // Update in database
        await supabase
          .from('profiles')
          .update({ swipe_cycle_index: nextCycleIndex })
          .eq('id', profile?.id);
        
        // Refetch wallet token balances after successful swipe
        // Use a short delay to allow blockchain state to update
        setTimeout(async () => {
          await refetchWalletTokens();
          
          // After refetch, verify the selected token still has enough balance
          // If not, clear selection to prevent failed transactions
          if (selectedWalletToken) {
            const tokenAddress = selectedWalletToken.token_address.toLowerCase();
            const provider = new JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");
            const erc20Abi = ['function balanceOf(address owner) view returns (uint256)'];
            
            try {
              const contract = new Contract(tokenAddress, erc20Abi, provider);
              const rawBalance = await contract.balanceOf(walletAddress);
              const formattedBalance = parseFloat(formatUnits(rawBalance, selectedWalletToken.decimals));
              
              // If balance is now insufficient for another swipe, clear selection
              if (formattedBalance < selectedWalletToken.swipe_price) {
                setSelectedWalletToken(null);
                toast.info(`${selectedWalletToken.token_symbol} balance insufficient for another swipe. Please select a different token.`);
              }
            } catch (err) {
              console.error('[DISCOVER] Error checking post-swipe balance:', err);
            }
          }
        }, 1500); // 1.5s delay for blockchain confirmation
      } else {
        toast.error('Please connect your wallet to like');
        return false;
      }

      // Advance queue IMMEDIATELY after successful transaction (before edge function call)
      if (advanceQueue) {
        setCurrentIndex((prev) => prev + 1);
      }

      // For gift mode, immediately show pending score message (before edge function response)
      if (direction === 'right' && currentMode === 'gift') {
        setTxProgress(prev => ({
          ...prev,
          message: `${prev.message}\n\n⏳ Your +10 score is pending until they like you back!`,
        }));
      }

      // Record swipe via edge function - NON-BLOCKING (fire and forget style, but handle match)
      const usedTokenId = usedToken ? (usedToken as any).id : null;
      const paidTokenAmount = usedToken ? usedToken.swipe_price : 0;
      
      // Fire edge function call without blocking UI
      supabase.functions.invoke('record-swipe', {
        body: {
          walletAddress: walletAddress?.toLowerCase(),
          swipedId: swipedProfile.id,
          direction,
          txHash,
          paymentTokenId: usedTokenId,
          multiplier: 1,
          swipeMode: currentMode,
          paymentDestination: currentMode,
          paidTokenAmount,
        },
      }).then(({ data, error }) => {
        // Handle response in background
        if (error || data?.error) {
          console.error('Record swipe error:', data?.error || error?.message);
          return;
        }

        // Check for match in background
        if (direction === 'right' && data?.match) {
          // Match! Both users get score now
          setUserScore(prev => prev + 20);
          playMatchSound();
          setMatchedUser(swipedProfile);
          setShowMatchDialog(true);
          
          // Update success message to show match
          setTxProgress(prev => ({
            ...prev,
            message: `It's a match! 🎉 You both earned +20 score points!`,
            successTitle: "Match! 💕",
          }));
          
          checkFirstMatch();
        }
        
        // Trigger leaderboard refetch
        setLeaderboardRefetchTrigger(prev => prev + 1);
      });

      // Check first swipe milestone in background (non-blocking)
      if (direction === 'right') {
        checkFirstSwipe();
      }

      return true;
    } catch (error: any) {
      toast.error('Swipe failed: ' + error.message);
      console.error(error);
      return false;
    }
  };

  const handleButtonSwipe = (direction: 'left' | 'right') => {
    handleSwipe(direction);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-white" size={48} />
        
        {/* Gender Preference Modal - show even during loading if needed */}
        {profile && showGenderModal && (
          <GenderPreferenceModal
            isOpen={showGenderModal}
            onComplete={handleGenderPreferenceComplete}
            profileId={profile.id}
          />
        )}
      </div>
    );
  }

  const currentProfile = profiles[currentIndex];
  const remainingReviews = (profile as any)?.remaining_reviews || 0;

  if (!currentProfile && !searchedProfile) {
    return (
      <div className="min-h-screen bg-black py-4 sm:py-8 px-2 sm:px-4 overflow-x-hidden max-w-full">
        {/* Transaction Progress Popup */}
        <TransactionProgress
          isOpen={txProgress.isOpen}
          status={txProgress.status}
          message={txProgress.message}
          txHash={txProgress.txHash}
          tokenLogo={txProgress.tokenLogo}
          tokenSymbol={txProgress.tokenSymbol}
          successTitle={txProgress.successTitle}
          onClose={() => setTxProgress({ isOpen: false, status: "waiting", message: "", txHash: null, tokenLogo: null, tokenSymbol: 'AVLO', successTitle: 'Gift Sent! 🎁' })}
        />
        
        <div className="max-w-md mx-auto space-y-4 w-full">
          {/* Activity Feed */}
          <ActivityFeed />
          
          {/* User Search */}
          <div ref={searchRef} className="relative w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                type="text"
                placeholder="Search users to like..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery && setShowSearchResults(true)}
                className="pl-9 h-10 bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 text-sm focus:border-orange-500 rounded-full"
              />
            </div>
            
            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectSearchedUser(user.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-orange-500/10 transition-colors border-b border-zinc-800 last:border-b-0"
                  >
                    <Avatar className="w-8 h-8 border border-zinc-600">
                      {user.avatar_url && (user.avatar_url.endsWith('.mp4') || user.avatar_url.endsWith('.webm')) ? (
                        <video
                          src={user.avatar_url}
                          className="w-full h-full object-cover"
                          autoPlay
                          loop
                          muted
                          playsInline
                        />
                      ) : (
                        <>
                          <AvatarImage src={user.avatar_url} />
                          <AvatarFallback className="bg-zinc-700 text-white text-xs">
                            {user.display_name?.[0] || user.username?.[0] || '?'}
                          </AvatarFallback>
                        </>
                      )}
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="text-white text-sm font-medium truncate">
                        {user.display_name || user.username}
                      </p>
                      <p className="text-zinc-500 text-xs truncate">@{user.username}</p>
                    </div>
                    <Heart className="w-4 h-4 text-orange-500" />
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* No More Profiles Card */}
          <Card className="p-8 text-center bg-zinc-900 border-zinc-800">
            <Flame className="mx-auto mb-4 text-orange-500" size={64} />
            <h2 className="text-2xl font-bold mb-2 text-white">No more profiles!</h2>
            <p className="text-zinc-400 mb-4">
              Check back later for new matches
            </p>
            <Button onClick={() => fetchProfiles()} className="bg-orange-600 hover:bg-orange-700 text-white">Refresh</Button>
          </Card>
          
          {/* Gender Filter - Also shown when no profiles */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => {
                setGenderFilter('female');
                setCurrentIndex(0);
                fetchProfiles('female');
              }}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-medium text-xs transition-all ${
                genderFilter === 'female' 
                  ? 'bg-pink-500/15 border border-pink-500/30 text-pink-400' 
                  : 'bg-zinc-900/50 border border-zinc-800 text-zinc-500 hover:border-pink-500/20 hover:text-pink-400'
              }`}
            >
              <span>♀</span>
              <span>Women</span>
            </button>
            <button
              onClick={() => {
                setGenderFilter('male');
                setCurrentIndex(0);
                fetchProfiles('male');
              }}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-medium text-xs transition-all ${
                genderFilter === 'male' 
                  ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400' 
                  : 'bg-zinc-900/50 border border-zinc-800 text-zinc-500 hover:border-blue-500/20 hover:text-blue-400'
              }`}
            >
              <span>♂</span>
              <span>Men</span>
            </button>
            <button
              onClick={() => {
                setGenderFilter('other');
                setCurrentIndex(0);
                fetchProfiles('other');
              }}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-medium text-xs transition-all ${
                genderFilter === 'other' 
                  ? 'bg-purple-500/15 border border-purple-500/30 text-purple-400' 
                  : 'bg-zinc-900/50 border border-zinc-800 text-zinc-500 hover:border-purple-500/20 hover:text-purple-400'
              }`}
            >
              <span>◐</span>
              <span>Other</span>
            </button>
          </div>
          
          {/* Payment Token Selector & Custom Token Showcase */}
          <div className="flex gap-2 w-full items-stretch">
            <div className="flex-1 min-w-0">
              <PaymentTokenSelector
                tokens={walletTokens}
                selectedToken={selectedWalletToken}
                onSelect={setSelectedWalletToken}
                action="swipe"
                avloPrice={requiredSwipeAmount}
                avloBalance={parseFloat(avloBalance)}
                className="w-full"
              />
            </div>
            {walletTokens.length > 0 && (
              <div className="w-1/3 min-w-0">
                <CustomTokenShowcase tokens={walletTokens} onSelect={setSelectedWalletToken} />
              </div>
            )}
          </div>

          {/* Supported Tokens Collapsible Panel */}
          {allSupportedTokens.length > 0 && (
            <Collapsible open={supportedTokensOpen} onOpenChange={setSupportedTokensOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-purple-500/30 transition-all">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-medium text-zinc-300">Supported Tokens</span>
                    <span className="text-[10px] text-zinc-500">({allSupportedTokens.length})</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${supportedTokensOpen ? 'rotate-180' : ''}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 p-3 bg-zinc-900/30 border border-zinc-800 rounded-lg">
                  <div className="flex flex-wrap gap-2">
                    {allSupportedTokens.map((token) => (
                      <div 
                        key={token.id}
                        className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 border border-zinc-700/50 rounded-full"
                      >
                        {token.logo_url ? (
                          <img src={token.logo_url} alt={token.token_symbol} className="w-4 h-4 rounded-full object-cover" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center text-[8px] font-bold text-white">
                            {token.token_symbol[0]}
                          </div>
                        )}
                        <span className="text-[10px] font-medium text-zinc-300">{token.token_symbol}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
          
          {/* Most Liked & Most Passed Leaderboards */}
          <DiscoverLeaderboards onSelectUser={handleSelectSearchedUser} refetchTrigger={leaderboardRefetchTrigger} />
          
          
          {/* Platform Tutorial Card */}
          <TutorialCard />

          {/* Gas Price */}
          <div className="flex justify-center">
            {isConnected && <AvaxGasPrice showBalance />}
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-4 sm:py-8 px-2 sm:px-4 overflow-x-hidden max-w-full">
      {/* Gender Preference Modal */}
      {profile && showGenderModal && (
        <GenderPreferenceModal
          isOpen={showGenderModal}
          onComplete={handleGenderPreferenceComplete}
          profileId={profile.id}
        />
      )}
      
      {/* Transaction Progress Popup */}
      <TransactionProgress
        isOpen={txProgress.isOpen}
        status={txProgress.status}
        message={txProgress.message}
        txHash={txProgress.txHash}
        tokenLogo={txProgress.tokenLogo}
        tokenSymbol={txProgress.tokenSymbol}
        successTitle={txProgress.successTitle}
        onClose={() => setTxProgress({ isOpen: false, status: "waiting", message: "", txHash: null, tokenLogo: null, tokenSymbol: 'AVLO', successTitle: 'Gift Sent! 🎁' })}
      />
      
      <div className="max-w-md mx-auto space-y-4 w-full">
        {/* Activity Feed */}
        <ActivityFeed />
        
        {/* User Search - below activity feed */}
        <div ref={searchRef} className="relative w-full">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              type="text"
              placeholder="Search users to like..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery && setShowSearchResults(true)}
              className="pl-9 h-10 bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 text-sm focus:border-orange-500 rounded-full"
            />
          </div>
          
          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectSearchedUser(user.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-orange-500/10 transition-colors border-b border-zinc-800 last:border-b-0"
                >
                  <Avatar className="w-8 h-8 border border-zinc-600">
                    {user.avatar_url && (user.avatar_url.endsWith('.mp4') || user.avatar_url.endsWith('.webm')) ? (
                      <video
                        src={user.avatar_url}
                        className="w-full h-full object-cover"
                        autoPlay
                        loop
                        muted
                        playsInline
                      />
                    ) : (
                      <>
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback className="bg-zinc-700 text-white text-xs">
                          {user.display_name?.[0] || user.username?.[0] || '?'}
                        </AvatarFallback>
                      </>
                    )}
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-white text-sm font-medium truncate">
                      {user.display_name || user.username}
                    </p>
                    <p className="text-zinc-500 text-xs truncate">@{user.username}</p>
                  </div>
                  <Heart className="w-4 h-4 text-orange-500" />
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="relative h-[500px] sm:h-[600px] w-full max-w-full overflow-hidden">
          {/* Swipe Hint Animations - Static hints without re-animating on profile change */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-20 pointer-events-none animate-pulse">
            <div className="flex items-center gap-1 bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-full px-3 py-2">
              <ChevronLeft className="w-5 h-5 text-red-400" />
              <X className="w-4 h-4 text-red-400" />
            </div>
          </div>
          
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 pointer-events-none animate-pulse">
            <div className="flex items-center gap-1 bg-green-500/20 backdrop-blur-sm border border-green-500/30 rounded-full px-3 py-2">
              <Heart className="w-4 h-4 text-green-400" fill="currentColor" />
              <ChevronRight className="w-5 h-5 text-green-400" />
            </div>
          </div>
          
          {/* Show searched profile or current profile from queue */}
          {(searchedProfile || currentProfile) && (
            <SwipeCard
              key={searchedProfile?.id || currentProfile?.id}
              profile={searchedProfile || currentProfile!}
              onSwipe={async (direction) => {
                if (searchedProfile) {
                  const ok = await handleSwipe(direction, searchedProfile, false);
                  if (ok) setSearchedProfile(null);
                  return;
                }

                void handleSwipe(direction);
              }}
              canSwipeRight={isCustomPayment || hasEnoughForSwipe}
              selectedPaymentToken={selectedWalletToken ? {
                token_symbol: selectedWalletToken.token_symbol,
                token_logo_url: selectedWalletToken.logo_url
              } : null}
              swipeModeInfo={{
                mode: currentSwipeMode,
                tokenSymbol: selectedWalletToken?.token_symbol || '$AVLO',
                tokenLogo: selectedWalletToken?.logo_url || null,
                swipePrice: selectedWalletToken?.swipe_price,
                priceUsd: undefined,
              }}
            />
          )}
        </div>

        {/* Payment Token Selector & Custom Token Showcase */}
        <div className="flex gap-2 w-full items-stretch">
          {/* Token Selector - wider */}
          <div className="flex-1 min-w-0">
            <PaymentTokenSelector
              tokens={walletTokens}
              selectedToken={selectedWalletToken}
              onSelect={setSelectedWalletToken}
              action="swipe"
              avloPrice={requiredSwipeAmount}
              avloBalance={parseFloat(avloBalance)}
              className="w-full"
            />
          </div>
          
          {/* Custom Token Showcase */}
          {walletTokens.length > 0 && (
            <div className="w-1/3 min-w-0">
              <CustomTokenShowcase tokens={walletTokens} onSelect={setSelectedWalletToken} />
            </div>
          )}
        </div>

        {/* Supported Tokens Collapsible Panel - Mobile */}
        {allSupportedTokens.length > 0 && (
          <Collapsible open={supportedTokensOpen} onOpenChange={setSupportedTokensOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-purple-500/30 transition-all">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-medium text-zinc-300">Supported Tokens</span>
                  <span className="text-[10px] text-zinc-500">({allSupportedTokens.length})</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${supportedTokensOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 p-3 bg-zinc-900/30 border border-zinc-800 rounded-lg">
                <div className="flex flex-wrap gap-2">
                  {allSupportedTokens.map((token) => (
                    <div 
                      key={token.id}
                      className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 border border-zinc-700/50 rounded-full"
                    >
                      {token.logo_url ? (
                        <img src={token.logo_url} alt={token.token_symbol} className="w-4 h-4 rounded-full object-cover" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center text-[8px] font-bold text-white">
                          {token.token_symbol[0]}
                        </div>
                      )}
                      <span className="text-[10px] font-medium text-zinc-300">{token.token_symbol}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Pending Matches Section */}
        <PendingMatches onSelectUser={handleSelectSearchedUser} />

        {/* Gender Filter - BELOW PENDING MATCHES */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => {
              setGenderFilter('female');
              setCurrentIndex(0);
              fetchProfiles('female');
            }}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-medium text-xs transition-all ${
              genderFilter === 'female' 
                ? 'bg-pink-500/15 border border-pink-500/30 text-pink-400' 
                : 'bg-zinc-900/50 border border-zinc-800 text-zinc-500 hover:border-pink-500/20 hover:text-pink-400'
            }`}
          >
            <span>♀</span>
            <span>Women</span>
          </button>
          <button
            onClick={() => {
              setGenderFilter('male');
              setCurrentIndex(0);
              fetchProfiles('male');
            }}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-medium text-xs transition-all ${
              genderFilter === 'male' 
                ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400' 
                : 'bg-zinc-900/50 border border-zinc-800 text-zinc-500 hover:border-blue-500/20 hover:text-blue-400'
            }`}
          >
            <span>♂</span>
            <span>Men</span>
          </button>
          <button
            onClick={() => {
              setGenderFilter('other');
              setCurrentIndex(0);
              fetchProfiles('other');
            }}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-medium text-xs transition-all ${
              genderFilter === 'other' 
                ? 'bg-purple-500/15 border border-purple-500/30 text-purple-400' 
                : 'bg-zinc-900/50 border border-zinc-800 text-zinc-500 hover:border-purple-500/20 hover:text-purple-400'
            }`}
          >
            <span>◐</span>
            <span>Other</span>
          </button>
        </div>
        
        {/* Most Liked & Most Passed Leaderboards - BELOW GENDER FILTER */}
        <DiscoverLeaderboards onSelectUser={handleSelectSearchedUser} refetchTrigger={leaderboardRefetchTrigger} />

        <div className="flex flex-col items-center gap-3 mt-6">
          
          {isConnected && <AvaxGasPrice showBalance />}
        </div>
      </div>

      <MatchDialog
        open={showMatchDialog}
        onOpenChange={setShowMatchDialog}
        matchedUser={matchedUser}
        currentUser={profile}
      />

      <InsufficientBalancePopup
        isOpen={insufficientBalancePopup.isOpen}
        onClose={() => setInsufficientBalancePopup(prev => ({ ...prev, isOpen: false }))}
        tokenSymbol={insufficientBalancePopup.tokenSymbol}
        requiredAmount={insufficientBalancePopup.requiredAmount}
        tokenLogo={insufficientBalancePopup.tokenLogo}
      />

      <InsufficientGasPopup
        isOpen={insufficientGasPopup.isOpen}
        onClose={() => setInsufficientGasPopup(prev => ({ ...prev, isOpen: false }))}
        currentBalance={insufficientGasPopup.currentBalance}
        requiredBalance={insufficientGasPopup.requiredBalance}
      />

      <LeftSwipeInfoPopup
        isOpen={showLeftSwipeInfo}
        onClose={() => setShowLeftSwipeInfo(false)}
        type={leftSwipePopupType}
        currentScore={userScore}
      />
    </div>
  );
}
