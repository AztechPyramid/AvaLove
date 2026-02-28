import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Coins, Plus, Trash2, Edit2, ArrowUp, ArrowDown, BadgeCheck, Search, Clock, Sparkles, Bell, XCircle } from "lucide-react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface StakingPool {
  id: string;
  title: string;
  staking_contract_address: string;
  stake_token_address: string;
  reward_token_address: string;
  reward_pool_address: string;
  stake_token_logo: string;
  reward_token_logo: string;
  is_active: boolean;
  is_featured: boolean;
  created_by: string;
  display_order: number;
  creator_wallet?: string;
  created_at?: string;
  pending_approval?: boolean;
  pending_submitted_at?: string;
  is_rejected?: boolean;
  rejected_at?: string;
}

interface CreatorProfile {
  id: string;
  wallet_address: string;
  arena_username: string | null;
  avatar_url: string | null;
  display_name: string | null;
}

interface DaoToken {
  id: string;
  token_address: string;
  token_logo_url: string | null;
  token_symbol: string;
  token_name: string;
}

interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  wallet_address: string;
  arena_username: string | null;
}

export default function StakingPoolManager() {
  const { executeAdminAction } = useAdminAuth();
  const [pools, setPools] = useState<StakingPool[]>([]);
  const [creatorProfiles, setCreatorProfiles] = useState<Record<string, CreatorProfile>>({});
  const [daoTokens, setDaoTokens] = useState<DaoToken[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPool, setEditingPool] = useState<StakingPool | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedCreator, setSelectedCreator] = useState<UserProfile | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [poolSearchQuery, setPoolSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "approved" | "pending" | "submitted" | "rejected">("all");
  const [formData, setFormData] = useState({
    title: "",
    staking_contract_address: "",
    stake_token_address: "",
    reward_token_address: "",
    reward_pool_address: "",
    stake_token_logo: "",
    reward_token_logo: "",
    is_active: true,
    is_featured: false,
    display_order: 0,
    creator_wallet: "",
  });

  useEffect(() => {
    fetchPools();
    fetchDaoTokens();
  }, []);

  // Fetch creator profiles when pools change
  useEffect(() => {
    if (pools.length > 0) {
      fetchCreatorProfiles();
    }
  }, [pools]);

  const fetchPools = async () => {
    const { data, error } = await supabase
      .from("staking_pools")
      .select("*")
      .order("created_at", { ascending: false }); // Newest first

    if (error) {
      toast.error("Error fetching pools");
      console.error(error);
    } else {
      setPools(data || []);
    }
  };

  const fetchCreatorProfiles = async () => {
    // Collect all unique wallets (lowercase for comparison)
    const wallets = [...new Set(pools.map(p => p.creator_wallet?.toLowerCase()).filter(Boolean))] as string[];
    // Also collect created_by user IDs
    const createdByIds = [...new Set(pools.map(p => p.created_by).filter(Boolean))] as string[];
    
    const profileMap: Record<string, CreatorProfile> = {};
    
    // Fetch by wallet address
    if (wallets.length > 0) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, wallet_address, arena_username, avatar_url, display_name")
        .or(wallets.map(w => `wallet_address.ilike.${w}`).join(','));

      if (!error && data) {
        data.forEach(p => {
          profileMap[p.wallet_address.toLowerCase()] = p;
          // Also map by user id for fallback
          profileMap[p.id] = p;
        });
      }
    }
    
    // Fetch by created_by user ID (for pools without creator_wallet)
    if (createdByIds.length > 0) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, wallet_address, arena_username, avatar_url, display_name")
        .in("id", createdByIds);

      if (!error && data) {
        data.forEach(p => {
          if (!profileMap[p.id]) {
            profileMap[p.id] = p;
          }
          if (p.wallet_address && !profileMap[p.wallet_address.toLowerCase()]) {
            profileMap[p.wallet_address.toLowerCase()] = p;
          }
        });
      }
    }
    
    setCreatorProfiles(profileMap);
  };

  const fetchDaoTokens = async () => {
    const { data, error } = await supabase
      .from("dao_tokens")
      .select("id, token_address, token_logo_url, token_symbol, token_name")
      .eq("is_active", true);

    if (!error && data) {
      setDaoTokens(data);
    }
  };

  // Helper to find token logo from dao_tokens
  const getTokenLogo = (address: string) => {
    const token = daoTokens.find(t => t.token_address.toLowerCase() === address.toLowerCase());
    return token?.token_logo_url || null;
  };

  const getTokenInfo = (address: string) => {
    return daoTokens.find(t => t.token_address.toLowerCase() === address.toLowerCase());
  };

  // Filter and search pools
  const filteredPools = useMemo(() => {
    let result = [...pools];
    
    // Filter by tab
    if (activeTab === "approved") {
      result = result.filter(p => p.is_featured);
    } else if (activeTab === "pending") {
      result = result.filter(p => !p.is_featured && !p.pending_approval && !p.is_rejected);
    } else if (activeTab === "submitted") {
      // Show pools submitted for approval (pending_approval = true, not yet featured, not rejected)
      result = result.filter(p => p.pending_approval && !p.is_featured && !p.is_rejected);
      // Sort by pending_submitted_at descending (most recent first)
      result.sort((a, b) => {
        const aTime = a.pending_submitted_at ? new Date(a.pending_submitted_at).getTime() : 0;
        const bTime = b.pending_submitted_at ? new Date(b.pending_submitted_at).getTime() : 0;
        return bTime - aTime;
      });
    } else if (activeTab === "rejected") {
      result = result.filter(p => p.is_rejected);
      // Sort by rejected_at descending
      result.sort((a, b) => {
        const aTime = a.rejected_at ? new Date(a.rejected_at).getTime() : 0;
        const bTime = b.rejected_at ? new Date(b.rejected_at).getTime() : 0;
        return bTime - aTime;
      });
    }
    
    // Filter by search query
    if (poolSearchQuery.trim()) {
      const query = poolSearchQuery.toLowerCase();
      result = result.filter(p => 
        p.title.toLowerCase().includes(query) ||
        p.staking_contract_address.toLowerCase().includes(query) ||
        p.stake_token_address.toLowerCase().includes(query) ||
        p.reward_token_address.toLowerCase().includes(query) ||
        p.creator_wallet?.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [pools, activeTab, poolSearchQuery]);

  // Count submitted and rejected pools for notification badges
  const submittedCount = pools.filter(p => p.pending_approval && !p.is_featured && !p.is_rejected).length;
  const rejectedCount = pools.filter(p => p.is_rejected).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingPool) {
      const result = await executeAdminAction('update_staking_pool', {
        poolId: editingPool.id,
        updates: formData
      });

      if (!result.success) {
        toast.error(result.error || "Error updating pool");
      } else {
        toast.success("Pool updated successfully");
        fetchPools();
        closeDialog();
      }
    } else {
      const result = await executeAdminAction('create_staking_pool', formData);

      if (!result.success) {
        toast.error(result.error || "Error creating pool");
      } else {
        toast.success("Pool created successfully");
        fetchPools();
        closeDialog();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this pool?")) return;

    const result = await executeAdminAction('delete_staking_pool', { poolId: id });

    if (!result.success) {
      toast.error(result.error || "Error deleting pool");
    } else {
      toast.success("Pool deleted successfully");
      fetchPools();
    }
  };

  const handleEdit = (pool: StakingPool) => {
    setEditingPool(pool);
    setFormData({
      title: pool.title,
      staking_contract_address: pool.staking_contract_address,
      stake_token_address: pool.stake_token_address,
      reward_token_address: pool.reward_token_address,
      reward_pool_address: pool.reward_pool_address,
      stake_token_logo: pool.stake_token_logo,
      reward_token_logo: pool.reward_token_logo,
      is_active: pool.is_active,
      is_featured: pool.is_featured || false,
      display_order: pool.display_order,
      creator_wallet: pool.creator_wallet || "",
    });
    setSelectedCreator(null);
    setUserSearchQuery("");
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingPool(null);
    setSelectedCreator(null);
    setUserSearchQuery("");
    setFormData({
      title: "",
      staking_contract_address: "",
      stake_token_address: "",
      reward_token_address: "",
      reward_pool_address: "",
      stake_token_logo: "",
      reward_token_logo: "",
      is_active: true,
      is_featured: false,
      display_order: pools.length,
      creator_wallet: "",
    });
  };

  // Search for users by username or arena username
  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, wallet_address, arena_username")
        .or(`username.ilike.%${query}%,arena_username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(5);
      
      if (!error && data) {
        setSearchResults(data);
      }
    } catch (e) {
      console.error("Error searching users:", e);
    }
    setIsSearching(false);
  };

  const handleSelectCreator = (user: UserProfile) => {
    setSelectedCreator(user);
    setFormData(prev => ({ ...prev, creator_wallet: user.wallet_address }));
    setSearchResults([]);
    setUserSearchQuery("");
  };

  const handleMoveUp = async (pool: StakingPool, index: number) => {
    if (index === 0) return;
    
    const prevPool = pools[index - 1];
    const result = await executeAdminAction('reorder_staking_pools', {
      pool1Id: pool.id,
      pool1Order: prevPool.display_order,
      pool2Id: prevPool.id,
      pool2Order: pool.display_order
    });

    if (!result.success) {
      toast.error("Error reordering pools");
    } else {
      fetchPools();
    }
  };

  const handleMoveDown = async (pool: StakingPool, index: number) => {
    if (index === pools.length - 1) return;
    
    const nextPool = pools[index + 1];
    const result = await executeAdminAction('reorder_staking_pools', {
      pool1Id: pool.id,
      pool1Order: nextPool.display_order,
      pool2Id: nextPool.id,
      pool2Order: pool.display_order
    });

    if (!result.success) {
      toast.error("Error reordering pools");
    } else {
      fetchPools();
    }
  };

  const handleToggleFeatured = async (pool: StakingPool) => {
    // When approving, also clear pending_approval and is_rejected
    const updates: any = { is_featured: !pool.is_featured };
    if (!pool.is_featured) {
      // Approving the pool - clear pending and rejected status
      updates.pending_approval = false;
      updates.is_rejected = false;
      updates.rejected_at = null;
    }
    
    const result = await executeAdminAction('update_staking_pool', {
      poolId: pool.id,
      updates
    });

    if (!result.success) {
      toast.error("Error updating featured status");
    } else {
      toast.success(pool.is_featured ? "Removed featured badge" : "Pool approved! ✅");
      fetchPools();
    }
  };

  const handleReject = async (pool: StakingPool) => {
    // Directly reject without confirm dialog (was causing issues)
    const result = await executeAdminAction('update_staking_pool', {
      poolId: pool.id,
      updates: {
        is_rejected: true,
        rejected_at: new Date().toISOString(),
        pending_approval: false,
        is_featured: false,
      }
    });

    if (!result.success) {
      toast.error("Error rejecting pool");
    } else {
      toast.success(`"${pool.title}" rejected`);
      fetchPools();
    }
  };

  const handleUnreject = async (pool: StakingPool) => {
    const result = await executeAdminAction('update_staking_pool', {
      poolId: pool.id,
      updates: {
        is_rejected: false,
        rejected_at: null,
        pending_approval: true,
        pending_submitted_at: new Date().toISOString(),
      }
    });

    if (!result.success) {
      toast.error("Error restoring pool");
    } else {
      toast.success("Pool moved back to submitted");
      fetchPools();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Coins className="h-6 w-6 text-purple-400" />
            Staking Pools
          </h2>
          <p className="text-white/60 mt-1">
            {pools.length} total · {pools.filter(p => p.is_featured).length} approved · {submittedCount > 0 && <span className="text-cyan-400 font-bold animate-pulse">{submittedCount} awaiting review</span>}
          </p>
        </div>
        
        {/* Search */}
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search pools by title, address..."
              value={poolSearchQuery}
              onChange={(e) => setPoolSearchQuery(e.target.value)}
              className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Pool
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingPool ? "Edit Pool" : "Create New Pool"}
              </DialogTitle>
              <DialogDescription className="text-white/60">
                Configure staking pool with contract addresses and logos
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-white">Pool Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Stake AVLO"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="staking_contract" className="text-white">
                  Staking Contract Address
                </Label>
                <Input
                  id="staking_contract"
                  placeholder="0x..."
                  value={formData.staking_contract_address}
                  onChange={(e) =>
                    setFormData({ ...formData, staking_contract_address: e.target.value })
                  }
                  required
                  className="bg-zinc-800 border-zinc-700 text-white font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stake_token" className="text-white">
                    Stake Token Address
                  </Label>
                  <Input
                    id="stake_token"
                    placeholder="0x..."
                    value={formData.stake_token_address}
                    onChange={(e) =>
                      setFormData({ ...formData, stake_token_address: e.target.value })
                    }
                    required
                    className="bg-zinc-800 border-zinc-700 text-white font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reward_token" className="text-white">
                    Reward Token Address
                  </Label>
                  <Input
                    id="reward_token"
                    placeholder="0x..."
                    value={formData.reward_token_address}
                    onChange={(e) =>
                      setFormData({ ...formData, reward_token_address: e.target.value })
                    }
                    required
                    className="bg-zinc-800 border-zinc-700 text-white font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reward_pool" className="text-white">
                  Reward Pool Address
                </Label>
                <Input
                  id="reward_pool"
                  placeholder="0x..."
                  value={formData.reward_pool_address}
                  onChange={(e) =>
                    setFormData({ ...formData, reward_pool_address: e.target.value })
                  }
                  required
                  className="bg-zinc-800 border-zinc-700 text-white font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stake_logo" className="text-white">
                    Stake Token Logo URL
                  </Label>
                  <Input
                    id="stake_logo"
                    placeholder="https://... or /assets/..."
                    value={formData.stake_token_logo}
                    onChange={(e) =>
                      setFormData({ ...formData, stake_token_logo: e.target.value })
                    }
                    required
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reward_logo" className="text-white">
                    Reward Token Logo URL
                  </Label>
                  <Input
                    id="reward_logo"
                    placeholder="https://... or /assets/..."
                    value={formData.reward_token_logo}
                    onChange={(e) =>
                      setFormData({ ...formData, reward_token_logo: e.target.value })
                    }
                    required
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
              </div>

              {/* Creator Search */}
              <div className="space-y-2">
                <Label className="text-white">Pool Creator (optional)</Label>
                {selectedCreator ? (
                  <div className="flex items-center gap-2 p-2 bg-zinc-800 border border-zinc-700 rounded-md">
                    <div className="flex-1">
                      <p className="text-white font-medium">
                        {selectedCreator.arena_username ? `@${selectedCreator.arena_username}` : selectedCreator.display_name || selectedCreator.username}
                      </p>
                      <p className="text-xs text-zinc-500 font-mono">{selectedCreator.wallet_address.slice(0, 10)}...</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCreator(null);
                        setFormData(prev => ({ ...prev, creator_wallet: "" }));
                      }}
                      className="text-zinc-400 hover:text-white"
                    >
                      ✕
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="Search by username or @arena..."
                      value={userSearchQuery}
                      onChange={(e) => {
                        setUserSearchQuery(e.target.value);
                        searchUsers(e.target.value);
                      }}
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    {searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg z-10 max-h-48 overflow-auto">
                        {searchResults.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => handleSelectCreator(user)}
                            className="w-full p-2 text-left hover:bg-zinc-700 transition-colors"
                          >
                            <p className="text-white font-medium">
                              {user.arena_username ? `@${user.arena_username}` : user.display_name || user.username}
                            </p>
                            <p className="text-xs text-zinc-500">{user.wallet_address.slice(0, 16)}...</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {formData.creator_wallet && !selectedCreator && (
                  <p className="text-xs text-zinc-400">Current: {formData.creator_wallet}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_order" className="text-white">
                  Display Order (lower numbers appear first)
                </Label>
                <Input
                  id="display_order"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                  }
                  required
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                  <Label htmlFor="is_active" className="text-white">
                    Active Pool
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_featured"
                    checked={formData.is_featured}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_featured: checked })
                    }
                  />
                  <Label htmlFor="is_featured" className="text-white flex items-center gap-1.5">
                    <BadgeCheck className="h-4 w-4 text-orange-500" />
                    Featured
                  </Label>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={closeDialog} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  {editingPool ? "Update Pool" : "Create Pool"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
        <TabsList className="bg-zinc-800 border border-zinc-700">
          <TabsTrigger value="all" className="data-[state=active]:bg-zinc-700">
            All ({pools.length})
          </TabsTrigger>
          <TabsTrigger value="submitted" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white relative">
            <Sparkles className="w-4 h-4 mr-1" />
            Submitted
            {submittedCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-cyan-500 text-white rounded-full animate-pulse">
                {submittedCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <BadgeCheck className="w-4 h-4 mr-1" />
            Approved ({pools.filter(p => p.is_featured).length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
            <XCircle className="w-4 h-4 mr-1" />
            Rejected ({rejectedCount})
          </TabsTrigger>
          <TabsTrigger value="pending" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <Clock className="w-4 h-4 mr-1" />
            Pending ({pools.filter(p => !p.is_featured && !p.pending_approval && !p.is_rejected).length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4">
        {filteredPools.map((pool, index) => (
          <Card
            key={pool.id}
            className={`bg-zinc-900 border-zinc-800 p-6 ${pool.is_featured ? 'ring-1 ring-blue-500/30' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-zinc-400 hover:text-white disabled:opacity-30"
                      onClick={() => handleMoveUp(pool, index)}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-zinc-400 hover:text-white disabled:opacity-30"
                      onClick={() => handleMoveDown(pool, index)}
                      disabled={index === filteredPools.length - 1}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full font-mono">
                    #{pool.display_order}
                  </span>
                  
                  {pool.stake_token_logo && (
                    <img src={pool.stake_token_logo} alt="" className="w-8 h-8 rounded-full" />
                  )}
                  
                  <h3 className="text-xl font-bold text-white">{pool.title}</h3>
                  
                  {pool.is_rejected ? (
                    <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full border border-red-500/30">
                      <XCircle className="h-3 w-3" />
                      Rejected
                    </span>
                  ) : pool.is_featured ? (
                    <span className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/30">
                      <BadgeCheck className="h-3 w-3" />
                      Approved
                    </span>
                  ) : pool.pending_approval ? (
                    <span className="flex items-center gap-1 px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full border border-cyan-500/30">
                      <Sparkles className="h-3 w-3" />
                      Submitted
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full border border-amber-500/30">
                      <Clock className="h-3 w-3" />
                      Pending
                    </span>
                  )}
                  
                  {pool.is_active ? (
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                      Inactive
                    </span>
                  )}
                  
                  {pool.created_at && (
                    <span className="text-xs text-zinc-500">
                      {new Date(pool.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Creator Info */}
                {(pool.creator_wallet || pool.created_by) && (
                  <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                    {(() => {
                      // Try to find creator by wallet first, then by created_by id
                      const creator = pool.creator_wallet 
                        ? creatorProfiles[pool.creator_wallet.toLowerCase()] 
                        : creatorProfiles[pool.created_by];
                      return (
                        <>
                          <div className="relative">
                            {creator?.avatar_url ? (
                              <img 
                                src={creator.avatar_url} 
                                alt="" 
                                className="w-10 h-10 rounded-full border-2 border-purple-500/50"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                                <span className="text-zinc-400 text-sm">?</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {creator?.arena_username ? (
                                <span className="text-purple-400 font-medium">@{creator.arena_username}</span>
                              ) : creator?.display_name ? (
                                <span className="text-white/80">{creator.display_name}</span>
                              ) : (
                                <span className="text-zinc-500 italic">Unknown user</span>
                              )}
                            </div>
                            <code className="text-white/50 font-mono text-xs">
                              {pool.creator_wallet 
                                ? `${pool.creator_wallet.slice(0, 8)}...${pool.creator_wallet.slice(-6)}`
                                : creator?.wallet_address 
                                  ? `${creator.wallet_address.slice(0, 8)}...${creator.wallet_address.slice(-6)}`
                                  : pool.created_by?.slice(0, 12) + '...'
                              }
                            </code>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-white/60">Staking Contract:</p>
                    <code className="text-white/80 font-mono text-xs break-all">
                      {pool.staking_contract_address}
                    </code>
                  </div>
                  <div>
                    <p className="text-white/60">Reward Pool:</p>
                    <code className="text-white/80 font-mono text-xs break-all">
                      {pool.reward_pool_address}
                    </code>
                  </div>
                  <div>
                    <p className="text-white/60 flex items-center gap-2">
                      Stake Token:
                      {(() => {
                        const tokenInfo = getTokenInfo(pool.stake_token_address);
                        const logo = getTokenLogo(pool.stake_token_address);
                        return logo ? (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/20 rounded text-green-400 text-[10px]">
                            <img src={logo} alt="" className="w-4 h-4 rounded-full" />
                            {tokenInfo?.token_symbol}
                          </span>
                        ) : null;
                      })()}
                    </p>
                    <code className="text-white/80 font-mono text-xs break-all">
                      {pool.stake_token_address}
                    </code>
                  </div>
                  <div>
                    <p className="text-white/60 flex items-center gap-2">
                      Reward Token:
                      {(() => {
                        const tokenInfo = getTokenInfo(pool.reward_token_address);
                        const logo = getTokenLogo(pool.reward_token_address);
                        return logo ? (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/20 rounded text-green-400 text-[10px]">
                            <img src={logo} alt="" className="w-4 h-4 rounded-full" />
                            {tokenInfo?.token_symbol}
                          </span>
                        ) : null;
                      })()}
                    </p>
                    <code className="text-white/80 font-mono text-xs break-all">
                      {pool.reward_token_address}
                    </code>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 ml-4">
                {pool.is_rejected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnreject(pool)}
                    className="gap-2 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20"
                    title="Move back to submitted"
                  >
                    <Sparkles className="h-4 w-4" />
                    Restore
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleFeatured(pool)}
                      className={`gap-2 ${pool.is_featured ? 'border-blue-500 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'border-amber-500/50 text-amber-400 hover:bg-amber-500/20'}`}
                      title={pool.is_featured ? "Remove approval" : "Approve pool"}
                    >
                      <BadgeCheck className="h-4 w-4" />
                      {pool.is_featured ? "Approved" : "Approve"}
                    </Button>
                    {!pool.is_featured && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleReject(pool);
                        }}
                        className="gap-2 border-red-500/50 text-red-400 hover:bg-red-500/20 relative z-10"
                        title="Reject this pool"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    )}
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(pool)}
                  className="gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(pool.id)}
                  className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {filteredPools.length === 0 && (
          <Card className="bg-zinc-900/50 border-zinc-800/40 p-12 text-center">
            <Coins className="h-12 w-12 text-white/20 mx-auto mb-4" />
            {poolSearchQuery ? (
              <>
                <p className="text-white/40">No pools found matching "{poolSearchQuery}"</p>
                <Button variant="ghost" className="mt-2" onClick={() => setPoolSearchQuery("")}>
                  Clear search
                </Button>
              </>
            ) : activeTab === "approved" ? (
              <p className="text-white/40">No approved pools yet</p>
            ) : activeTab === "rejected" ? (
              <p className="text-white/40">No rejected pools</p>
            ) : activeTab === "submitted" ? (
              <p className="text-white/40">No pools awaiting review</p>
            ) : activeTab === "pending" ? (
              <p className="text-white/40">No pending pools</p>
            ) : (
              <>
                <p className="text-white/40">No staking pools yet</p>
                <p className="text-white/30 text-sm">Create your first pool to get started</p>
              </>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
