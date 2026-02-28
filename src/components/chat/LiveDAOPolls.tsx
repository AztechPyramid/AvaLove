import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Vote, ChevronRight, ChevronLeft, Check, Loader2, Clock, Users, ExternalLink, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAvloBalance } from '@/hooks/useAvloBalance';

interface Proposal {
  id: string;
  title: string;
  description: string | null;
  options: string[];
  total_votes: number;
  ends_at: string;
  status: string;
  created_by: string;
  created_at: string;
  image_urls?: string[];
}

interface VotesByOption {
  [key: number]: number;
}

interface LiveDAOPollsProps {
  maxVisible?: number;
}

export default function LiveDAOPolls({ maxVisible = 3 }: LiveDAOPollsProps) {
  const { profile } = useWalletAuth();
  const navigate = useNavigate();
  const { balance: userCredits } = useAvloBalance();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
  const [votesByProposal, setVotesByProposal] = useState<Record<string, VotesByOption>>({});
  const [voting, setVoting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveProposals();
    
    // Poll every 60s instead of realtime
    const interval = setInterval(() => {
      fetchActiveProposals();
      fetchVotes();
      fetchUserVotes();
    }, 60000);

    return () => clearInterval(interval);
  }, [profile?.id]);

  useEffect(() => {
    if (proposals.length > 0) {
      fetchVotes();
      fetchUserVotes();
    }
  }, [proposals.length, profile?.id]);

  const fetchActiveProposals = async () => {
    try {
      const { data, error } = await supabase
        .from('community_proposals')
        .select('*')
        .eq('status', 'active')
        .gt('ends_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(maxVisible);

      if (error) throw error;
      
      // Parse options - they are stored as string array, not object array
      const parsed = (data || []).map(p => ({
        ...p,
        options: typeof p.options === 'string' ? JSON.parse(p.options) : (p.options || []),
        image_urls: p.image_urls || []
      }));
      
      setProposals(parsed);
    } catch (err) {
      console.error('Error fetching proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVotes = async () => {
    if (proposals.length === 0) return;
    
    try {
      const proposalIds = proposals.map(p => p.id);
      const { data, error } = await supabase
        .from('community_votes')
        .select('proposal_id, option_index, vote_power')
        .in('proposal_id', proposalIds);

      if (error) throw error;

      const voteMap: Record<string, VotesByOption> = {};
      data?.forEach(vote => {
        if (!voteMap[vote.proposal_id]) {
          voteMap[vote.proposal_id] = {};
        }
        voteMap[vote.proposal_id][vote.option_index] = 
          (voteMap[vote.proposal_id][vote.option_index] || 0) + vote.vote_power;
      });

      setVotesByProposal(voteMap);
    } catch (error) {
      console.error('Error fetching votes:', error);
    }
  };

  const fetchUserVotes = async () => {
    if (!profile?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('community_votes')
        .select('proposal_id, option_index')
        .eq('user_id', profile.id);

      if (error) throw error;
      
      const votes: Record<string, number> = {};
      data?.forEach(v => {
        votes[v.proposal_id] = v.option_index;
      });
      setUserVotes(votes);
    } catch (err) {
      console.error('Error fetching user votes:', err);
    }
  };

  const handleVote = async (proposalId: string, optionIndex: number) => {
    if (!profile?.id) {
      toast.error('Please connect your wallet to vote');
      return;
    }

    if (userVotes[proposalId] !== undefined) {
      toast.error('You have already voted on this poll');
      return;
    }

    setVoting(proposalId);
    try {
      // Check if already voted
      const { data: existingVote } = await supabase
        .from('community_votes')
        .select('id')
        .eq('proposal_id', proposalId)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existingVote) {
        // Update existing vote
        const { error: updateError } = await supabase
          .from('community_votes')
          .update({ option_index: optionIndex })
          .eq('id', existingVote.id);

        if (updateError) throw updateError;
      } else {
        // Insert new vote (1 vote per user, no credit cost)
        const { error: voteError } = await supabase
          .from('community_votes')
          .insert({
            proposal_id: proposalId,
            user_id: profile.id,
            option_index: optionIndex,
            vote_power: 1,
          });

        if (voteError) throw voteError;
      }

      setUserVotes(prev => ({ ...prev, [proposalId]: optionIndex }));
      toast.success('Vote recorded! 🗳️');
      fetchVotes();
    } catch (err: any) {
      console.error('Error voting:', err);
      toast.error(err.message || 'Failed to vote');
    } finally {
      setVoting(null);
    }
  };

  const nextProposal = () => {
    setCurrentIndex(prev => (prev + 1) % proposals.length);
  };

  const prevProposal = () => {
    setCurrentIndex(prev => (prev - 1 + proposals.length) % proposals.length);
  };

  const getTotalVotes = (proposalId: string): number => {
    const votes = votesByProposal[proposalId];
    if (!votes) return 0;
    return Object.values(votes).reduce((sum, v) => sum + v, 0);
  };

  const getOptionVotes = (proposalId: string, optionIndex: number): number => {
    return votesByProposal[proposalId]?.[optionIndex] || 0;
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-zinc-500">No active polls</p>
        <Button 
          variant="ghost" 
          size="sm" 
          className="mt-2 text-orange-400 hover:text-orange-300"
          onClick={() => navigate('/dao')}
        >
          View All DAO <ExternalLink className="w-3 h-3 ml-1" />
        </Button>
      </div>
    );
  }

  const currentProposal = proposals[currentIndex];
  const hasVoted = userVotes[currentProposal.id] !== undefined;
  const votedOption = userVotes[currentProposal.id];
  const totalVotes = getTotalVotes(currentProposal.id);
  const optionImages = currentProposal.image_urls || [];

  return (
    <div className="relative bg-gradient-to-b from-zinc-900/80 to-black/60 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 border-b border-orange-500/20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center">
            <Vote className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold bg-gradient-to-r from-orange-300 to-amber-300 text-transparent bg-clip-text">
            LIVE DAO POLLS
          </span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {proposals.length > 1 && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
                onClick={prevProposal}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-zinc-400 font-medium min-w-[40px] text-center">
                {currentIndex + 1} / {proposals.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
                onClick={nextProposal}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-orange-400 hover:text-orange-300 hover:bg-zinc-800"
            onClick={() => navigate('/dao')}
          >
            View All <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>

      {/* Poll Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentProposal.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="p-4 space-y-4"
        >
          {/* Title & Stats */}
          <div>
            <h4 className="text-sm font-bold text-white leading-snug mb-2">
              {currentProposal.title}
            </h4>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Users className="w-3.5 h-3.5 text-orange-400" />
                <span className="font-medium text-white">{totalVotes}</span> vote{totalVotes !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Ends {formatDistanceToNow(new Date(currentProposal.ends_at), { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {(currentProposal.options as string[]).map((optionText, idx) => {
              const votes = getOptionVotes(currentProposal.id, idx);
              const percentage = totalVotes > 0 
                ? Math.round((votes / totalVotes) * 100)
                : 0;
              const isVotedOption = votedOption === idx;
              const optionImage = optionImages[idx];

              return (
                <motion.button
                  key={idx}
                  onClick={() => !hasVoted && !voting && handleVote(currentProposal.id, idx)}
                  disabled={hasVoted || voting === currentProposal.id}
                  className={`
                    relative w-full rounded-xl text-left overflow-hidden
                    transition-all duration-300 group
                    ${hasVoted 
                      ? isVotedOption 
                        ? 'ring-2 ring-orange-500/60 bg-gradient-to-r from-orange-500/20 to-amber-500/10' 
                        : 'bg-zinc-800/40'
                      : 'bg-zinc-800/60 hover:bg-zinc-700/60 hover:ring-2 hover:ring-orange-500/40 cursor-pointer'
                    }
                    ${voting === currentProposal.id ? 'opacity-60 pointer-events-none' : ''}
                  `}
                  whileHover={!hasVoted ? { scale: 1.01 } : {}}
                  whileTap={!hasVoted ? { scale: 0.99 } : {}}
                >
                  {/* Progress bar background */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                    className={`absolute inset-y-0 left-0 ${
                      isVotedOption 
                        ? 'bg-gradient-to-r from-orange-500/40 to-amber-500/20' 
                        : 'bg-zinc-700/30'
                    }`}
                  />

                  <div className="relative flex items-center gap-3 p-3">
                    {/* Option Image/Logo */}
                    {optionImage ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                        <img 
                          src={optionImage} 
                          alt={optionText}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center flex-shrink-0 ring-1 ring-white/5">
                        <span className="text-lg font-bold text-zinc-500">{idx + 1}</span>
                      </div>
                    )}

                    {/* Option Text */}
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-medium block truncate ${
                        isVotedOption ? 'text-orange-200' : 'text-white'
                      }`}>
                        {optionText}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {votes} AVLO vote{votes !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Right side: Percentage & Check */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-sm font-bold ${
                        isVotedOption ? 'text-orange-400' : percentage > 0 ? 'text-zinc-300' : 'text-zinc-500'
                      }`}>
                        {percentage > 0 ? `${percentage}%` : '0%'}
                      </span>
                      {isVotedOption && (
                        <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {voting === currentProposal.id && (
                        <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Vote prompt with credit info */}
          {!hasVoted && (
            <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500">
              <Coins className="w-3 h-3 text-orange-400" />
              {profile?.id ? (
                <span>
                  Tap to vote with <span className="text-orange-400 font-medium">{Math.floor(userCredits)} AVLO</span> credits
                </span>
              ) : (
                <span>Connect wallet to vote</span>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
