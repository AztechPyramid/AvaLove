import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletAuth } from "@/contexts/WalletAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Coins, Loader2, Zap, TrendingUp, Trophy, Volume2, VolumeX, Sparkles, Shield, TrendingDown } from "lucide-react";
import AvloTokenLogo from "@/assets/avlo-token-logo.jpg";
import { useAvloPrice } from "@/hooks/useAvloPrice";
import { useAvloBalance } from "@/hooks/useAvloBalance";
import { motion, AnimatePresence } from "framer-motion";
import PlayingCardComponent from "@/components/games/PlayingCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import confetti from "canvas-confetti";

// Card types
type Suit = '♠' | '♥' | '♦' | '♣';
type CardValue = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

interface PlayingCardType {
  suit: Suit;
  value: CardValue;
  hidden?: boolean;
}

interface BlackjackPool {
  id: string;
  total_pool: number;
  house_edge: number;
  min_bet: number;
  max_bet: number;
  games_played: number;
  total_wagered: number;
  total_paid_out: number;
}

interface RecentResult {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  payout: number;
  result: string;
  bet_amount: number;
  completed_at: string;
}

// Sound effects
const playSound = (type: 'card' | 'win' | 'lose' | 'bet' | 'blackjack' | 'chip') => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch (type) {
      case 'card':
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.05);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
        break;
      case 'win':
        oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
        break;
      case 'lose':
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
        break;
      case 'blackjack':
        oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2);
        oscillator.frequency.setValueAtTime(1047, audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
        break;
      case 'bet':
      case 'chip':
        oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.08);
        gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.08);
        break;
    }
  } catch (e) {
    console.log('Sound failed:', e);
  }
};

// Calculate hand value for display only
const calculateScore = (cards: PlayingCardType[]): number => {
  let score = 0;
  let aces = 0;
  
  for (const card of cards) {
    if (card.hidden) continue;
    if (card.value === 'A') {
      aces++;
      score += 11;
    } else if (['K', 'Q', 'J'].includes(card.value)) {
      score += 10;
    } else {
      score += parseInt(card.value);
    }
  }
  
  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }
  
  return score;
};

