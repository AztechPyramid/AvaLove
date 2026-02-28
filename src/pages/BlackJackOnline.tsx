import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Crown, Users } from 'lucide-react';
import AvloTokenLogo from '@/assets/avlo-token-logo.jpg';
import PlayingCard from '@/components/games/PlayingCard';

type Suit = '♠' | '♥' | '♦' | '♣';
type CardValue = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

interface PlayingCard {
  suit: Suit;
  value: CardValue;
  hidden?: boolean;
}

interface PlayerHand {
  id: string;
  player_id: string;
  seat_number: number;
  cards: PlayingCard[];
  score: number;
  bet_amount: number;
  status: 'waiting' | 'playing' | 'stand' | 'bust' | 'blackjack';
  result?: 'win' | 'lose' | 'push' | 'blackjack';
  payout: number;
  turn_order: number;
  player?: {
    username: string;
    avatar_url: string;
  };
}

interface Round {
  id: string;
  table_id: string;
  status: 'betting' | 'dealing' | 'player_turns' | 'dealer_turn' | 'finished';
  dealer_cards: PlayingCard[];
  dealer_score: number;
  total_pot: number;
  hands?: PlayerHand[];
}

interface TableData {
  id: string;
  table_name: string;
  current_round_id: string;
  status: string;
}

// Sound effects
const playSound = (type: 'card' | 'win' | 'lose' | 'chip') => {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const sounds: Record<string, { freq: number; dur: number; type: OscillatorType }> = {
      card: { freq: 800, dur: 0.1, type: 'sine' },
      win: { freq: 523, dur: 0.3, type: 'sine' },
      lose: { freq: 200, dur: 0.3, type: 'triangle' },
      chip: { freq: 1200, dur: 0.05, type: 'square' },
    };
    
    const s = sounds[type];
    osc.frequency.value = s.freq;
    osc.type = s.type;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + s.dur);
    osc.start();
    osc.stop(ctx.currentTime + s.dur);
  } catch (e) {
    console.log('Sound play failed:', e);
  }
};

function calculateDisplayScore(cards: PlayingCard[]): number {
  let score = 0;
  let aces = 0;
  
  for (const card of cards) {
    if (card.hidden) continue;
    if (['J', 'Q', 'K'].includes(card.value)) score += 10;
    else if (card.value === 'A') { score += 11; aces++; }
    else score += parseInt(card.value);
  }
  
  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }
  
  return score;
}

