import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Users, Crown, Trophy, Timer,
  Coins, Armchair, LogOut, MessageCircle
} from 'lucide-react';
import AvloTokenLogo from '@/assets/avlo-token-logo.jpg';
import TableChat from '@/components/games/TableChat';
import PlayingCard from '@/components/games/PlayingCard';

interface TablePlayer {
  id: string;
  user_id: string;
  seat_number: number;
  bet_amount: number;
  is_ready: boolean;
  profile?: {
    username: string;
    avatar_url: string;
  };
}

interface BlackjackTable {
  id: string;
  table_number: number;
  table_name: string;
  status: 'waiting' | 'starting' | 'playing' | 'finished';
  min_bet: number;
  max_bet: number;
  current_players: number;
  max_players: number;
  current_round_id: string | null;
  next_round_at: string | null;
  players?: TablePlayer[];
}

// Removed unused TABLE_COLORS

export default function BlackJackLobby() {
  const navigate = useNavigate();
  const { profile } = useWalletAuth();
  const [tables, setTables] = useState<BlackjackTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<BlackjackTable | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState<string>('');
  const [joining, setJoining] = useState(false);
  const [myTableId, setMyTableId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Get session for auth header
  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  // Fetch tables
  const fetchTables = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('blackjack-multiplayer', {
        body: { action: 'getTables' }
      });
      
      if (error) throw error;
      setTables(data.tables || []);
      
      // Check if user is at a table
      const myTable = data.tables?.find((t: BlackjackTable) => 
        t.players?.some((p: TablePlayer) => p.user_id === profile?.id)
      );
      
      if (myTable) {
        setMyTableId(myTable.id);
        setSelectedTable(myTable);
        
        // If game is playing, navigate to game
        if (myTable.status === 'playing' && myTable.current_round_id) {
          navigate(`/blackjack-online/${myTable.id}`);
        }
      }
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('blackjack-lobby')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'blackjack_tables' },
        () => fetchTables()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'blackjack_table_players' },
        () => fetchTables()
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // Countdown timer
  useEffect(() => {
    if (!selectedTable?.next_round_at) {
      setCountdown(null);
      return;
    }
    
    const interval = setInterval(() => {
      const nextRound = new Date(selectedTable.next_round_at!).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((nextRound - now) / 1000));
      setCountdown(diff);
      
      if (diff === 0) {
        fetchTables();
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [selectedTable?.next_round_at]);

  const handleJoinTable = async (table: BlackjackTable, seatNumber: number) => {
    if (!profile) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    setJoining(true);
    try {
      // Use profile ID directly - this app uses wallet auth, not Supabase Auth
      const { data, error } = await supabase.functions.invoke('blackjack-multiplayer', {
        body: { 
          action: 'joinTable', 
          tableId: table.id, 
          seatNumber,
          userId: profile.id // Pass user ID directly
        }
      });
      
      if (error) throw new Error(error.message || 'Failed to join table');
      if (data?.error) throw new Error(data.error);
      
      setMyTableId(table.id);
      setSelectedTable(table);
      setSelectedSeat(seatNumber);
      toast.success(`Joined ${table.table_name}!`);
      fetchTables();
    } catch (err) {
      console.error('[BJ-Lobby] Join table error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveTable = async () => {
    if (!profile) return;
    
    try {
      const { error } = await supabase.functions.invoke('blackjack-multiplayer', {
        body: { action: 'leaveTable', userId: profile.id }
      });
      
      if (error) throw error;
      
      setMyTableId(null);
      setSelectedTable(null);
      setSelectedSeat(null);
      setBetAmount('');
      toast.success('Left table');
      fetchTables();
    } catch (err) {
      toast.error('Failed to leave table');
    }
  };

  const handlePlaceBet = async () => {
    if (!selectedTable || !betAmount || !profile) return;
    
    const bet = parseInt(betAmount);
    if (isNaN(bet) || bet < selectedTable.min_bet || bet > selectedTable.max_bet) {
      toast.error(`Bet must be between ${selectedTable.min_bet} and ${selectedTable.max_bet}`);
      return;
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('blackjack-multiplayer', {
        body: { action: 'placeBet', tableId: selectedTable.id, betAmount: bet, userId: profile.id }
      });
      
      if (error) throw new Error(error.message || 'Failed to place bet');
      if (data?.error) throw new Error(data.error);
      
      toast.success('Bet placed! Waiting for round to start...');
      fetchTables();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to place bet');
    }
  };

  const getMyPlayer = (): TablePlayer | undefined => {
    return selectedTable?.players?.find(p => p.user_id === profile?.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-pulse text-emerald-400 text-xl">Loading tables...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-emerald-950/20 to-black p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
              <Crown className="w-8 h-8 text-yellow-400" />
              Online BlackJack
            </h1>
            <p className="text-zinc-400 mt-1">Join a table and play against the dealer with other players</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => navigate('/blackjack')}
            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            Solo Mode
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tables Grid */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Available Tables
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tables.map((table) => {
              const isMyTable = table.id === myTableId;
              const availableSeat = [1, 2, 3, 4].find(seat => 
                !table.players?.some(p => p.seat_number === seat)
              );
              const isRed = table.table_number % 2 === 0;
              
              return (
                <motion.div
                  key={table.id}
                  whileHover={{ scale: 1.03, rotateY: 2 }}
                  whileTap={{ scale: 0.98 }}
                  className="cursor-pointer perspective-1000"
                  onClick={() => {
                    if (isMyTable) {
                      setSelectedTable(table);
                      return;
                    }
                    if (myTableId) {
                      toast.error('Leave your current table first');
                      return;
                    }
                    if (table.status === 'playing') {
                      toast.error('Game in progress, please wait');
                      return;
                    }
                    if (availableSeat) {
                      handleJoinTable(table, availableSeat);
                    } else {
                      toast.error('Table is full');
                    }
                  }}
                >
                {/* Playing Card Style - Black with white text */}
                  <div
                    className={`
                      relative w-full aspect-[2.5/3.5] rounded-xl overflow-hidden
                      transition-all duration-300
                      ${isMyTable ? 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-black' : ''}
                      shadow-2xl hover:shadow-emerald-500/20
                    `}
                    style={{
                      background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
                      boxShadow: `
                        0 20px 40px -10px rgba(0,0,0,0.8),
                        inset 0 1px 0 rgba(255,255,255,0.1),
                        inset 0 -1px 0 rgba(0,0,0,0.3)
                      `
                    }}
                  >
                    {/* Card texture */}
                    <div 
                      className="absolute inset-0 opacity-[0.05] pointer-events-none"
                      style={{
                        backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'4\' height=\'4\' viewBox=\'0 0 4 4\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M1 3h1v1H1V3zm2-2h1v1H3V1z\' fill=\'%23ffffff\' fill-opacity=\'1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")'
                      }}
                    />
                    
                    {/* Border glow */}
                    <div className="absolute inset-0 rounded-xl border border-white/10" />
                    
                    {/* Top-left corner */}
                    <div className="absolute top-3 left-3 text-center text-white">
                      <div className="text-xl font-bold leading-none">{table.table_number}</div>
                      <div className="text-2xl leading-none opacity-80">{isRed ? '♥' : '♠'}</div>
                    </div>
                    
                    {/* Bottom-right corner (rotated) */}
                    <div className="absolute bottom-3 right-3 text-center rotate-180 text-white">
                      <div className="text-xl font-bold leading-none">{table.table_number}</div>
                      <div className="text-2xl leading-none opacity-80">{isRed ? '♥' : '♠'}</div>
                    </div>
                    
                    {/* Center content */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                      <div className="text-4xl mb-2 text-white/80">
                        {isRed ? '♥' : '♠'}
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">{table.table_name}</h3>
                      <div className="flex items-center gap-1 text-sm text-zinc-400 mb-3">
                        <img src={AvloTokenLogo} className="w-4 h-4 rounded-full" />
                        <span>{table.min_bet.toLocaleString()} - {table.max_bet.toLocaleString()}</span>
                      </div>
                      
                      {/* Seats indicator */}
                      <div className="flex gap-1.5 mb-3">
                        {[1, 2, 3, 4].map((seat) => {
                          const player = table.players?.find(p => p.seat_number === seat);
                          return (
                            <div
                              key={seat}
                              className={`
                                w-7 h-7 rounded-full flex items-center justify-center text-xs
                                ${player 
                                  ? player.user_id === profile?.id
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-zinc-600 text-white'
                                  : 'bg-zinc-800 text-zinc-500 border border-dashed border-zinc-600'
                                }
                              `}
                            >
                              {player ? (
                                player.profile?.avatar_url ? (
                                  <img src={player.profile.avatar_url} className="w-full h-full rounded-full object-cover" />
                                ) : '👤'
                              ) : seat}
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Status badge */}
                      <Badge 
                        className={`
                          ${table.status === 'playing' 
                            ? 'bg-red-500 text-white' 
                            : 'bg-emerald-500 text-white'
                          }
                        `}
                      >
                        {table.status === 'playing' ? '🎮 In Game' : `${4 - (table.current_players || 0)} seats open`}
                      </Badge>
                    </div>
                    
                    {/* My table indicator */}
                    {isMyTable && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-emerald-500 text-white text-[10px] shadow-lg">YOU</Badge>
                      </div>
                    )}
                    
                    {/* Subtle edge glow */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none rounded-xl" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Selected Table Panel */}
        <div className="lg:col-span-1">
          <AnimatePresence mode="wait">
            {selectedTable ? (
              <motion.div
                key={selectedTable.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Card className="bg-zinc-900/80 border-zinc-800 p-6">
                  <h3 className="text-xl font-bold text-white mb-4">{selectedTable.table_name}</h3>
                  
                  {/* Countdown */}
                  {countdown !== null && countdown > 0 && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-4 text-center">
                      <div className="text-sm text-emerald-400">Next round in</div>
                      <div className="text-2xl font-bold text-emerald-300">{countdown}s</div>
                    </div>
                  )}

                  {myTableId === selectedTable.id ? (
                    /* Already at this table */
                    <div className="space-y-4">
                      {/* Players at table */}
                      <div className="bg-zinc-800/50 rounded-lg p-3">
                        <div className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Players at table
                        </div>
                        <div className="space-y-2">
                          {selectedTable.players?.map((player) => (
                            <div 
                              key={player.id}
                              className={`flex items-center gap-2 p-2 rounded-lg ${
                                player.user_id === profile?.id ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-zinc-700/30'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-full bg-zinc-600 overflow-hidden flex-shrink-0">
                                {player.profile?.avatar_url ? (
                                  <img src={player.profile.avatar_url} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-white text-xs">
                                    {player.seat_number}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate">
                                  {player.user_id === profile?.id ? 'You' : player.profile?.username || `Player ${player.seat_number}`}
                                </div>
                                <div className="text-xs text-zinc-400">Seat {player.seat_number}</div>
                              </div>
                              {player.is_ready && (
                                <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
                                  {player.bet_amount.toLocaleString()}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {!getMyPlayer()?.is_ready ? (
                        /* Bet Input */
                        <div className="space-y-3">
                          <label className="text-sm text-zinc-400">Place your bet</label>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              value={betAmount}
                              onChange={(e) => setBetAmount(e.target.value)}
                              placeholder={`${selectedTable.min_bet} - ${selectedTable.max_bet}`}
                              className="bg-zinc-800 border-zinc-700"
                            />
                            <Button 
                              onClick={handlePlaceBet}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              <Coins className="w-4 h-4 mr-1" />
                              Bet
                            </Button>
                          </div>
                          
                          {/* Quick bet buttons */}
                          <div className="flex gap-2 flex-wrap">
                            {[selectedTable.min_bet, selectedTable.min_bet * 2, selectedTable.min_bet * 5, selectedTable.max_bet].map((amount) => (
                              <Button
                                key={amount}
                                variant="outline"
                                size="sm"
                                onClick={() => setBetAmount(amount.toString())}
                                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                              >
                                {amount.toLocaleString()}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        /* Waiting for game */
                        <div className="text-center py-4">
                          <div className="text-emerald-400 font-semibold mb-2">
                            Bet: {getMyPlayer()?.bet_amount.toLocaleString()} AVLO
                          </div>
                          <div className="text-sm text-zinc-400">
                            Waiting for round to start...
                          </div>
                          <div className="mt-2 flex justify-center">
                            <div className="animate-pulse flex gap-1">
                              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                              <div className="w-2 h-2 bg-emerald-400 rounded-full animation-delay-200"></div>
                              <div className="w-2 h-2 bg-emerald-400 rounded-full animation-delay-400"></div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <Button
                        variant="outline"
                        onClick={handleLeaveTable}
                        className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Leave Table
                      </Button>
                    </div>
                  ) : (
                    /* Select seat to join */
                    <div className="space-y-4">
                      <div className="text-sm text-zinc-400">Select a seat to join</div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        {[1, 2, 3, 4].map((seat) => {
                          const player = selectedTable.players?.find(p => p.seat_number === seat);
                          const isAvailable = !player && selectedTable.status !== 'playing';
                          
                          return (
                            <Button
                              key={seat}
                              variant={selectedSeat === seat ? 'default' : 'outline'}
                              disabled={!isAvailable}
                              onClick={() => setSelectedSeat(seat)}
                              className={`
                                h-16 flex flex-col items-center justify-center
                                ${selectedSeat === seat 
                                  ? 'bg-emerald-600 hover:bg-emerald-700' 
                                  : 'border-zinc-700 hover:bg-zinc-800'
                                }
                                ${!isAvailable ? 'opacity-50' : ''}
                              `}
                            >
                              <Armchair className="w-5 h-5 mb-1" />
                              <span className="text-xs">
                                {player ? player.profile?.username || 'Taken' : `Seat ${seat}`}
                              </span>
                            </Button>
                          );
                        })}
                      </div>
                      
                      <Button
                        onClick={() => {
                          if (selectedTable && selectedSeat !== null) {
                            handleJoinTable(selectedTable, selectedSeat);
                          }
                        }}
                        disabled={selectedSeat === null || joining}
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                      >
                        {joining ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                            Joining...
                          </div>
                        ) : (
                          <>
                            <Coins className="w-4 h-4 mr-2" />
                            Join Table
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Table Info */}
                  <div className="mt-6 pt-4 border-t border-zinc-800">
                    <h4 className="text-sm font-semibold text-zinc-400 mb-2">Table Rules</h4>
                    <ul className="text-xs text-zinc-500 space-y-1">
                      <li>• Dealer stands on 17</li>
                      <li>• Blackjack pays 3:2</li>
                      <li>• Games start every 60 seconds</li>
                      <li>• Minimum 1 player to start</li>
                    </ul>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Card className="bg-zinc-900/50 border-zinc-800 p-6 text-center">
                  <Armchair className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-zinc-400">Select a Table</h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    Click on a table to view details and join
                  </p>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Table Chat - only show when at a table */}
      {myTableId && selectedTable && (
        <TableChat 
          tableId={myTableId} 
          tableName={selectedTable.table_name} 
        />
      )}
    </div>
  );
}