export default function BlackJack() {
  const navigate = useNavigate();
  const { profile } = useWalletAuth();
  const { price: avloPrice } = useAvloPrice();
  const { balance: spendableBalance, refresh: refetchBalance } = useAvloBalance();

  const [pool, setPool] = useState<BlackjackPool | null>(null);
  const [betAmount, setBetAmount] = useState('');
  const [playerCards, setPlayerCards] = useState<PlayingCardType[]>([]);
  const [dealerCards, setDealerCards] = useState<PlayingCardType[]>([]);
  const [gameState, setGameState] = useState<'betting' | 'playing' | 'dealer_turn' | 'finished'>('betting');
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [stats, setStats] = useState({ wins: 0, losses: 0, pushes: 0 });
  const [dynamicMaxBet, setDynamicMaxBet] = useState(10000);
  const [resultDetails, setResultDetails] = useState<{ type: string; amount: number; payout: number } | null>(null);
  const [recentResults, setRecentResults] = useState<RecentResult[]>([]);

  // Generate random client seed for provably fair
  const generateClientSeed = () => {
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  };

  // Call server-side edge function
  const callBlackjackAPI = async (action: string, params: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke('blackjack-game', {
      body: {
        action,
        userId: profile?.id,
        ...params
      }
    });
    
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    
    return data;
  };

  // Fetch pool data from server
  const fetchPool = useCallback(async () => {
    try {
      const data = await callBlackjackAPI('getPool');
      if (data?.pool) {
        setPool(data.pool);
        setDynamicMaxBet(data.pool.max_bet);
      }
    } catch (error) {
      // Fallback to direct query if edge function not ready
      const { data } = await supabase
        .from('blackjack_pools')
        .select('*')
        .limit(1)
        .single();
      
      if (data) {
        const maxBet = Math.min(Math.max(data.total_pool * 0.01, 100), 100000);
        setPool({ ...data, max_bet: maxBet } as BlackjackPool);
        setDynamicMaxBet(maxBet);
      }
    }
  }, [profile?.id]);

  // Fetch user stats
  const fetchStats = useCallback(async () => {
    if (!profile?.id) return;
    
    const { data } = await supabase
      .from('blackjack_sessions')
      .select('result')
      .eq('user_id', profile.id)
      .not('result', 'is', null);
    
    if (data) {
      const wins = data.filter(s => s.result === 'win' || s.result === 'blackjack').length;
      const losses = data.filter(s => s.result === 'lose' || s.result === 'bust').length;
      const pushes = data.filter(s => s.result === 'push').length;
      setStats({ wins, losses, pushes });
    }
  }, [profile?.id]);

  // Fetch recent results (wins AND losses)

  // Fetch recent results (wins AND losses)
  const fetchRecentResults = useCallback(async () => {
    const { data } = await supabase
      .from('blackjack_sessions')
      .select(`
        id,
        user_id,
        payout_amount,
        result,
        bet_amount,
        completed_at,
        profiles!blackjack_sessions_user_id_fkey (
          username,
          avatar_url
        )
      `)
      .in('result', ['win', 'blackjack', 'lose', 'bust'])
      .order('completed_at', { ascending: false })
      .limit(10);
    
    if (data) {
      const results: RecentResult[] = data.map((session: any) => ({
        id: session.id,
        user_id: session.user_id,
        username: session.profiles?.username || 'Anonymous',
        avatar_url: session.profiles?.avatar_url,
        payout: session.payout_amount,
        result: session.result,
        bet_amount: session.bet_amount,
        completed_at: session.completed_at
      }));
      setRecentResults(results);
    }
  }, []);

  useEffect(() => {
    fetchPool();
    fetchStats();
    fetchRecentResults();
    
    // Poll every 30s instead of realtime
    const interval = setInterval(fetchRecentResults, 30000);
    return () => clearInterval(interval);
  }, [fetchPool, fetchStats, fetchRecentResults]);

  // Deal cards - SERVER SIDE
  const dealCards = async () => {
    if (!profile?.id || !pool) return;
    
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < pool.min_bet || bet > dynamicMaxBet) {
      toast.error(`Bet must be between ${pool.min_bet} and ${Math.floor(dynamicMaxBet)}`);
      return;
    }
    
    if (bet > spendableBalance) {
      toast.error('Insufficient credit balance');
      return;
    }

    setIsLoading(true);
    playSound('bet');

    try {
      const clientSeed = generateClientSeed();
      const data = await callBlackjackAPI('deal', { 
        betAmount: bet,
        clientSeed 
      });

      setCurrentSessionId(data.sessionId);
      setDynamicMaxBet(data.maxBet || dynamicMaxBet);
      
      // Animate dealing
      setPlayerCards([]);
      setDealerCards([]);
      setResult(null);

      await new Promise(r => setTimeout(r, 200));
      playSound('card');
      setPlayerCards([data.playerCards[0]]);
      
      await new Promise(r => setTimeout(r, 300));
      playSound('card');
      setDealerCards([data.dealerCards[0]]);
      
      await new Promise(r => setTimeout(r, 300));
      playSound('card');
      setPlayerCards(data.playerCards);
      
      await new Promise(r => setTimeout(r, 300));
      playSound('card');
      setDealerCards(data.dealerCards);

      // Check for immediate result (blackjack)
      if (data.gameState === 'finished') {
        setResult(data.result);
        setGameState('finished');
        setResultDetails({ 
          type: data.result, 
          amount: bet, 
          payout: data.result === 'blackjack' ? bet * 2.5 : data.result === 'push' ? bet : 0 
        });
        if (data.result === 'blackjack') {
          playSound('blackjack');
          // Fire confetti for blackjack!
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#f59e0b']
          });
        } else if (data.result === 'push') {
          playSound('chip');
        }
      } else {
        setGameState('playing');
      }

      refetchBalance();
      fetchPool();
    } catch (error) {
      console.error('Error dealing:', error);
      toast.error((error as Error).message || 'Failed to start game');
    } finally {
      setIsLoading(false);
    }
  };

  // Hit - SERVER SIDE
  const hit = async () => {
    if (gameState !== 'playing' || !currentSessionId) return;
    
    setIsLoading(true);
    
    try {
      const data = await callBlackjackAPI('hit', { sessionId: currentSessionId });
      
      playSound('card');
      setPlayerCards(data.playerCards);
      
      if (data.gameState === 'finished') {
        setDealerCards(data.dealerCards);
        setGameState('finished');
        const bet = parseFloat(betAmount) || 0;
        const hitTo21 = data.playerScore === 21;
        
        // Check if player hit to 21 - treat as blackjack celebration!
        if (hitTo21 && (data.result === 'win' || data.result === 'blackjack')) {
          // Hit to 21 = Special BLACKJACK celebration!
          const payout = bet * 2.2; // 6:5 payout
          setResult('blackjack');
          setResultDetails({ type: 'blackjack', amount: bet, payout });
          playSound('blackjack');
          
          // Big celebration for 21!
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#f59e0b']
          });
        } else if (data.result === 'bust' || data.result === 'lose') {
          setResult(data.result);
          setResultDetails({ type: data.result, amount: bet, payout: 0 });
          playSound('lose');
        } else if (data.result === 'win') {
          setResult(data.result);
          const payout = bet * 1.9;
          setResultDetails({ type: data.result, amount: bet, payout });
          playSound('win');
          
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#10b981', '#34d399', '#6ee7b7']
          });
        } else if (data.result === 'push') {
          setResult(data.result);
          setResultDetails({ type: data.result, amount: bet, payout: bet });
          playSound('chip');
        } else {
          setResult(data.result);
        }
        
        refetchBalance();
        fetchPool();
        fetchStats();
      }
    } catch (error) {
      console.error('Error hitting:', error);
      toast.error((error as Error).message || 'Failed to hit');
    } finally {
      setIsLoading(false);
    }
  };

  // Stand - SERVER SIDE
  const stand = async () => {
    if (gameState !== 'playing' || !currentSessionId) return;
    
    setGameState('dealer_turn');
    setIsLoading(true);

    try {
      const data = await callBlackjackAPI('stand', { sessionId: currentSessionId });
      
      // Animate dealer cards
      for (let i = 0; i < data.dealerCards.length; i++) {
        await new Promise(r => setTimeout(r, 400));
        playSound('card');
        setDealerCards(data.dealerCards.slice(0, i + 1));
      }
      
      setResult(data.result);
      setGameState('finished');
      
      const bet = parseFloat(betAmount) || 0;
      const payout = data.result === 'win' ? bet * 2 : data.result === 'push' ? bet : 0;
      setResultDetails({ type: data.result, amount: bet, payout });
      
      
      if (data.result === 'win') {
        playSound('win');
      } else if (data.result === 'push') {
        playSound('chip');
      } else {
        playSound('lose');
      }
      
      refetchBalance();
      fetchPool();
      fetchStats();
    } catch (error) {
      console.error('Error standing:', error);
      toast.error((error as Error).message || 'Failed to stand');
      setGameState('playing');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset game
  const resetGame = () => {
    setGameState('betting');
    setPlayerCards([]);
    setDealerCards([]);
    setResult(null);
    setCurrentSessionId(null);
    
    setResultDetails(null);
  };

  // Render card using shared PlayingCard component
  const renderCard = (card: PlayingCardType, index: number) => {
    return (
      <PlayingCardComponent
        key={`${card.suit}-${card.value}-${index}`}
        suit={card.suit}
        value={card.value}
        hidden={card.hidden}
        index={index}
        size="lg"
        stacked={true}
      />
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-hidden relative">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <motion.div 
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div 
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, delay: 2 }}
        />
      </div>

      <div className="relative z-10 p-4 md:p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.div 
              className="relative"
              animate={{ rotateY: [0, 360] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                <span className="text-2xl font-bold">♠</span>
              </div>
            </motion.div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
                BLACKJACK
              </h1>
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <Shield className="w-3 h-3 text-green-400" />
                <span>Server-Verified • Provably Fair</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMusicEnabled(!musicEnabled)}
              className="text-zinc-400 hover:text-white"
            >
              {musicEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </Button>
            
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2" />
              LIVE
            </Badge>
          </div>
        </div>

        {/* Recent Results (Wins & Losses) - Horizontal scroll at top */}
        {recentResults.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium text-zinc-300">Recent Results</span>
              <Badge variant="outline" className="ml-auto border-orange-500/50 text-orange-400 text-[10px] px-1.5 py-0">
                LIVE
              </Badge>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-zinc-800 scrollbar-thumb-zinc-600">
              {recentResults.map((result, index) => {
                const isWin = result.result === 'win' || result.result === 'blackjack';
                const profit = isWin ? result.payout - result.bet_amount : result.bet_amount;
                
                return (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.03 }}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border ${
                      isWin 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : 'bg-red-500/10 border-red-500/30'
                    }`}
                  >
                    <Avatar className={`w-6 h-6 border ${isWin ? 'border-green-500/50' : 'border-red-500/50'}`}>
                      <AvatarImage src={result.avatar_url || undefined} />
                      <AvatarFallback className="bg-zinc-700 text-white text-[10px]">
                        {result.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex flex-col min-w-0">
                      <span className="text-white text-xs font-medium truncate max-w-[60px]">
                        {result.username}
                      </span>
                      <div className="flex items-center gap-1">
                        {isWin ? (
                          <Trophy className="w-3 h-3 text-green-400" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-400" />
                        )}
                        <span className={`text-xs font-bold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                          {isWin ? '+' : '-'}{Math.floor(profit).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {/* Credit Balance */}
          <Card className="bg-zinc-900/80 border-zinc-700/50 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <img src={AvloTokenLogo} alt="AVLO" className="w-5 h-5 rounded-full" />
                <span className="text-zinc-400 text-xs">Your Credit</span>
              </div>
              <div className="text-xl font-bold text-white">
                {spendableBalance.toLocaleString()}
              </div>
              {avloPrice && (
                <div className="text-xs text-zinc-500">
                  ≈ ${(spendableBalance * avloPrice).toFixed(2)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pool */}
          <Card className="bg-zinc-900/80 border-zinc-700/50 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-green-400" />
                <span className="text-zinc-400 text-xs">House Pool</span>
              </div>
              <div className="text-xl font-bold text-green-400">
                {pool?.total_pool.toLocaleString() || '10,000,000'}
              </div>
              <div className="text-xs text-zinc-400">
                ${((pool?.total_pool || 10000000) * avloPrice).toFixed(2)} USD
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                Max Bet: {Math.floor(dynamicMaxBet).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          {/* Win Rate */}
          <Card className="bg-zinc-900/80 border-zinc-700/50 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span className="text-zinc-400 text-xs">Your Stats</span>
              </div>
              <div className="text-lg font-bold text-white">
                <span className="text-green-400">{stats.wins}W</span>
                <span className="text-zinc-500 mx-1">/</span>
                <span className="text-red-400">{stats.losses}L</span>
              </div>
            </CardContent>
          </Card>

          {/* Games Played */}
          <Card className="bg-zinc-900/80 border-zinc-700/50 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-orange-400" />
                <span className="text-zinc-400 text-xs">Total Games</span>
              </div>
              <div className="text-xl font-bold text-white">
                {pool?.games_played.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Game Table */}
        <Card className="bg-gradient-to-br from-emerald-950 via-green-950 to-emerald-950 border-2 border-emerald-600/50 backdrop-blur-xl overflow-hidden shadow-[inset_0_0_100px_rgba(16,185,129,0.1)]">
          <CardContent className="p-6 md:p-8 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.15),transparent_70%)]">
            {/* Dealer Area */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <span className="text-green-300 font-semibold text-lg">DEALER</span>
                {gameState !== 'betting' && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-zinc-800/90 to-zinc-900/90 border border-zinc-600 shadow-lg"
                  >
                    <span className="text-zinc-400 text-sm font-medium">SCORE</span>
                    <span className="text-3xl font-bold text-white tabular-nums">{calculateScore(dealerCards)}</span>
                  </motion.div>
                )}
              </div>
              <div className="flex items-center justify-center min-h-[150px]">
                <AnimatePresence>
                  {dealerCards.map((card, i) => renderCard(card, i))}
                </AnimatePresence>
              </div>
            </div>

            {/* Center Result Banner */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-dashed border-green-600/30" />
              </div>
              {result && resultDetails && (
                <div className="relative flex justify-center">
                  <motion.div
                    initial={{ scale: 0, y: 50, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    transition={{ type: "spring", damping: 15, stiffness: 300 }}
                    className={`relative px-8 py-5 rounded-2xl font-bold text-center overflow-hidden ${
                      result === 'blackjack' ? 'bg-zinc-900/95 border-2 border-emerald-400/60 shadow-[0_0_60px_rgba(16,185,129,0.4)]' :
                      result === 'win' ? 'bg-zinc-900/95 border-2 border-green-400/60 shadow-[0_0_40px_rgba(34,197,94,0.3)]' :
                      result === 'push' ? 'bg-zinc-800/95 border-2 border-zinc-500/50' :
                      'bg-zinc-900/95 border-2 border-red-500/60 shadow-[0_0_40px_rgba(239,68,68,0.3)]'
                    }`}
                  >
                    {/* Tech grid overlay */}
                    <div className="absolute inset-0 opacity-10" style={{
                      backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
                      backgroundSize: '20px 20px'
                    }} />
                    
                    {/* Glow effect for wins */}
                    {['win', 'blackjack'].includes(result) && (
                      <motion.div 
                        className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-emerald-500/10"
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                    
                    <div className="relative z-10">
                      {/* Result title */}
                      <motion.div 
                        className={`text-3xl font-black tracking-tight mb-2 ${
                          result === 'blackjack' ? 'bg-gradient-to-r from-emerald-400 via-green-300 to-emerald-400 bg-clip-text text-transparent' :
                          result === 'win' ? 'text-green-400' :
                          result === 'push' ? 'text-zinc-400' :
                          'text-red-400'
                        }`}
                        animate={result === 'blackjack' ? { scale: [1, 1.05, 1] } : {}}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      >
                        {result === 'blackjack' ? '♠ BLACKJACK ♠' :
                         result === 'win' ? '✓ WINNER' :
                         result === 'push' ? '↔ PUSH' :
                         result === 'bust' ? '✗ BUST' : '✗ DEALER WINS'}
                      </motion.div>
                      
                      {/* Amount display */}
                      <div className="flex items-center justify-center gap-3">
                        <img src={AvloTokenLogo} alt="AVLO" className="w-6 h-6 rounded-full ring-2 ring-white/20" />
                        <motion.span 
                          className={`text-2xl font-bold tabular-nums ${
                            ['win', 'blackjack'].includes(result) ? 'text-emerald-400' :
                            result === 'push' ? 'text-zinc-300' : 'text-red-400'
                          }`}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: "spring" }}
                        >
                          {['win', 'blackjack'].includes(result) ? (
                            <>+{Math.floor(resultDetails.payout - resultDetails.amount).toLocaleString()}</>
                          ) : result === 'push' ? (
                            <>↩ {resultDetails.amount.toLocaleString()}</>
                          ) : (
                            <>-{resultDetails.amount.toLocaleString()}</>
                          )}
                        </motion.span>
                        <span className="text-sm text-zinc-500 font-medium">AVLO</span>
                      </div>
                      
                      {/* Blackjack bonus indicator */}
                      {result === 'blackjack' && (
                        <motion.div 
                          className="mt-2 text-xs text-emerald-400/80 font-medium tracking-widest"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4 }}
                        >
                          3:2 PAYOUT BONUS
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </div>

            {/* Player Area */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-green-300 font-semibold text-lg">YOU</span>
                {gameState !== 'betting' && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/40 shadow-lg shadow-orange-500/20"
                  >
                    <span className="text-orange-300 text-sm font-medium">SCORE</span>
                    <span className="text-3xl font-bold text-orange-400 tabular-nums">{calculateScore(playerCards)}</span>
                  </motion.div>
                )}
              </div>
              <div className="flex items-center justify-center min-h-[150px]">
                <AnimatePresence>
                  {playerCards.map((card, i) => renderCard(card, i))}
                </AnimatePresence>
              </div>
            </div>

            {/* Controls */}
            <div className="mt-8">
              {gameState === 'betting' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 justify-center flex-wrap">
                    {/* Dynamic quick bet buttons based on user's spendable balance */}
                    {(() => {
                      const userMax = Math.min(Math.floor(spendableBalance), Math.floor(dynamicMaxBet));
                      // Generate smart amounts: 10%, 25%, 50%, 100% of user's max
                      const smartAmounts = [
                        Math.floor(userMax * 0.1),
                        Math.floor(userMax * 0.25),
                        Math.floor(userMax * 0.5),
                        userMax
                      ]
                        .filter(a => a >= (pool?.min_bet || 10)) // Filter out amounts below min bet
                        .filter((a, i, arr) => arr.indexOf(a) === i); // Remove duplicates
                      
                      // If user has low balance, show fixed small amounts
                      const fallbackAmounts = [100, 500, 1000, 5000].filter(a => a <= userMax && a >= (pool?.min_bet || 10));
                      const amounts = smartAmounts.length >= 2 ? smartAmounts : fallbackAmounts;
                      
                      return amounts.map((amount, idx) => (
                        <Button
                          key={amount}
                          variant="outline"
                          onClick={() => {
                            setBetAmount(amount.toString());
                            playSound('chip');
                          }}
                          className={`border-zinc-600 hover:border-orange-500 ${betAmount === amount.toString() ? 'bg-orange-500/20 border-orange-500' : ''}`}
                        >
                          <img src={AvloTokenLogo} alt="" className="w-4 h-4 rounded-full mr-2" />
                          {amount.toLocaleString()}
                          {idx === amounts.length - 1 && amounts.length > 1 && (
                            <span className="ml-1 text-xs text-orange-400">(MAX)</span>
                          )}
                        </Button>
                      ));
                    })()}
                  </div>
                  
                  <div className="flex items-center gap-3 justify-center">
                    <Input
                      type="number"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      placeholder={`Min: ${pool?.min_bet || 10}`}
                      className="w-40 bg-zinc-800/50 border-zinc-600 text-center text-lg text-white placeholder:text-zinc-500"
                    />
                    <Button
                      onClick={dealCards}
                      disabled={isLoading || !betAmount}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-8 py-3"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <>
                          <Zap className="w-5 h-5 mr-2" />
                          DEAL
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : gameState === 'playing' ? (
                <div className="flex items-center gap-4 justify-center">
                  <Button
                    onClick={hit}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold px-8 py-3"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        HIT
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={stand}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-zinc-600 to-zinc-700 hover:from-zinc-500 hover:to-zinc-600 text-white font-bold px-8 py-3"
                  >
                    STAND
                  </Button>
                </div>
              ) : gameState === 'dealer_turn' ? (
                <div className="flex justify-center">
                  <Badge className="bg-zinc-800 text-zinc-300 py-2 px-4">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Dealer's Turn...
                  </Badge>
                </div>
              ) : (
                <div className="flex justify-center">
                  <Button
                    onClick={resetGame}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-8 py-3"
                  >
                    NEW GAME
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>


        {/* Info */}
        <div className="mt-6 text-center text-zinc-500 text-sm">
          <p>Blackjack pays 3:2 • Dealer stands on 17 • 6 Deck Shoe</p>
          <p className="mt-1">Min Bet: {pool?.min_bet || 10} • Max Bet: {Math.floor(dynamicMaxBet).toLocaleString()} (1% of pool)</p>
        </div>
      </div>

    </div>
  );
}