export default function BlackJackOnline() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { profile } = useWalletAuth();
  
  const [table, setTable] = useState<TableData | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRoundState = useCallback(async () => {
    if (!tableId) return;
    
    try {
      // Get table info
      const { data: tableData } = await supabase
        .from('blackjack_tables')
        .select('*')
        .eq('id', tableId)
        .single();
      
      if (tableData) {
        setTable(tableData);
        
        if (tableData.current_round_id) {
          const { data } = await supabase.functions.invoke('blackjack-multiplayer', {
            body: { action: 'getRoundState', roundId: tableData.current_round_id }
          });
          
          if (data?.round) {
            setRound(data.round);
          }
        } else if (tableData.status === 'waiting') {
          navigate('/blackjack-lobby');
        }
      }
    } catch (err) {
      console.error('Failed to fetch round:', err);
    } finally {
      setLoading(false);
    }
  }, [tableId, navigate]);

  useEffect(() => {
    fetchRoundState();
    
    // Realtime updates
    const channel = supabase
      .channel(`blackjack-game-${tableId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'blackjack_rounds', filter: `table_id=eq.${tableId}` },
        () => fetchRoundState()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'blackjack_player_hands' },
        () => fetchRoundState()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'blackjack_tables', filter: `id=eq.${tableId}` },
        () => fetchRoundState()
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId, fetchRoundState]);

  const handleHit = async () => {
    if (!round) return;
    setActionLoading(true);
    try {
      playSound('card');
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('blackjack-multiplayer', {
        body: { action: 'hit', roundId: round.id },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await fetchRoundState();
    } catch (err) {
      toast.error('Failed to hit');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStand = async () => {
    if (!round) return;
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('blackjack-multiplayer', {
        body: { action: 'stand', roundId: round.id },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await fetchRoundState();
    } catch (err) {
      toast.error('Failed to stand');
    } finally {
      setActionLoading(false);
    }
  };

  const getMyHand = (): PlayerHand | undefined => {
    return round?.hands?.find(h => h.player_id === profile?.id);
  };

  const isMyTurn = (): boolean => {
    const myHand = getMyHand();
    return myHand?.status === 'playing';
  };

  // Removed old renderCard function - now using PlayingCard component

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-pulse text-emerald-400 text-xl">Loading game...</div>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="text-zinc-400">No active round</div>
        <Button onClick={() => navigate('/blackjack-lobby')}>
          Back to Lobby
        </Button>
      </div>
    );
  }

  const myHand = getMyHand();
  const dealerScore = calculateDisplayScore(round.dealer_cards);
  const sortedHands = [...(round.hands || [])].sort((a, b) => a.seat_number - b.seat_number);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 p-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate('/blackjack-lobby')}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Lobby
          </Button>
          
          <div className="flex items-center gap-4">
            <Badge className="bg-yellow-500/20 text-yellow-400">
              <img src={AvloTokenLogo} className="w-4 h-4 rounded-full mr-1" />
              Pot: {round.total_pot.toLocaleString()}
            </Badge>
            <Badge variant="outline" className="text-white">
              <Users className="w-4 h-4 mr-1" />
              {round.hands?.length || 0} Players
            </Badge>
          </div>
        </div>
      </div>

      {/* Game Table */}
      <div className="max-w-6xl mx-auto">
        <div className="relative bg-gradient-to-br from-emerald-800 to-emerald-900 rounded-3xl border-8 border-amber-900/50 shadow-2xl min-h-[70vh] p-6">
          {/* Felt pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none rounded-2xl"
            style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}
          />

          {/* Dealer Section */}
          <div className="text-center mb-8">
            <div className="text-amber-300/70 text-sm mb-2">DEALER</div>
          <div className="flex justify-center items-end min-h-[7rem]">
            {round.dealer_cards.map((card, i) => (
              <PlayingCard 
                key={`dealer-${i}`}
                suit={card.suit} 
                value={card.value} 
                hidden={card.hidden} 
                index={i}
                size="lg"
              />
            ))}
          </div>
            <motion.div
              className="mt-3 inline-block bg-black/40 px-4 py-1 rounded-full"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              <span className="text-2xl font-bold text-white">{dealerScore}</span>
            </motion.div>
          </div>

          {/* Result Banner */}
          <AnimatePresence>
            {round.status === 'finished' && myHand?.result && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
              >
                <div className={`
                  px-8 py-4 rounded-2xl border-2 shadow-2xl text-center
                  ${myHand.result === 'win' || myHand.result === 'blackjack'
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 border-emerald-400'
                    : myHand.result === 'push'
                    ? 'bg-gradient-to-r from-zinc-600 to-zinc-500 border-zinc-400'
                    : 'bg-gradient-to-r from-red-600 to-red-500 border-red-400'
                  }
                `}>
                  <div className="text-2xl font-bold text-white mb-1">
                    {myHand.result === 'blackjack' ? '🎰 BLACKJACK!' :
                     myHand.result === 'win' ? '🏆 YOU WIN!' :
                     myHand.result === 'push' ? '🤝 PUSH' : '💀 YOU LOSE'}
                  </div>
                  <div className="flex items-center justify-center gap-2 text-lg text-white">
                    <img src={AvloTokenLogo} className="w-5 h-5 rounded-full" />
                    <span>
                      {myHand.result === 'lose' 
                        ? `-${myHand.bet_amount.toLocaleString()}`
                        : `+${(myHand.payout - myHand.bet_amount).toLocaleString()}`
                      }
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Players Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-auto">
            {sortedHands.map((hand) => {
              const isMe = hand.player_id === profile?.id;
              const isCurrentTurn = hand.status === 'playing';
              const handScore = calculateDisplayScore(hand.cards);
              
              return (
                <motion.div
                  key={hand.id}
                  className={`
                    relative p-4 rounded-xl transition-all duration-300
                    ${isMe 
                      ? 'bg-emerald-600/30 ring-2 ring-emerald-400' 
                      : 'bg-black/20'
                    }
                    ${isCurrentTurn ? 'ring-2 ring-yellow-400 animate-pulse' : ''}
                  `}
                >
                  {/* Player Info */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-zinc-700 overflow-hidden">
                      {hand.player?.avatar_url ? (
                        <img src={hand.player.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-sm">
                          {hand.seat_number}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">
                        {isMe ? 'You' : hand.player?.username || `Player ${hand.seat_number}`}
                      </div>
                      <div className="text-xs text-yellow-400 flex items-center gap-1">
                        <img src={AvloTokenLogo} className="w-3 h-3 rounded-full" />
                        {hand.bet_amount.toLocaleString()}
                      </div>
                    </div>
                    {hand.status === 'playing' && (
                      <Crown className="w-4 h-4 text-yellow-400 animate-bounce" />
                    )}
                  </div>

                  {/* Cards */}
                  <div className="flex justify-center items-end min-h-[5rem] scale-75 origin-center">
                    {hand.cards.map((card, i) => (
                      <PlayingCard 
                        key={`player-${hand.id}-${i}`}
                        suit={card.suit} 
                        value={card.value} 
                        index={i}
                        size="md"
                      />
                    ))}
                  </div>

                  {/* Score & Status */}
                  <div className="mt-2 flex items-center justify-between">
                    <Badge className={`
                      ${hand.status === 'bust' ? 'bg-red-500' :
                        hand.status === 'blackjack' ? 'bg-yellow-500' :
                        hand.status === 'stand' ? 'bg-blue-500' :
                        'bg-zinc-600'
                      }
                    `}>
                      {handScore}
                    </Badge>
                    
                    {round.status === 'finished' && hand.result && (
                      <Badge className={`
                        ${hand.result === 'win' || hand.result === 'blackjack' ? 'bg-emerald-500' :
                          hand.result === 'push' ? 'bg-zinc-500' : 'bg-red-500'
                        }
                      `}>
                        {hand.result === 'blackjack' ? 'BJ!' :
                         hand.result === 'win' ? 'WIN' :
                         hand.result === 'push' ? 'PUSH' : 'LOSE'}
                      </Badge>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Action Buttons */}
          {isMyTurn() && round.status === 'player_turns' && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-4 z-30"
            >
              <Button
                size="lg"
                onClick={handleHit}
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8 shadow-lg"
              >
                HIT
              </Button>
              <Button
                size="lg"
                onClick={handleStand}
                disabled={actionLoading}
                className="bg-amber-600 hover:bg-amber-700 text-lg px-8 shadow-lg"
              >
                STAND
              </Button>
            </motion.div>
          )}

          {/* Game Status */}
          {round.status === 'dealer_turn' && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-full">
              <div className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                Dealer's Turn...
              </div>
            </div>
          )}

          {round.status === 'finished' && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2"
            >
              <Button
                size="lg"
                onClick={() => navigate('/blackjack-lobby')}
                className="bg-white text-black hover:bg-gray-100"
              >
                Back to Lobby
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
