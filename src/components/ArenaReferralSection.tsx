import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X, Clock, UserPlus, AlertCircle, Award, Users, Shield, Zap, Search } from "lucide-react";
import { useWalletAuth } from "@/contexts/WalletAuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArenaArchLogo } from "./ArenaArchLogo";
import { motion, AnimatePresence } from "framer-motion";

interface ArenaReferral {
  id: string;
  referrer_id: string;
  referred_arena_username: string;
  referred_id: string | null;
  status: 'pending' | 'confirmed' | 'rejected';
  confirmed_at: string | null;
  created_at: string;
  referrer_profile?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    arena_username: string | null;
  };
  referred_profile?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    arena_username: string | null;
  };
}

interface ArenaUserSuggestion {
  id: string;
  arena_username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export const ArenaReferralSection = () => {
  const { profile } = useWalletAuth();
  const [arenaUsername, setArenaUsername] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ArenaUserSuggestion | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const arenaProfile = profile as any;

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for Arena users
  const { data: userSuggestions = [] } = useQuery({
    queryKey: ['arenaUserSearch', arenaUsername],
    queryFn: async () => {
      if (!arenaUsername || arenaUsername.length < 2) return [];
      
      const searchTerm = arenaUsername.replace(/^@/, '').toLowerCase();
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, arena_username, display_name, avatar_url')
        .not('arena_username', 'is', null)
        .ilike('arena_username', `%${searchTerm}%`)
        .neq('id', profile?.id || '')
        .limit(10);
      
      if (error) throw error;
      return (data || []).filter(u => u.arena_username) as ArenaUserSuggestion[];
    },
    enabled: arenaUsername.length >= 2 && !selectedUser
  });

  // Check if user already confirmed a referral
  const { data: hasConfirmedReferral } = useQuery({
    queryKey: ['hasConfirmedReferral', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return false;
      
      const { data } = await supabase
        .from('arena_referrals')
        .select('id')
        .eq('referred_id', profile.id)
        .eq('status', 'confirmed')
        .maybeSingle();
      
      return !!data;
    },
    enabled: !!profile?.id
  });

  // Fetch sent arena referrals with referred user profile
  const { data: sentReferrals = [] } = useQuery({
    queryKey: ['arenaReferrals', 'sent', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      // First fetch the referrals
      const { data: referrals, error } = await supabase
        .from('arena_referrals')
        .select('*')
        .eq('referrer_id', profile.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (!referrals || referrals.length === 0) return [];
      
      // Get unique arena usernames to fetch profiles
      const arenaUsernames = [...new Set(referrals.map(r => r.referred_arena_username.toLowerCase()))];
      
      // Fetch profiles by arena_username (case-insensitive)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url, arena_username')
        .or(arenaUsernames.map(u => `arena_username.ilike.${u}`).join(','));
      
      // Create a lookup map
      const profileMap = new Map<string, typeof profiles[0]>();
      profiles?.forEach(p => {
        if (p.arena_username) {
          profileMap.set(p.arena_username.toLowerCase(), p);
        }
      });
      
      // Merge profiles into referrals
      return referrals.map(r => ({
        ...r,
        referred_profile: profileMap.get(r.referred_arena_username.toLowerCase()) || null
      })) as ArenaReferral[];
    },
    enabled: !!profile?.id
  });

  // Fetch pending referrals where user needs to confirm (case-insensitive)
  const { data: pendingReferrals = [] } = useQuery({
    queryKey: ['arenaReferrals', 'pending', profile?.id, arenaProfile?.arena_username],
    queryFn: async () => {
      if (!profile?.id || !arenaProfile?.arena_username) return [];
      
      // Use ilike for case-insensitive matching
      const { data, error } = await supabase
        .from('arena_referrals')
        .select('*')
        .ilike('referred_arena_username', arenaProfile.arena_username)
        .eq('status', 'pending')
        .is('referred_id', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch referrer profiles separately
      const referralsWithProfiles = await Promise.all(
        (data || []).map(async (ref) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username, display_name, avatar_url, arena_username')
            .eq('id', ref.referrer_id)
            .single();
          
          return {
            ...ref,
            referrer_profile: profileData
          };
        })
      );
      
      return referralsWithProfiles as ArenaReferral[];
    },
    enabled: !!profile?.id && !!arenaProfile?.arena_username
  });

  // Function to trigger score recalculation
  const recalculateScores = async (userId: string) => {
    try {
      // Get AVLO token id
      const { data: avloToken } = await supabase
        .from('dao_tokens')
        .select('id')
        .eq('token_address', '0xb5B3e63540fD53DCFFD4e65c726a84aA67B24E61')
        .single();

      if (avloToken) {
        // Trigger score recalculation via database function
        await supabase.rpc('calculate_user_score', { 
          p_user_id: userId,
          p_token_id: avloToken.id
        });
      }
    } catch (error) {
      console.error('Error recalculating score:', error);
    }
  };

  const addReferralMutation = useMutation({
    mutationFn: async (username: string) => {
      if (!profile?.id) throw new Error("Not logged in");
      if (!arenaProfile?.arena_username) throw new Error("You need an Arena username to add referrals");
      
      // Normalize username (remove @ if present)
      const normalizedUsername = username.replace(/^@/, '').toLowerCase();
      
      // Can't refer yourself
      if (normalizedUsername === arenaProfile.arena_username.toLowerCase()) {
        throw new Error("You cannot refer yourself");
      }
      
      // Check if this person already has a confirmed referral (someone else already referred them)
      const { data: alreadyReferred } = await supabase
        .from('arena_referrals')
        .select('id')
        .ilike('referred_arena_username', normalizedUsername)
        .eq('status', 'confirmed')
        .maybeSingle();
      
      if (alreadyReferred) {
        throw new Error("This user has already been referred by someone else");
      }
      
      // Check if you already added this referral
      const { data: existing } = await supabase
        .from('arena_referrals')
        .select('id')
        .eq('referrer_id', profile.id)
        .ilike('referred_arena_username', normalizedUsername)
        .maybeSingle();
      
      if (existing) {
        throw new Error("You've already added this Arena username");
      }

      // Check for mutual referral - if target user has already referred you
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('arena_username', normalizedUsername)
        .maybeSingle();

      if (targetProfile) {
        const { data: theyReferredMe } = await supabase
          .from('arena_referrals')
          .select('id')
          .eq('referrer_id', targetProfile.id)
          .eq('referred_id', profile.id)
          .eq('status', 'confirmed')
          .maybeSingle();

        if (theyReferredMe) {
          throw new Error("Mutual referrals are not allowed. This user already referred you.");
        }
      }
      
      // Insert new arena referral
      const { error } = await supabase
        .from('arena_referrals')
        .insert({
          referrer_id: profile.id,
          referred_arena_username: normalizedUsername,
          status: 'pending'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Referral added!", {
        description: "Waiting for confirmation from the user"
      });
      setArenaUsername("");
      queryClient.invalidateQueries({ queryKey: ['arenaReferrals'] });
    },
    onError: (error: any) => {
      toast.error("Failed to add referral", {
        description: error.message
      });
    }
  });

  const confirmReferralMutation = useMutation({
    mutationFn: async (referralId: string) => {
      if (!profile?.id) throw new Error("Not logged in");
      
      if (!arenaProfile?.arena_username) {
        throw new Error("Only Arena users can confirm referrals");
      }

      // Check if user already confirmed another referral
      const { data: existingConfirmed } = await supabase
        .from('arena_referrals')
        .select('id')
        .eq('referred_id', profile.id)
        .eq('status', 'confirmed')
        .maybeSingle();

      if (existingConfirmed) {
        throw new Error("You have already confirmed a referral. You can only be referred once.");
      }

      // Get the referral to check for mutual referral
      const { data: referral } = await supabase
        .from('arena_referrals')
        .select('referrer_id')
        .eq('id', referralId)
        .single();

      if (referral) {
        // Check if I have referred this person (mutual check)
        const { data: iReferredThem } = await supabase
          .from('arena_referrals')
          .select('id')
          .eq('referrer_id', profile.id)
          .eq('referred_id', referral.referrer_id)
          .eq('status', 'confirmed')
          .maybeSingle();

        if (iReferredThem) {
          throw new Error("Mutual referrals are not allowed");
        }
      }
      
      const { error } = await supabase
        .from('arena_referrals')
        .update({
          referred_id: profile.id,
          status: 'confirmed',
          confirmed_at: new Date().toISOString()
        })
        .eq('id', referralId);
      
      if (error) throw error;

      // Auto-reject all other pending referrals for this user
      await supabase
        .from('arena_referrals')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .ilike('referred_arena_username', arenaProfile.arena_username)
        .eq('status', 'pending')
        .neq('id', referralId);

      // Recalculate score for both referrer and referred
      if (referral?.referrer_id) {
        await recalculateScores(referral.referrer_id);
      }
      await recalculateScores(profile.id);
    },
    onSuccess: () => {
      toast.success("Referral confirmed! 🎉", {
        description: "Referrer earned +1 score point"
      });
      queryClient.invalidateQueries({ queryKey: ['arenaReferrals'] });
      queryClient.invalidateQueries({ queryKey: ['hasConfirmedReferral'] });
      queryClient.invalidateQueries({ queryKey: ['arenaReferralStats'] });
      queryClient.invalidateQueries({ queryKey: ['userScores'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
    onError: (error: any) => {
      toast.error("Failed to confirm", {
        description: error.message
      });
    }
  });

  const rejectReferralMutation = useMutation({
    mutationFn: async (referralId: string) => {
      const { error } = await supabase
        .from('arena_referrals')
        .update({
          status: 'rejected'
        })
        .eq('id', referralId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.info("Referral rejected");
      queryClient.invalidateQueries({ queryKey: ['arenaReferrals'] });
    },
    onError: (error: any) => {
      toast.error("Failed to reject", {
        description: error.message
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arenaUsername.trim()) {
      toast.error("Please enter an Arena username");
      return;
    }
    
    addReferralMutation.mutate(arenaUsername.trim());
  };

  const confirmedCount = sentReferrals.filter(r => r.status === 'confirmed').length;

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/20 via-purple-500/10 to-pink-500/20 p-6 border border-cyan-500/30"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiLz48cGF0aCBkPSJNMCAwaDIwdjIwSDB6TTIwIDIwaDIwdjIwSDIweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIvPjwvZz48L3N2Zz4=')] opacity-50" />
        
        <div className="relative flex items-center gap-4 mb-6">
          <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 shadow-lg shadow-cyan-500/30">
            <Users className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Referral System</h2>
            <div className="flex items-center gap-2 mt-1">
              <ArenaArchLogo size="sm" animated={false} />
              <span className="text-sm text-gray-400">Arena Exclusive</span>
            </div>
          </div>
        </div>

        {/* Rules Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-black/40 border border-white/10">
            <Shield className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white">One-Time Confirmation</p>
              <p className="text-xs text-gray-400">Each user can only confirm ONE referrer</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-black/40 border border-white/10">
            <Zap className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white">+1 Score Per Referral</p>
              <p className="text-xs text-gray-400">Referrer earns 1 point when confirmed</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-black/40 border border-white/10">
            <Users className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white">Unlimited Referrals</p>
              <p className="text-xs text-gray-400">Refer as many people as you want</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-black/40 border border-white/10">
            <AlertCircle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white">No Mutual Referrals</p>
              <p className="text-xs text-gray-400">A→B and B→A not allowed</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Already Confirmed Warning */}
      {hasConfirmedReferral && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="bg-zinc-900/80 backdrop-blur-sm border-green-500/30 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/20">
                <Check className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-green-400 font-medium">You have confirmed your referrer</p>
                <p className="text-sm text-gray-400">You can no longer confirm another referral</p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Add Referral Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-black/60 backdrop-blur-xl border-zinc-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white">Add Referral</h3>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Label htmlFor="arena-username" className="text-gray-300 text-sm">
                Arena Username
              </Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  ref={inputRef}
                  id="arena-username"
                  value={arenaUsername}
                  onChange={(e) => {
                    setArenaUsername(e.target.value);
                    setSelectedUser(null);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Search Arena username..."
                  className="bg-zinc-900/80 border-zinc-700 text-white pl-9 focus:border-cyan-500 transition-colors"
                  autoComplete="off"
                />
              </div>
              
              {/* Autocomplete Suggestions */}
              <AnimatePresence>
                {showSuggestions && userSuggestions.length > 0 && !selectedUser && (
                  <motion.div
                    ref={suggestionsRef}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden"
                  >
                    {userSuggestions.map((user, index) => (
                      <motion.button
                        key={user.id}
                        type="button"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => {
                          setSelectedUser(user);
                          setArenaUsername(user.arena_username);
                          setShowSuggestions(false);
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-zinc-800 transition-colors text-left border-b border-zinc-800 last:border-b-0"
                      >
                        <Avatar className="w-8 h-8 border border-zinc-700">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-500 text-white text-xs">
                            {user.arena_username?.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">@{user.arena_username}</p>
                          {user.display_name && (
                            <p className="text-xs text-gray-400 truncate">{user.display_name}</p>
                          )}
                        </div>
                        <ArenaArchLogo size="sm" animated={false} />
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Selected User Preview */}
              {selectedUser && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-2 flex items-center gap-3 p-3 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-lg"
                >
                  <Avatar className="w-10 h-10 border-2 border-cyan-500/50">
                    <AvatarImage src={selectedUser.avatar_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-500 text-white">
                      {selectedUser.arena_username?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-white font-medium">@{selectedUser.arena_username}</p>
                    {selectedUser.display_name && (
                      <p className="text-xs text-gray-400">{selectedUser.display_name}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedUser(null);
                      setArenaUsername("");
                    }}
                    className="text-gray-400 hover:text-white hover:bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </motion.div>
              )}
              
              <p className="text-xs text-gray-500 mt-1.5">
                Search and select the Arena user you referred to the platform
              </p>
            </div>
            
            <Button
              type="submit"
              disabled={!arenaUsername.trim() || addReferralMutation.isPending}
              className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium shadow-lg shadow-cyan-500/20"
            >
              {addReferralMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Adding...
                </div>
              ) : (
                "Add Referral"
              )}
            </Button>
          </form>
        </Card>
      </motion.div>

      {/* Pending Confirmations */}
      {pendingReferrals.length > 0 && !hasConfirmedReferral && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-zinc-900/80 backdrop-blur-sm border-yellow-500/30 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-yellow-500/20 animate-pulse">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Pending Confirmations</h3>
                <p className="text-sm text-gray-400">
                  These users claim they referred you. <span className="text-yellow-400 font-medium">You can only confirm ONE!</span>
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              {pendingReferrals.map((referral, index) => (
                <motion.div
                  key={referral.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-yellow-500/20"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12 border-2 border-yellow-500/30">
                      <AvatarFallback className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white font-bold">
                        {referral.referrer_profile?.arena_username?.charAt(0).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-white font-semibold">
                        @{referral.referrer_profile?.arena_username || referral.referrer_profile?.username}
                      </p>
                      <p className="text-xs text-gray-500">
                        Claims they referred you
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => confirmReferralMutation.mutate(referral.id)}
                      disabled={confirmReferralMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectReferralMutation.mutate(referral.id)}
                      disabled={rejectReferralMutation.isPending}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Your Referrals */}
      {sentReferrals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-black/60 backdrop-blur-xl border-zinc-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                  <Award className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">Your Referrals</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-green-400">{confirmedCount}</span>
                <span className="text-gray-500">/ {sentReferrals.length}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              {sentReferrals.map((referral, index) => (
                <motion.div
                  key={referral.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 border border-zinc-700">
                      <AvatarImage 
                        src={referral.referred_profile?.avatar_url || undefined} 
                        alt={referral.referred_arena_username}
                      />
                      <AvatarFallback className="bg-zinc-800 text-white text-sm">
                        {referral.referred_arena_username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-white font-medium">
                        @{referral.referred_arena_username}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(referral.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    {referral.status === 'pending' && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30">
                        <Clock className="w-3.5 h-3.5 text-yellow-400" />
                        <span className="text-xs font-medium text-yellow-400">Pending</span>
                      </div>
                    )}
                    {referral.status === 'confirmed' && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30">
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-xs font-medium text-green-400">+1 Score</span>
                      </div>
                    )}
                    {referral.status === 'rejected' && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30">
                        <X className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-xs font-medium text-red-400">Rejected</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Empty State */}
      {sentReferrals.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center py-8"
        >
          <div className="inline-flex p-4 rounded-full bg-zinc-900 border border-zinc-800 mb-4">
            <Users className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-gray-400">No referrals yet</p>
          <p className="text-sm text-gray-500 mt-1">Start referring Arena users to earn score points!</p>
        </motion.div>
      )}
    </div>
  );
};