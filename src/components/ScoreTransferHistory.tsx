import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRightLeft, TrendingUp, TrendingDown, Clock, ChevronDown, ChevronUp, User } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getAvatarUrl } from '@/lib/defaultAvatars';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface ScoreTransfer {
  id: string;
  payer_id: string;
  recipient_id: string;
  amount_usd: number;
  score_transferred: number;
  payment_tx_hash: string | null;
  created_at: string;
  payer?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  recipient?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface ScoreTransferHistoryProps {
  userId: string;
  compact?: boolean;
}

export function ScoreTransferHistory({ userId, compact = false }: ScoreTransferHistoryProps) {
  const [transfers, setTransfers] = useState<ScoreTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!compact);
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTransfers();
  }, [userId]);

  const fetchTransfers = async () => {
    try {
      // Use hinted relationships to avoid ambiguity
      const { data, error } = await supabase
        .from('score_transfers')
        .select(`
          id,
          payer_id,
          recipient_id,
          amount_usd,
          score_transferred,
          payment_tx_hash,
          created_at
        `)
        .or(`payer_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Fetch profiles separately
      if (data && data.length > 0) {
        const userIds = new Set<string>();
        data.forEach(t => {
          userIds.add(t.payer_id);
          userIds.add(t.recipient_id);
        });
        
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', Array.from(userIds));
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        const enrichedTransfers = data.map(t => ({
          ...t,
          payer: profileMap.get(t.payer_id),
          recipient: profileMap.get(t.recipient_id)
        }));
        
        setTransfers(enrichedTransfers as ScoreTransfer[]);
      } else {
        setTransfers([]);
      }
    } catch (error) {
      console.error('Error fetching score transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const displayedTransfers = showAll ? transfers : transfers.slice(0, 5);
  
  // Calculate totals
  const stolenFromOthers = transfers
    .filter(t => t.payer_id === userId)
    .reduce((sum, t) => sum + t.score_transferred, 0);
  
  const stolenByOthers = transfers
    .filter(t => t.recipient_id === userId)
    .reduce((sum, t) => sum + t.score_transferred, 0);

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <ArrowRightLeft className="w-5 h-5 text-primary" />
          <span className="text-foreground font-medium">Score Transfers</span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (transfers.length === 0) {
    return null; // Don't show section if no transfers
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => compact && setExpanded(!expanded)}
        className={`w-full p-4 flex items-center justify-between ${compact ? 'cursor-pointer hover:bg-muted/30' : ''}`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <ArrowRightLeft className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-left">
            <h3 className="text-foreground font-semibold">Score Transfers</h3>
            <p className="text-muted-foreground text-sm">{transfers.length} transfers</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Quick Stats */}
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
              <span>+{stolenFromOthers}</span>
            </div>
            <div className="flex items-center gap-1.5 text-destructive">
              <TrendingDown className="w-4 h-4" />
              <span>-{stolenByOthers}</span>
            </div>
          </div>
          
          {compact && (
            expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 space-y-2">
              {displayedTransfers.map((transfer, index) => {
                const isGain = transfer.payer_id === userId;
                const otherUser = isGain ? transfer.recipient : transfer.payer;
                
                return (
                  <motion.div
                    key={transfer.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      isGain 
                        ? 'bg-emerald-500/10 border border-emerald-500/20' 
                        : 'bg-destructive/10 border border-destructive/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Direction Icon */}
                      <div className={`p-1.5 rounded-full ${isGain ? 'bg-emerald-500/20' : 'bg-destructive/20'}`}>
                        {isGain ? (
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                      
                      {/* Other User */}
                      <button
                        onClick={() => otherUser && navigate(`/profile/${otherUser.id}`)}
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={getAvatarUrl(otherUser?.avatar_url || null, otherUser?.username || '')} />
                          <AvatarFallback className="bg-muted text-xs">
                            {otherUser?.username?.[0]?.toUpperCase() || <User className="w-3 h-3" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-left">
                          <p className="text-foreground text-sm font-medium">
                            {isGain ? 'Stole from' : 'Lost to'}{' '}
                            <span className={isGain ? 'text-emerald-400' : 'text-destructive'}>
                              @{otherUser?.username || 'Unknown'}
                            </span>
                          </p>
                          <p className="text-muted-foreground text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(transfer.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </button>
                    </div>
                    
                    {/* Score Amount */}
                    <div className="text-right">
                      <p className={`font-bold ${isGain ? 'text-emerald-400' : 'text-destructive'}`}>
                        {isGain ? '+' : '-'}{transfer.score_transferred} score
                      </p>
                      <p className="text-muted-foreground text-xs">
                        ${transfer.amount_usd.toFixed(2)} paid
                      </p>
                    </div>
                  </motion.div>
                );
              })}
              
              {/* Show More Button */}
              {transfers.length > 5 && (
                <Button
                  variant="ghost"
                  onClick={() => setShowAll(!showAll)}
                  className="w-full text-muted-foreground hover:text-foreground mt-2"
                >
                  {showAll ? 'Show Less' : `Show All (${transfers.length})`}
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
