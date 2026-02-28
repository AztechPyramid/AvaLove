import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Vote, Plus, Clock, Users, Zap, CheckCircle2, XCircle, Trophy, Sparkles, TrendingUp, Image, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { useAvloBalance } from '@/hooks/useAvloBalance';
import { formatDistanceToNow, addDays } from 'date-fns';

interface Proposal {
  id: string;
  title: string;
  description: string | null;
  proposal_type: 'yes_no' | 'multiple_choice';
  options: string[];
  created_by: string;
  created_at: string;
  ends_at: string;
  status: 'active' | 'ended' | 'cancelled';
  total_votes: number;
  image_urls?: string[] | null;
  creator?: {
    username: string | null;
    display_name: string | null;
  };
}

interface VotesByOption {
  [key: number]: number;
}

const DAO = () => {
  const { profile, walletAddress } = useWalletAuth();
  const { balance: avloBalance, refresh: refreshBalance } = useAvloBalance();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [voteDialogOpen, setVoteDialogOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [votesByProposal, setVotesByProposal] = useState<Record<string, VotesByOption>>({});
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [proposalType, setProposalType] = useState<'yes_no' | 'multiple_choice'>('yes_no');
  const [options, setOptions] = useState(['', '', '', '']);
  const [optionImages, setOptionImages] = useState<(string | null)[]>([null, null, null, null]);
  const [duration, setDuration] = useState('7');
  
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingOptionIndex, setUploadingOptionIndex] = useState<number | null>(null);
  const optionImageInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    fetchProposals();
    checkAdminStatus();
  }, [profile?.id]);

  useEffect(() => {
    if (proposals.length > 0 && profile?.id) {
      fetchVotes();
      fetchUserVotes();
    }
  }, [proposals, profile?.id]);

  const checkAdminStatus = async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase.rpc('has_role', {
        _user_id: profile.id,
        _role: 'admin'
      });
      setIsAdmin(data === true);
    } catch (error) {
      console.error('Error checking admin:', error);
    }
  };

  const fetchProposals = async () => {
    try {
      const { data, error } = await supabase
        .from('community_proposals')
        .select(`
          *,
          creator:created_by(username, display_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Parse options from JSONB
      const parsed = (data || []).map(p => ({
        ...p,
        options: typeof p.options === 'string' ? JSON.parse(p.options) : p.options
      }));
      
      setProposals(parsed as Proposal[]);
    } catch (error) {
      console.error('Error fetching proposals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVotes = async () => {
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
        .select('proposal_id, option_index, vote_power')
        .eq('user_id', profile.id);

      if (error) throw error;

      // Group votes by proposal and sum vote_power for each option
      const userVoteMap: Record<string, { option_index: number; total_power: number }> = {};
      data?.forEach(vote => {
        if (!userVoteMap[vote.proposal_id]) {
          userVoteMap[vote.proposal_id] = { option_index: vote.option_index, total_power: vote.vote_power };
        } else {
          userVoteMap[vote.proposal_id].total_power += vote.vote_power;
        }
      });

      // Convert to simple option_index map for display
      const simpleMap: Record<string, number> = {};
      Object.entries(userVoteMap).forEach(([proposalId, data]) => {
        simpleMap[proposalId] = data.option_index;
      });

      setUserVotes(simpleMap);
    } catch (error) {
      console.error('Error fetching user votes:', error);
    }
  };

  const handleOptionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, optionIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please select an image file', variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'Image must be less than 5MB', variant: 'destructive' });
      return;
    }

    setUploadingOptionIndex(optionIndex);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile?.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('proposal-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('proposal-images')
        .getPublicUrl(fileName);

      setOptionImages(prev => {
        const newImages = [...prev];
        newImages[optionIndex] = publicUrl;
        return newImages;
      });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({ title: 'Error', description: 'Failed to upload image', variant: 'destructive' });
    } finally {
      setUploadingOptionIndex(null);
      if (optionImageInputRefs.current[optionIndex]) {
        optionImageInputRefs.current[optionIndex]!.value = '';
      }
    }
  };

  const removeOptionImage = (optionIndex: number) => {
    setOptionImages(prev => {
      const newImages = [...prev];
      newImages[optionIndex] = null;
      return newImages;
    });
  };

  const createProposal = async () => {
    if (!newTitle.trim()) {
      toast({ title: 'Error', description: 'Title is required', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const finalOptions = proposalType === 'yes_no' 
        ? ['Yes', 'No']
        : options.filter(o => o.trim());

      if (proposalType === 'multiple_choice' && finalOptions.length < 2) {
        toast({ title: 'Error', description: 'At least 2 options required', variant: 'destructive' });
        setSubmitting(false);
        return;
      }

      // Filter option images to match the options that have content
      const finalOptionImages = proposalType === 'yes_no' 
        ? [null, null]
        : options.map((opt, i) => opt.trim() ? optionImages[i] : null).filter((_, i) => options[i].trim());

      const { error } = await supabase
        .from('community_proposals')
        .insert({
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          proposal_type: proposalType,
          options: finalOptions,
          created_by: profile!.id,
          ends_at: addDays(new Date(), parseInt(duration)).toISOString(),
          image_urls: finalOptionImages.some(img => img !== null) ? finalOptionImages : null,
        });

      if (error) throw error;

      toast({ title: 'Success', description: 'Proposal created!' });
      setCreateDialogOpen(false);
      setNewTitle('');
      setNewDescription('');
      setOptions(['', '', '', '']);
      setOptionImages([null, null, null, null]);
      fetchProposals();
    } catch (error: any) {
      console.error('Error creating proposal:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const submitVote = async () => {
    if (selectedOption === null || !selectedProposal) return;

    setSubmitting(true);
    try {
      // Check if user already voted on this proposal
      const { data: existingVotes, error: fetchError } = await supabase
        .from('community_votes')
        .select('id, vote_power, option_index')
        .eq('proposal_id', selectedProposal.id)
        .eq('user_id', profile!.id);

      if (fetchError) throw fetchError;

      // Find vote for the same option, if any
      const sameOptionVote = existingVotes?.find(v => v.option_index === selectedOption);

      // Each vote counts as 1 (no credit spending)
      const voteWeight = 1;

      if (sameOptionVote) {
        // Already voted for this option
        toast({ title: 'Already Voted', description: 'You already voted for this option' });
        setVoteDialogOpen(false);
        return;
      } else if (existingVotes && existingVotes.length > 0) {
        // User voted on different option before - update the vote
        const { error: updateError } = await supabase
          .from('community_votes')
          .update({
            option_index: selectedOption,
          })
          .eq('id', existingVotes[0].id);

        if (updateError) throw updateError;
      } else {
        // Insert new vote
        const { error: voteError } = await supabase
          .from('community_votes')
          .insert({
            proposal_id: selectedProposal.id,
            user_id: profile!.id,
            option_index: selectedOption,
            vote_power: voteWeight,
          });

        if (voteError) throw voteError;

        // Update total votes only for new votes
        await supabase
          .from('community_proposals')
          .update({ total_votes: (selectedProposal.total_votes || 0) + voteWeight })
          .eq('id', selectedProposal.id);
      }

      toast({ title: 'Vote Submitted!', description: 'Your vote has been recorded' });
      setVoteDialogOpen(false);
      setSelectedProposal(null);
      setSelectedOption(null);
      fetchProposals();
      fetchVotes();
      fetchUserVotes();
    } catch (error: any) {
      console.error('Error voting:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const getVotesForOption = (proposalId: string, optionIndex: number): number => {
    return votesByProposal[proposalId]?.[optionIndex] || 0;
  };

  const getTotalVotesForProposal = (proposalId: string): number => {
    const votes = votesByProposal[proposalId] || {};
    return Object.values(votes).reduce((sum, v) => sum + v, 0);
  };

  const getPercentage = (proposalId: string, optionIndex: number): number => {
    const total = getTotalVotesForProposal(proposalId);
    if (total === 0) return 0;
    return (getVotesForOption(proposalId, optionIndex) / total) * 100;
  };

  const isProposalActive = (proposal: Proposal): boolean => {
    return proposal.status === 'active' && new Date(proposal.ends_at) > new Date();
  };

  // Check if user has voted and has no more credits to add
  const canVoteAgain = (proposalId: string): boolean => {
    return Math.floor(avloBalance) >= 1;
  };

  const hasUserVoted = (proposalId: string): boolean => {
    return userVotes[proposalId] !== undefined;
  };

  const deleteProposal = async (proposalId: string) => {
    if (!isAdmin) {
      toast({ title: 'Error', description: 'Admin access required', variant: 'destructive' });
      return;
    }
    
    const confirmed = window.confirm('Are you sure you want to delete this proposal? This action cannot be undone.');
    if (!confirmed) return;

    try {
      const wallet = walletAddress ?? profile?.wallet_address;
      if (!wallet) {
        toast({ title: 'Hata', description: 'Cüzdan bağlı değil', variant: 'destructive' });
        return;
      }

      console.log('[DAO] Deleting proposal:', proposalId, 'with wallet:', wallet);

      // Use edge function for admin delete to bypass RLS
      const { data, error } = await supabase.functions.invoke('admin-action', {
        body: {
          action: 'delete_proposal',
          proposal_id: proposalId,
          walletAddress: wallet.toLowerCase(),
        },
      });

      console.log('[DAO] Delete response:', { data, error });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Success', description: 'Proposal deleted successfully' });
      fetchProposals();
    } catch (error: any) {
      console.error('Error deleting proposal:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const stats = {
    total: proposals.length,
    active: proposals.filter(p => isProposalActive(p)).length,
    totalVotes: proposals.reduce((sum, p) => sum + (p.total_votes || 0), 0),
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(6, 182, 212, 0.2) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6, 182, 212, 0.2) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
          }}
        />
        
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full blur-[120px] opacity-20"
          style={{
            background: "radial-gradient(circle, #06b6d4, transparent 70%)",
            left: mousePosition.x - 250,
            top: mousePosition.y - 250,
          }}
        />
        
        <motion.div
          className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[100px]"
          animate={{
            background: [
              "radial-gradient(circle, rgba(6, 182, 212, 0.3), transparent 70%)",
              "radial-gradient(circle, rgba(168, 85, 247, 0.3), transparent 70%)",
              "radial-gradient(circle, rgba(6, 182, 212, 0.3), transparent 70%)",
            ],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        
        <motion.div
          className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full blur-[80px]"
          animate={{
            background: [
              "radial-gradient(circle, rgba(34, 197, 94, 0.3), transparent 70%)",
              "radial-gradient(circle, rgba(6, 182, 212, 0.3), transparent 70%)",
              "radial-gradient(circle, rgba(34, 197, 94, 0.3), transparent 70%)",
            ],
          }}
          transition={{ duration: 6, repeat: Infinity }}
        />
      </div>

      <div className="relative z-10 p-4 md:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <motion.div
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <Vote className="w-8 h-8 text-white" />
              </motion.div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                    DAO
                  </span>
                </h1>
                <p className="text-cyan-300/70 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Community Governance
                </p>
              </div>
            </div>

            {isAdmin && (
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Proposal
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-zinc-900 border-cyan-500/30 text-white max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-cyan-400">Create Proposal</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Title</label>
                      <Input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="What should we decide?"
                        className="bg-zinc-800 border-zinc-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Description (optional)</label>
                      <Textarea
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Provide more context..."
                        className="bg-zinc-800 border-zinc-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Type</label>
                      <Select value={proposalType} onValueChange={(v: 'yes_no' | 'multiple_choice') => setProposalType(v)}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                          <SelectItem value="yes_no">Yes / No</SelectItem>
                          <SelectItem value="multiple_choice">Multiple Choice (up to 4)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {proposalType === 'multiple_choice' && (
                      <div className="space-y-3">
                        <label className="text-sm text-gray-400 block">Options (with optional images)</label>
                        {options.map((opt, i) => (
                          <div key={i} className="flex gap-2 items-start">
                            <div className="flex-1">
                              <Input
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...options];
                                  newOpts[i] = e.target.value;
                                  setOptions(newOpts);
                                }}
                                placeholder={`Option ${i + 1}`}
                                className="bg-zinc-800 border-zinc-700 text-white"
                              />
                            </div>
                            <div className="w-20">
                              <input
                                type="file"
                                ref={el => optionImageInputRefs.current[i] = el}
                                onChange={(e) => handleOptionImageUpload(e, i)}
                                accept="image/*"
                                className="hidden"
                              />
                              {optionImages[i] ? (
                                <div className="relative">
                                  <img 
                                    src={optionImages[i]!} 
                                    alt={`Option ${i + 1}`} 
                                    className="w-20 h-10 object-cover rounded border border-zinc-700"
                                  />
                                  <Button
                                    size="icon"
                                    variant="destructive"
                                    className="absolute -top-1 -right-1 w-4 h-4"
                                    onClick={() => removeOptionImage(i)}
                                  >
                                    <X className="w-2 h-2" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="w-full h-10 bg-zinc-800 border-zinc-700 text-gray-400 hover:text-white p-0"
                                  onClick={() => optionImageInputRefs.current[i]?.click()}
                                  disabled={uploadingOptionIndex === i}
                                >
                                  {uploadingOptionIndex === i ? (
                                    <span className="text-[10px]">...</span>
                                  ) : (
                                    <Image className="w-3 h-3" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Duration (days)</label>
                      <Select value={duration} onValueChange={setDuration}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                          <SelectItem value="1">1 day</SelectItem>
                          <SelectItem value="3">3 days</SelectItem>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={createProposal} 
                      disabled={submitting || uploadingOptionIndex !== null}
                      className="w-full bg-gradient-to-r from-cyan-500 to-blue-600"
                    >
                      {submitting ? 'Creating...' : 'Create Proposal'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-4 mb-8"
        >
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-cyan-400 mb-1">
              <Vote className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Total Proposals</span>
            </div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Active</span>
            </div>
            <div className="text-2xl font-bold">{stats.active}</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-purple-400 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Total Votes</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalVotes.toLocaleString()}</div>
          </div>
        </motion.div>

        {/* Your Balance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-cyan-300/70">Your Voting Power</p>
              <p className="text-2xl font-bold text-white">{Math.floor(avloBalance).toLocaleString()} <span className="text-cyan-400">AVLO Credit</span></p>
            </div>
            <Sparkles className="w-8 h-8 text-cyan-400" />
          </div>
          <p className="text-xs text-gray-400 mt-2">Spend more AVLO Credit to increase your vote weight!</p>
        </motion.div>

        {/* Proposals */}
        <div className="space-y-4">
          <AnimatePresence>
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading proposals...</div>
            ) : proposals.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <Vote className="w-16 h-16 text-cyan-500/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Proposals Yet</h3>
                <p className="text-gray-400">Community proposals will appear here</p>
              </motion.div>
            ) : (
              proposals.map((proposal, index) => {
                const active = isProposalActive(proposal);
                const voted = hasUserVoted(proposal.id);
                const totalVotes = getTotalVotesForProposal(proposal.id);

                return (
                  <motion.div
                    key={proposal.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-6 rounded-2xl border backdrop-blur-sm ${
                      active 
                        ? 'bg-white/5 border-cyan-500/30' 
                        : 'bg-white/5 border-white/10 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {active ? (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-medium bg-gray-500/20 text-gray-400 rounded-full">
                              Ended
                            </span>
                          )}
                          {voted && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-400 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Voted
                            </span>
                          )}
                        </div>
                        <h3 className="text-xl font-bold mb-1">{proposal.title}</h3>
                        {proposal.description && (
                          <p className="text-gray-400 text-sm mb-3">{proposal.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>by {proposal.creator?.display_name || proposal.creator?.username || 'Admin'}</span>
                          <span>•</span>
                          <span>{active ? `Ends ${formatDistanceToNow(new Date(proposal.ends_at), { addSuffix: true })}` : 'Ended'}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" /> {totalVotes.toLocaleString()} votes
                          </span>
                        </div>
                      </div>
                      
                      {/* Admin Delete Button */}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteProposal(proposal.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/20 flex-shrink-0"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      )}
                    </div>

                    {/* Voting Options */}
                    <div className="space-y-3">
                      {proposal.options.map((option, optIndex) => {
                        const percentage = getPercentage(proposal.id, optIndex);
                        const votes = getVotesForOption(proposal.id, optIndex);
                        const isWinning = votes > 0 && votes === Math.max(...Object.values(votesByProposal[proposal.id] || {}));
                        const isUserChoice = userVotes[proposal.id] === optIndex;

                        return (
                          <div 
                            key={optIndex}
                            className={`relative p-3 rounded-xl border transition-all ${
                              isUserChoice 
                                ? 'border-cyan-500 bg-cyan-500/10' 
                                : 'border-white/10 bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-3 relative z-10">
                              {/* Option Image */}
                              {proposal.image_urls && proposal.image_urls[optIndex] && (
                                <img 
                                  src={proposal.image_urls[optIndex]!} 
                                  alt={option}
                                  className="w-12 h-12 md:w-16 md:h-16 rounded-lg object-cover border border-white/20 flex-shrink-0"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {isWinning && totalVotes > 0 && (
                                      <Trophy className="w-4 h-4 text-yellow-400" />
                                    )}
                                    {isUserChoice && (
                                      <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                                    )}
                                    <span className="font-medium">{option}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-400">{votes.toLocaleString()} votes</span>
                                    <span className="text-sm font-bold text-cyan-400">{percentage.toFixed(1)}%</span>
                                  </div>
                                </div>
                                <Progress 
                                  value={percentage} 
                                  className="h-1 mt-2 bg-white/10"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Vote Button - show if active and has credits */}
                    {active && canVoteAgain(proposal.id) && (
                      <Button
                        onClick={() => {
                          setSelectedProposal(proposal);
                          setVoteDialogOpen(true);
                        }}
                        className="w-full mt-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
                      >
                        <Vote className="w-4 h-4 mr-2" />
                        {voted ? 'Add More Votes' : 'Cast Your Vote'}
                      </Button>
                    )}
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Vote Dialog - Simplified single-click voting */}
        <Dialog open={voteDialogOpen} onOpenChange={setVoteDialogOpen}>
          <DialogContent className="bg-zinc-900 border-cyan-500/30 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-cyan-400">
                {hasUserVoted(selectedProposal?.id || '') ? 'Add More Votes' : 'Cast Your Vote'}
              </DialogTitle>
            </DialogHeader>
            {selectedProposal && (
              <div className="space-y-4 mt-4">
                <h4 className="font-semibold">{selectedProposal.title}</h4>
                
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 block">Select Option</label>
                  {selectedProposal.options.map((option, i) => {
                    const isUserPreviousChoice = userVotes[selectedProposal.id] === i;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedOption(i)}
                        className={`w-full p-3 rounded-xl border text-left transition-all ${
                          selectedOption === i
                            ? 'border-cyan-500 bg-cyan-500/20'
                            : isUserPreviousChoice
                            ? 'border-purple-500/50 bg-purple-500/10'
                            : 'border-white/10 bg-white/5 hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isUserPreviousChoice && <CheckCircle2 className="w-4 h-4 text-purple-400" />}
                          <span>{option}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                  <p className="text-sm text-cyan-300">
                    You will use all <span className="font-bold">{Math.floor(avloBalance)}</span> AVLO Credit for this vote.
                    <br />
                    <span className="text-xs text-gray-400">More votes = more influence!</span>
                  </p>
                </div>

                <Button 
                  onClick={submitVote} 
                  disabled={submitting || selectedOption === null || Math.floor(avloBalance) < 1}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600"
                >
                  {submitting ? 'Submitting...' : `Vote with ${Math.floor(avloBalance)} AVLO`}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default DAO;
