import { useState, useEffect, useCallback } from 'react';
import { Bot, Settings, Activity, Users, Heart, Send, RefreshCw, Zap, CheckCircle2, XCircle, Loader2, MessageCircle, UserPlus, ThumbsUp, FileText, BarChart3, Sparkles, Rocket, Globe, Image, Shield, Bell, TrendingUp, DollarSign, Pencil, Save, X, Coins, AlertTriangle, Copy, Check, Key, Brain, Radio, ImageIcon, Gift, Trophy, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { useWeb3Auth } from '@/hooks/useWeb3Auth';
import { useArenaTransaction } from '@/hooks/useArenaTransaction';
import { AgentFeedTab } from '@/components/agent/AgentFeedTab';
import { AvloAIIcon } from '@/components/icons/AvloAIIcon';

import { AgentNotificationsTab } from '@/components/agent/AgentNotificationsTab';
import { AgentSharesTab } from '@/components/agent/AgentSharesTab';
import { AgentErrorBoundary } from '@/components/agent/AgentErrorBoundary';
import { CustomAISettings } from '@/components/agent/CustomAISettings';
import { AutomationLimitsSettings } from '@/components/agent/AutomationLimitsSettings';
import { AIPersonalitySettings } from '@/components/agent/AIPersonalitySettings';

import { TransactionProgress } from '@/components/TransactionProgress';
import { InsufficientBalancePopup } from '@/components/InsufficientBalancePopup';
import { AgentWalletManager } from '@/components/agent/AgentWalletManager';
import { AgentKnowledgeTab } from '@/components/agent/AgentKnowledgeTab';
import { AgentLiveTab } from '@/components/agent/AgentLiveTab';
import { AgentActivityFeed } from '@/components/agent/AgentActivityFeed';
import { AgentStatsTab } from '@/components/agent/AgentStatsTab';
import { AgentLeaderboardTab } from '@/components/agent/AgentLeaderboardTab';
import { InsufficientGasPopup } from '@/components/InsufficientGasPopup';
import { PrivateKeyConfirmationModal } from '@/components/agent/PrivateKeyConfirmationModal';
import { ApiKeyManagement } from '@/components/agent/ApiKeyManagement';
import { AgentRateLimitsTab } from '@/components/agent/AgentRateLimitsTab';
import { AgentPaymentsTab } from '@/components/agent/AgentPaymentsTab';
import { AgentMediaUpload } from '@/components/agent/AgentMediaUpload';
import { JsonRpcProvider, Contract, parseUnits } from 'ethers';
import avloLogo from '@/assets/avlo-logo.jpg';
import { useAvloPrice } from '@/hooks/useAvloPrice';


// Foundation wallet for agent creation payments
const FOUNDATION_WALLET = '0xB799CD1f2ED5dB96ea94EdF367fBA2d90dfd9634';

// AVLO Token contract
const AVLO_TOKEN_ADDRESS = '0x54eEeB249E3AE445f21eb006DEbB33eFa2B4b3Bb';

// Agent creation cost: fetched from game_config, default 10M
const DEFAULT_AGENT_CREATION_COST = 10_000_000;

interface ArenaAgent {
  id: string;
  agent_id: string;
  agent_handle: string;
  agent_name: string;
  api_key_hint: string;
  bio: string | null;
  profile_picture_url: string | null;
  banner_url?: string | null;
  is_active: boolean;
  auto_post_sync: boolean;
  auto_follow: boolean;
  auto_like: boolean;
  auto_reply: boolean;
  follower_count: number;
  following_count: number;
  total_posts: number;
  total_likes_received: number;
  last_sync_at: string | null;
  created_at: string;
  verification_code: string | null;
  is_verified: boolean;
  triage_status?: string;
  personality_style?: string;
  personality_traits?: string[];
  custom_instructions?: string | null;
}

interface AgentLog {
  id: string;
  action_type: string;
  action_data: any;
  status: string;
  error_message: string | null;
  created_at: string;
}

const AvaAI = () => {
  const { profile } = useWalletAuth();
  const { isArena, getArenaToken, getUserProfile, walletAddress } = useWeb3Auth();
  const { sendTokenTransfer, isArena: isArenaWallet } = useArenaTransaction();
  const [agents, setAgents] = useState<ArenaAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConverting, setIsConverting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [arenaProfile, setArenaProfile] = useState<any>(null);
  const [arenaProfileFetched, setArenaProfileFetched] = useState(false);
  
  // Real on-chain AVLO balance for token transfers
  const [walletAvloBalance, setWalletAvloBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(true);
  
  // Form state for new agent creation
  const [formHandle, setFormHandle] = useState('');
  const [formName, setFormName] = useState('');
  const [formBio, setFormBio] = useState('');
  const [formProfilePicture, setFormProfilePicture] = useState('');

  // Get current selected agent
  const agent = agents.find(a => a.id === selectedAgentId) || null;

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editHandle, setEditHandle] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editProfilePicture, setEditProfilePicture] = useState('');
  const [editBannerUrl, setEditBannerUrl] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Progress state for agent creation
  const [txProgress, setTxProgress] = useState<{
    isOpen: boolean;
    status: 'waiting' | 'processing' | 'success' | 'error';
    message: string;
    txHash: string | null;
  }>({ isOpen: false, status: 'waiting', message: '', txHash: null });

  // Insufficient balance popup
  const [showInsufficientBalance, setShowInsufficientBalance] = useState(false);
  const [showInsufficientGas, setShowInsufficientGas] = useState(false);
  const [agentCreationCost, setAgentCreationCost] = useState(DEFAULT_AGENT_CREATION_COST);
  const { price: avloPrice, formatAvloWithUsd } = useAvloPrice();
  const creationCostUsd = formatAvloWithUsd(agentCreationCost).usd;

  
  // Retry state: if payment succeeded but agent creation failed
  const [pendingPaymentTxHash, setPendingPaymentTxHash] = useState<string | null>(null);
  const [pendingCreateParams, setPendingCreateParams] = useState<{
    handle: string; name: string; bio: string; profilePictureUrl: string; bannerUrl: string | null;
  } | null>(null);
  
  // Agent wallet info popup (shows private key ONCE after creation)
  const [agentWalletInfo, setAgentWalletInfo] = useState<{
    isOpen: boolean;
    address: string;
    privateKey: string;
    agentName: string;
  } | null>(null);

  // Fetch real on-chain AVLO balance
  const fetchWalletAvloBalance = useCallback(async () => {
    if (!walletAddress) {
      setWalletAvloBalance(0);
      setBalanceLoading(false);
      return;
    }

    try {
      const provider = new JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc');
      const contract = new Contract(
        AVLO_TOKEN_ADDRESS,
        ['function balanceOf(address owner) view returns (uint256)'],
        provider
      );
      const rawBalance = await contract.balanceOf(walletAddress);
      const balance = Number(rawBalance) / 1e18;
      setWalletAvloBalance(balance);
    } catch (error) {
      console.error('Error fetching AVLO balance:', error);
      setWalletAvloBalance(0);
    } finally {
      setBalanceLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchWalletAvloBalance();
  }, [fetchWalletAvloBalance]);

  // Fetch agent creation cost from game_config
  useEffect(() => {
    const fetchCreationCost = async () => {
      try {
        const { data } = await supabase
          .from('game_config')
          .select('config_value')
          .eq('config_key', 'agent_creation_cost')
          .single();
        if (data?.config_value != null) {
          const val = typeof data.config_value === 'object' && data.config_value !== null
            ? (data.config_value as any).value ?? data.config_value
            : data.config_value;
          setAgentCreationCost(Number(val));
        }
      } catch (e) {
        console.error('Failed to fetch agent creation cost:', e);
      }
    };
    fetchCreationCost();
  }, []);

  useEffect(() => {
    if (profile?.id) {
      fetchAgents();
    }
  }, [profile?.id]);

  // Automation loop (previously ran while this page is open)
  // IMPORTANT: Automations now run 24/7 in the backend. Keeping a client-side loop
  // can cause duplicate actions and spam.
  useEffect(() => {
    // Disabled by design.
  }, []);

  // Fetch Arena profile when in Arena environment - only once on mount
  useEffect(() => {
    const fetchArenaProfile = async () => {
      if (isArena && !arenaProfileFetched) {
        const arenaData = await getUserProfile();
        if (arenaData) {
          setArenaProfile(arenaData);
          // Only set form defaults if they haven't been modified by user
          if (!formHandle) setFormHandle(arenaData.handle || '');
          if (!formName) setFormName(arenaData.userName || arenaData.name || '');
          if (!formBio) setFormBio(arenaData.bio || 'AvaLove AI Agent');
          setArenaProfileFetched(true);
        }
      }
    };
    fetchArenaProfile();
  }, [isArena]);

  const fetchAgents = async () => {
    if (!profile?.id) return;
    
    setIsLoading(true);
    try {
      const { data: agentsData, error } = await supabase
        .from('arena_agents')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Parse personality_traits for each agent
      const parsedAgents: ArenaAgent[] = (agentsData || []).map(a => {
        const traits = a.personality_traits;
        const parsedTraits: string[] = Array.isArray(traits) ? traits as string[] : [];
        return { ...a, personality_traits: parsedTraits };
      });
      
      setAgents(parsedAgents);
      
      // Auto-select first agent if none selected
      if (parsedAgents.length > 0 && !selectedAgentId) {
        setSelectedAgentId(parsedAgents[0].id);
        fetchLogs(parsedAgents[0].id);
      } else if (selectedAgentId) {
        fetchLogs(selectedAgentId);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async (agentId: string) => {
    try {
      const { data, error } = await supabase
        .from('arena_agent_logs')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  // Check if user has enough AVLO balance
  const hasEnoughBalance = walletAvloBalance >= agentCreationCost;

  // Create AI agent - requires 10M AVLO payment
  const handleCreateAgent = async () => {
    if (!profile?.id || !walletAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    // Use custom handle if provided, otherwise use Arena handle
    const handle = formHandle?.trim() 
      ? formHandle.toLowerCase().replace(/[^a-z0-9-_]/g, '')
      : (arenaProfile?.handle || profile?.username || walletAddress?.slice(2, 10))?.toLowerCase().replace(/[^a-z0-9-_]/g, '') || '';
    const name = formName || arenaProfile?.userName || profile?.display_name || `${handle} AI`;
    
    if (!handle) {
      toast.error('Please enter a handle for your agent');
      return;
    }
    
    if (!name) {
      toast.error('Please enter a name for your agent');
      return;
    }

    const bio = formBio || arenaProfile?.bio || 'AvaLove AI Agent';
    const profilePictureUrl = formProfilePicture || arenaProfile?.profilePicture || profile?.avatar_url;
    const bannerUrl = arenaProfile?.bannerPicture || null;

    setIsConverting(true);

    try {
      let paymentTxHash = pendingPaymentTxHash;

      // Step 1: Only transfer if we don't already have a successful payment
      if (!paymentTxHash) {
        // Check AVLO balance
        if (walletAvloBalance < agentCreationCost) {
          setShowInsufficientBalance(true);
          setIsConverting(false);
          return;
        }

        setTxProgress({
          isOpen: true,
          status: 'waiting',
          message: 'Please confirm the transaction in your wallet...',
          txHash: null
        });

        const amount = parseUnits(agentCreationCost.toString(), 18);
        const txResult = await sendTokenTransfer(AVLO_TOKEN_ADDRESS, FOUNDATION_WALLET, amount);

        if (!txResult.success) {
          const errMsg = (txResult.error || '').toLowerCase();
          if (errMsg.includes('rejected') || errMsg.includes('denied') || errMsg.includes('4001')) {
            toast.error('Transaction was rejected by user');
          } else if (errMsg.includes('gas') || errMsg.includes('insufficient funds') || errMsg.includes('insufficient balance for transfer') || errMsg.includes('exceeds balance')) {
            setShowInsufficientGas(true);
          } else if (errMsg.includes('nonce') || errMsg.includes('replacement')) {
            toast.error('Transaction conflict — please wait a moment and try again');
          } else {
            // Show detailed error so users can report it
            const displayError = txResult.error || 'Unknown error';
            toast.error(`Transaction failed: ${displayError.slice(0, 120)}`, { duration: 8000 });
            console.error('[AGENT CREATE] Token transfer failed:', txResult.error);
          }
          setTxProgress({ isOpen: false, status: 'waiting', message: '', txHash: null });
          setIsConverting(false);
          return;
        }

        paymentTxHash = txResult.txHash;

        // Save payment info immediately so we can retry if creation fails
        setPendingPaymentTxHash(paymentTxHash);
        setPendingCreateParams({ handle, name, bio, profilePictureUrl: profilePictureUrl || '', bannerUrl });
      }

      // Step 2: Create agent via edge function
      setTxProgress({
        isOpen: true,
        status: 'processing',
        message: pendingPaymentTxHash ? 'Retrying agent creation with existing payment...' : 'Payment confirmed! Creating your AI Agent...',
        txHash: paymentTxHash
      });

      const createParams = pendingCreateParams || { handle, name, bio, profilePictureUrl: profilePictureUrl || '', bannerUrl };

      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: {
          action: 'create',
          userId: profile.id,
          walletAddress,
          handle: createParams.handle,
          name: createParams.name,
          bio: createParams.bio,
          profilePictureUrl: createParams.profilePictureUrl,
          bannerUrl: createParams.bannerUrl,
          paymentTxHash: paymentTxHash,
        }
      });

      if (error) throw error;
      
      // Handle ADDRESS_IN_USE error
      if (data?.error === 'ADDRESS_IN_USE') {
        toast.error('This wallet already has an Arena agent. Contact support if you need help.');
        // Clear pending payment since agent exists
        setPendingPaymentTxHash(null);
        setPendingCreateParams(null);
        setTxProgress({ isOpen: false, status: 'waiting', message: '', txHash: null });
        return;
      }
      
      if (data?.error) throw new Error(data.error);

      // Success! Clear pending state
      setPendingPaymentTxHash(null);
      setPendingCreateParams(null);

      setTxProgress({
        isOpen: true,
        status: 'success',
        message: '🎉 AI Agent created successfully!',
        txHash: paymentTxHash
      });

      // Refresh AVLO balance
      fetchWalletAvloBalance();

      // Show wallet info popup if a new wallet was generated
      if (data?.walletInfo) {
        setTimeout(() => {
          setTxProgress({ isOpen: false, status: 'waiting', message: '', txHash: null });
          setAgentWalletInfo({
            isOpen: true,
            address: data.walletInfo.address,
            privateKey: data.walletInfo.privateKey,
            agentName: createParams.name,
          });
        }, 2000);
      } else {
        setTimeout(() => {
          setTxProgress({ isOpen: false, status: 'waiting', message: '', txHash: null });
        }, 3000);
      }

      toast.success('AI Agent created successfully! 🤖');
      setShowCreateForm(false);
      setFormHandle('');
      setFormName('');
      setFormBio('');
      setFormProfilePicture('');
      setArenaProfileFetched(false);
      fetchAgents();
    } catch (error: any) {
      console.error('Error creating agent:', error);
      
      // Payment was successful but creation failed - show retry option
      const hasPayment = !!pendingPaymentTxHash;
      
      setTxProgress({
        isOpen: true,
        status: 'error',
        message: hasPayment 
          ? `Agent creation failed but your payment is safe. Click "Create" again to retry without re-paying. Error: ${error.message || 'Unknown error'}`
          : (error.message || 'Failed to create agent'),
        txHash: pendingPaymentTxHash
      });

      if (hasPayment) {
        toast.error('Agent creation failed. Your payment is saved - click Create again to retry.', { duration: 8000 });
      } else {
        toast.error(error.message || 'Failed to create agent.');
      }

      setTimeout(() => {
        setTxProgress({ isOpen: false, status: 'waiting', message: '', txHash: null });
      }, hasPayment ? 10000 : 3000);
    } finally {
      setIsConverting(false);
    }
  };

  const handleSyncAgent = async () => {
    if (!agent) return;

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: {
          action: 'sync',
          agentId: agent.id
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Agent synced successfully!');
      fetchAgents();
    } catch (error: any) {
      console.error('Error syncing agent:', error);
      toast.error(error.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateSettings = async (settings: Partial<ArenaAgent>) => {
    if (!agent) return;

    try {
      const { error } = await supabase
        .from('arena_agents')
        .update(settings)
        .eq('id', agent.id);

      if (error) throw error;
      // Update agent in the agents array
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, ...settings } : a));
      toast.success('Settings updated');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    }
  };

  const handleTestPost = async () => {
    if (!agent) return;

    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: {
          action: 'post',
          agentId: agent.id,
          content: `🤖 Test post from AvaLove AI Agent!\n\nThis is an automated test at ${new Date().toLocaleString()}\n\n#AvaLove #ArenaAI`
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Test post sent to Arena!');
      fetchLogs(agent.id);
    } catch (error: any) {
      console.error('Error posting:', error);
      toast.error(error.message || 'Failed to post');
    }
  };

  const handleStartEditProfile = () => {
    if (!agent) return;
    setEditName(agent.agent_name || '');
    setEditHandle(agent.agent_handle || '');
    setEditBio(agent.bio || '');
    setEditProfilePicture(agent.profile_picture_url || '');
    setEditBannerUrl(agent.banner_url || '');
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!agent) return;

    setIsSavingProfile(true);
    try {
      const updatePayload: Record<string, string | undefined> = {};
      
      // Only send fields that changed (exclude banner - handled separately)
      if (editName !== agent.agent_name) updatePayload.userName = editName || undefined;
      if (editHandle !== agent.agent_handle) updatePayload.handle = editHandle || undefined;
      if (editBio !== agent.bio) updatePayload.bio = editBio || undefined;
      if (editProfilePicture !== agent.profile_picture_url) updatePayload.profilePicture = editProfilePicture || undefined;

      const bannerChanged = editBannerUrl !== (agent.banner_url || '');
      const hasProfileChanges = Object.keys(updatePayload).length > 0;

      if (!hasProfileChanges && !bannerChanged) {
        toast.info('No changes to save');
        setIsEditingProfile(false);
        return;
      }

      // Update profile fields (name, bio, avatar, handle) via update_profile
      if (hasProfileChanges) {
        const { data, error } = await supabase.functions.invoke('arena-agent', {
          body: {
            action: 'update_profile',
            agentId: agent.id,
            ...updatePayload
          }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }

      // Update banner separately via update_banner action
      if (bannerChanged && editBannerUrl) {
        const { data: bannerData, error: bannerError } = await supabase.functions.invoke('arena-agent', {
          body: {
            action: 'update_banner',
            agentId: agent.id,
            bannerUrl: editBannerUrl
          }
        });
        if (bannerError) throw bannerError;
        if (bannerData?.error) throw new Error(bannerData.error);
      }

      // Build success message based on what was updated
      const updatedFields: string[] = [];
      if (updatePayload.userName) updatedFields.push('name');
      if (updatePayload.bio) updatedFields.push('bio');
      if (updatePayload.profilePicture) updatedFields.push('avatar');
      if (bannerChanged) updatedFields.push('banner');
      
      // Handle username/handle update - Arena may not allow this
      if (updatePayload.handle) {
        updatedFields.push('username');
      }

      if (updatedFields.length > 0) {
        toast.success(`Updated: ${updatedFields.join(', ')}! ✨`);
      } else {
        toast.success('Profile synced with Arena');
      }
      
      setIsEditingProfile(false);
      fetchAgents();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'post': return <FileText className="w-4 h-4 text-pink-400" />;
      case 'like': return <ThumbsUp className="w-4 h-4 text-orange-400" />;
      case 'follow': return <UserPlus className="w-4 h-4 text-cyan-400" />;
      case 'reply': return <MessageCircle className="w-4 h-4 text-purple-400" />;
      case 'sync': return <RefreshCw className="w-4 h-4 text-green-400" />;
      case 'register': return <Rocket className="w-4 h-4 text-yellow-400" />;
      default: return <Activity className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Success</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Header */}
      <div className="bg-gradient-to-b from-cyan-950/30 to-transparent border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <AvloAIIcon size="lg" animated={true} />
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  AvaAI
                  <Badge className="bg-cyan-500/20 text-cyan-400 text-xs">Beta</Badge>
                </h1>
                <p className="text-sm text-zinc-400">Arena AI Agent Integration</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {agents.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/60 border border-zinc-700/50 rounded-full hover:border-zinc-600 transition-colors cursor-pointer">
                      <Avatar className="w-6 h-6">
                        {agent?.profile_picture_url && <AvatarImage src={agent.profile_picture_url} />}
                        <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-[10px]">
                          {agent?.agent_name?.charAt(0) || 'A'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-zinc-300 font-medium max-w-[120px] truncate">{agent?.agent_name || 'Select Agent'}</span>
                      {agent?.is_verified && <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />}
                      <ChevronDown className="w-3 h-3 text-zinc-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 bg-zinc-900 border-zinc-700 z-50">
                    <DropdownMenuLabel className="text-zinc-400 text-xs">Switch Agent</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-zinc-800" />
                    {agents.map((a) => (
                      <DropdownMenuItem
                        key={a.id}
                        onClick={() => {
                          setSelectedAgentId(a.id);
                          fetchLogs(a.id);
                        }}
                        className={`flex items-center gap-2 cursor-pointer ${selectedAgentId === a.id ? 'bg-pink-500/10 text-pink-400' : 'text-zinc-300'}`}
                      >
                        <Avatar className="w-7 h-7">
                          {a.profile_picture_url && <AvatarImage src={a.profile_picture_url} />}
                          <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-[9px]">
                            {a.agent_name?.charAt(0) || 'A'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{a.agent_name}</p>
                          <p className="text-[10px] text-zinc-500">@{a.agent_handle}</p>
                        </div>
                        {a.triage_status === 'done' && (
                          <Badge className="text-[9px] h-4 bg-green-500/20 text-green-400 border-green-500/30">Approved</Badge>
                        )}
                        {a.triage_status === 'rejected' && (
                          <Badge className="text-[9px] h-4 bg-red-500/20 text-red-400 border-red-500/30">Rejected</Badge>
                        )}
                        {(!a.triage_status || a.triage_status === 'pending') && (
                          <Badge className="text-[9px] h-4 bg-amber-500/20 text-amber-400 border-amber-500/30">Pending</Badge>
                        )}
                        {a.is_active && <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {agent && (
                <Button
                  onClick={handleSyncAgent}
                  disabled={isSyncing}
                  variant="outline"
                  className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                  Sync
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Agent Triage Status Banner */}
        {agent && (
          <div className={`mb-4 rounded-xl border px-4 py-3 flex items-center gap-3 ${
            agent.triage_status === 'done' 
              ? 'bg-green-500/10 border-green-500/30' 
              : agent.triage_status === 'rejected'
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-amber-500/10 border-amber-500/30'
          }`}>
            {agent.triage_status === 'done' && (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-400">Agent Approved</p>
                  <p className="text-xs text-green-400/70">Your agent has been reviewed and approved by the admin team.</p>
                </div>
              </>
            )}
            {agent.triage_status === 'rejected' && (
              <>
                <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-400">Agent Rejected</p>
                  <p className="text-xs text-red-400/70">Your agent has been reviewed and rejected. Please update your agent configuration and contact the team.</p>
                </div>
              </>
            )}
            {(!agent.triage_status || agent.triage_status === 'pending') && (
              <>
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-400">Pending Review</p>
                  <p className="text-xs text-amber-400/70">Your agent is awaiting admin review. You'll see the status update here once reviewed.</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Create New Agent Form */}
        {agents.length === 0 ? (
          // Create Agent UI
          <div className="max-w-2xl mx-auto space-y-8">
            {/* Pending Payment Retry Banner */}
            {pendingPaymentTxHash && (
              <div className="p-4 bg-orange-500/10 border border-orange-500/40 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-orange-300 font-medium text-sm">Payment completed but agent creation failed</p>
                    <p className="text-orange-400/70 text-xs mt-1">
                      Your payment tx <code className="font-mono bg-orange-950/30 px-1 rounded">{pendingPaymentTxHash.slice(0, 10)}...{pendingPaymentTxHash.slice(-6)}</code> was successful. Click the Create button below to retry without re-paying.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {/* Hero Section */}
            <div className="text-center py-6">
              <div className="flex items-center justify-between mb-4">
                {agents.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowCreateForm(false);
                      setFormHandle('');
                      setFormName('');
                      setFormBio('');
                      setFormProfilePicture('');
                    }}
                    className="text-zinc-400"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                )}
              </div>
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-6">
                <Bot className="w-10 h-10 text-cyan-400" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-3">
                Create AI Agent
              </h2>
               <p className="text-zinc-400 max-w-xl mx-auto">
                {agents.length > 0 
                   ? `Create an additional AI Agent with a different handle. Each agent costs ${agentCreationCost.toLocaleString()} AVLO${avloPrice > 0 ? ` (${creationCostUsd})` : ''}.`
                   : `Launch your own AI Agent on Arena. Automate content sharing, engage with users, and grow your presence automatically. Costs ${agentCreationCost.toLocaleString()} AVLO${avloPrice > 0 ? ` (${creationCostUsd})` : ''}.`}
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="pt-4 pb-3 text-center">
                  <Send className="w-6 h-6 text-pink-400 mx-auto mb-2" />
                  <h3 className="font-medium text-white text-sm">Auto-Post</h3>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="pt-4 pb-3 text-center">
                  <Users className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
                  <h3 className="font-medium text-white text-sm">Social Auto</h3>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="pt-4 pb-3 text-center">
                  <BarChart3 className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                  <h3 className="font-medium text-white text-sm">Analytics</h3>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="pt-4 pb-3 text-center">
                  <Sparkles className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                  <h3 className="font-medium text-white text-sm">AI Replies</h3>
                </CardContent>
              </Card>
            </div>

            {/* Agent Setup Form */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-cyan-400" />
                  {agents.length > 0 ? 'New Agent Details' : 'Agent Details'}
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Fill in your agent details. The API key will be generated automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Wallet Preview */}
                <div className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-12 h-12 border-2 border-cyan-500/30">
                      <AvatarImage src={arenaProfile?.profilePicture || profile?.avatar_url} />
                      <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white">
                        {(formName || profile?.display_name || 'A').charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm text-zinc-400">Connected Wallet</p>
                      <p className="font-mono text-white">
                        {walletAddress?.slice(0, 10)}...{walletAddress?.slice(-8)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Agent Handle - Now Editable */}
                <div className="space-y-2">
                  <Label className="text-white">Agent Handle *</Label>
                  <div className="flex items-center">
                    <span className="px-3 py-2 bg-zinc-800 border border-r-0 border-zinc-700 rounded-l-lg text-cyan-400 font-mono">@</span>
                    <Input
                      value={formHandle}
                      onChange={(e) => setFormHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                      placeholder={arenaProfile?.handle || profile?.username || 'myagent'}
                      className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 rounded-l-none"
                      maxLength={30}
                    />
                  </div>
                  <p className="text-xs text-zinc-500">
                    Choose a unique handle for your agent. Leave empty to use your Arena username.
                  </p>
                </div>

                {/* Agent Name */}
                <div className="space-y-2">
                  <Label className="text-white">Agent Name *</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="My AI Agent"
                    className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
                    maxLength={50}
                  />
                </div>

                {/* Agent Bio */}
                <div className="space-y-2">
                  <Label className="text-white">Agent Bio</Label>
                  <Textarea
                    value={formBio}
                    onChange={(e) => setFormBio(e.target.value)}
                    placeholder="Describe what your AI agent does..."
                    className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 resize-none"
                    rows={2}
                    maxLength={200}
                  />
                </div>

                {/* Profile Picture URL - Optional */}
                <div className="space-y-2">
                  <Label className="text-white">Profile Picture URL <span className="text-zinc-500 text-xs">(optional)</span></Label>
                  <Input
                    value={formProfilePicture}
                    onChange={(e) => setFormProfilePicture(e.target.value)}
                    placeholder="https://example.com/avatar.png"
                    className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
                  />
                  <p className="text-xs text-zinc-500">
                    Leave empty to use your current profile picture.
                  </p>
                  {formProfilePicture && (
                    <div className="flex items-center gap-3 p-2 bg-zinc-800/30 rounded-lg">
                      <img 
                        src={formProfilePicture} 
                        alt="Preview" 
                        className="w-10 h-10 rounded-full object-cover border border-zinc-700"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <span className="text-xs text-zinc-400">Preview</span>
                    </div>
                  )}
                </div>

                {/* Payment Info Card */}
                <div className="space-y-4">
                  {/* Security Warning */}
                  <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="text-red-400 font-medium mb-2">⚠️ Important Security Notice</p>
                        <ul className="space-y-1 text-zinc-400 text-xs">
                          <li>• <span className="text-red-300">Do NOT create agents during live streams</span> - your private key will be visible</li>
                          <li>• The private key is shown <span className="text-red-300">only once</span> — save a backup!</li>
                          <li>• Private key is encrypted (AES-256-GCM) and stored server-side for agent operations</li>
                          <li>• You can remove the stored key anytime from the Wallet tab</li>
                          <li>• Make sure you're in a private, secure environment</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Encrypted key info removed - can be configured later from Wallet tab */}

                  {/* Payment Info Card - 10M AVLO Required */}
                  <div className="p-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-lg border border-orange-500/30">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <img src={avloLogo} alt="AVLO" className="w-8 h-8 rounded-full" />
                      </div>
                       <div className="flex-1">
                <p className="text-white font-bold text-lg">{agentCreationCost.toLocaleString()} AVLO</p>
                        <p className="text-orange-400 text-sm">Required to create an AI Agent</p>
                        {avloPrice > 0 && <p className="text-green-400 text-xs font-medium">≈ {creationCostUsd}</p>}
                      </div>
                      {balanceLoading ? (
                        <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Loading...
                        </Badge>
                      ) : hasEnoughBalance ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Sufficient
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          <XCircle className="w-3 h-3 mr-1" />
                          Insufficient
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-orange-500/20">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-400">Your Wallet Balance:</span>
                        {balanceLoading ? (
                          <span className="text-zinc-400 font-medium flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Loading...
                          </span>
                        ) : (
                          <span className={hasEnoughBalance ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
                            {walletAvloBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} AVLO
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Create Button */}
                <Button
                  onClick={handleCreateAgent}
                  disabled={isConverting || !walletAddress || (!hasEnoughBalance && !pendingPaymentTxHash)}
                  className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white h-12 text-lg disabled:opacity-50"
                >
                  {isConverting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : pendingPaymentTxHash ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2" />
                      Retry Agent Creation (Payment Already Done)
                    </>
                  ) : !hasEnoughBalance ? (
                    <>
                      <XCircle className="w-5 h-5 mr-2" />
                      Insufficient AVLO Balance
                    </>
                  ) : (
                    <>
                      <Rocket className="w-5 h-5 mr-2" />
                      Create AI Agent ({agentCreationCost >= 1_000_000 ? (agentCreationCost / 1_000_000) + 'M' : agentCreationCost.toLocaleString()} AVLO)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : agent ? (
          // Has agent - Show dashboard
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="w-full bg-zinc-900/50 border border-zinc-800 flex justify-start md:justify-center h-auto gap-0.5 sm:gap-1 p-1 overflow-x-auto scrollbar-hide">
              <TabsTrigger value="overview" className="flex-1 min-w-[40px] max-w-[100px] text-white data-[state=active]:bg-cyan-500/20 text-xs sm:text-sm px-1.5 sm:px-3 py-2">
                <BarChart3 className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden md:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="my-agents" className="flex-1 min-w-[40px] max-w-[120px] text-white data-[state=active]:bg-pink-500/20 text-xs sm:text-sm px-1.5 sm:px-3 py-2">
                <Bot className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden md:inline">Your Agents</span>
              </TabsTrigger>
              <TabsTrigger value="feed" className="flex-1 min-w-[40px] max-w-[100px] text-white data-[state=active]:bg-pink-500/20 text-xs sm:text-sm px-1.5 sm:px-3 py-2">
                <FileText className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden md:inline">Feed</span>
              </TabsTrigger>
              <TabsTrigger value="live" className="flex-1 min-w-[40px] max-w-[100px] text-white data-[state=active]:bg-red-500/20 text-xs sm:text-sm px-1.5 sm:px-3 py-2">
                <Radio className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden md:inline">Live</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex-1 min-w-[40px] max-w-[100px] text-white data-[state=active]:bg-orange-500/20 text-xs sm:text-sm px-1.5 sm:px-3 py-2">
                <Bell className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden md:inline">Alerts</span>
              </TabsTrigger>
              <TabsTrigger value="shares" className="flex-1 min-w-[40px] max-w-[100px] text-white data-[state=active]:bg-green-500/20 text-xs sm:text-sm px-1.5 sm:px-3 py-2">
                <TrendingUp className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden md:inline">Shares</span>
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="flex-1 min-w-[40px] max-w-[100px] text-white data-[state=active]:bg-indigo-500/20 text-xs sm:text-sm px-1.5 sm:px-3 py-2">
                <Brain className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden md:inline">Brain</span>
              </TabsTrigger>
              <TabsTrigger value="wallet" className="flex-1 min-w-[40px] max-w-[100px] text-white data-[state=active]:bg-amber-500/20 text-xs sm:text-sm px-1.5 sm:px-3 py-2">
                <Key className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden md:inline">Wallet</span>
              </TabsTrigger>
              {/* x402 tab hidden for now */}
              <TabsTrigger value="settings" className="flex-1 min-w-[40px] max-w-[100px] text-white data-[state=active]:bg-zinc-500/20 text-xs sm:text-sm px-1.5 sm:px-3 py-2">
                <Settings className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden md:inline">Settings</span>
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex-1 min-w-[40px] max-w-[100px] text-white data-[state=active]:bg-yellow-500/20 text-xs sm:text-sm px-1.5 sm:px-3 py-2">
                <TrendingUp className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden md:inline">Stats</span>
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="flex-1 min-w-[40px] max-w-[100px] text-white data-[state=active]:bg-orange-500/20 text-xs sm:text-sm px-1.5 sm:px-3 py-2">
                <Trophy className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden md:inline">Leaderboard</span>
              </TabsTrigger>
            </TabsList>

            {/* Your Agents Tab */}
            <TabsContent value="my-agents" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Your AI Agents</h3>
                <Button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  size="sm"
                  className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
                >
                  <Bot className="w-4 h-4 mr-2" />
                  {showCreateForm ? 'Cancel' : 'Create New Agent'}
                </Button>
              </div>

              {showCreateForm ? (
                <div className="max-w-2xl mx-auto space-y-6">
                  <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Rocket className="w-5 h-5 text-cyan-400" />
                        New Agent Details
                      </CardTitle>
                      <CardDescription className="text-zinc-400">
                        Fill in your agent details. Each agent costs {agentCreationCost.toLocaleString()} AVLO.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-white">Agent Handle *</Label>
                        <div className="flex items-center">
                          <span className="px-3 py-2 bg-zinc-800 border border-r-0 border-zinc-700 rounded-l-lg text-cyan-400 font-mono">@</span>
                          <Input value={formHandle} onChange={(e) => setFormHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))} placeholder={arenaProfile?.handle || profile?.username || 'myagent'} className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 rounded-l-none" maxLength={30} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white">Agent Name *</Label>
                        <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="My AI Agent" className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500" maxLength={50} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white">Agent Bio</Label>
                        <Textarea value={formBio} onChange={(e) => setFormBio(e.target.value)} placeholder="Describe what your AI agent does..." className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 resize-none" rows={2} maxLength={200} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white">Profile Picture URL <span className="text-zinc-500 text-xs">(optional)</span></Label>
                        <Input value={formProfilePicture} onChange={(e) => setFormProfilePicture(e.target.value)} placeholder="https://example.com/avatar.png" className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500" />
                      </div>
                      <div className="p-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-lg border border-orange-500/30">
                        <div className="flex items-center gap-3">
                          <img src={avloLogo} alt="AVLO" className="w-8 h-8 rounded-full" />
                          <div className="flex-1">
                            <p className="text-white font-bold">{agentCreationCost.toLocaleString()} AVLO</p>
                            <p className="text-orange-400 text-xs">Required to create</p>
                            {avloPrice > 0 && <p className="text-green-400 text-xs font-medium">≈ {creationCostUsd}</p>}
                          </div>
                          {balanceLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                          ) : (
                            <span className={`text-sm font-medium ${hasEnoughBalance ? 'text-green-400' : 'text-red-400'}`}>
                              {walletAvloBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} AVLO
                            </span>
                          )}
                        </div>
                      </div>
                      <Button onClick={handleCreateAgent} disabled={isConverting || !walletAddress || (!hasEnoughBalance && !pendingPaymentTxHash)} className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white h-11">
                        {isConverting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : pendingPaymentTxHash ? <><RefreshCw className="w-4 h-4 mr-2" />Retry (Payment Done)</> : !hasEnoughBalance ? <><XCircle className="w-4 h-4 mr-2" />Insufficient AVLO</> : <><Rocket className="w-4 h-4 mr-2" />Create AI Agent ({agentCreationCost >= 1_000_000 ? (agentCreationCost / 1_000_000) + 'M' : agentCreationCost.toLocaleString()} AVLO)</>}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="space-y-3">
                  {agents.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        setSelectedAgentId(a.id);
                        fetchLogs(a.id);
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        selectedAgentId === a.id
                          ? 'bg-pink-500/10 border-pink-500/40'
                          : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <Avatar className="w-10 h-10">
                        {a.profile_picture_url && <AvatarImage src={a.profile_picture_url} />}
                        <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-sm">
                          {a.agent_name?.charAt(0) || 'A'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white truncate">{a.agent_name}</p>
                          {a.is_verified && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                          {a.is_active && <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-[9px] px-1.5 py-0">Active</Badge>}
                        </div>
                        <p className="text-xs text-zinc-500">@{a.agent_handle}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-white">{a.total_posts || 0}</p>
                        <p className="text-[10px] text-zinc-500">posts</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Verification Warning - Show if not verified */}
              {agent.verification_code && !agent.is_verified && (
                <Card className="bg-orange-500/10 border-orange-500/30">
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                        <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
                      </div>
                      <div className="flex-1 space-y-3 w-full">
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                            ⚠️ Verification Required
                          </h3>
                          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                            Your agent was created but needs to be claimed. Post the following text on Arena from your main account:
                          </p>
                        </div>
                        <div className="p-2 sm:p-3 bg-zinc-900/50 rounded-lg border border-zinc-700/50">
                          <code className="text-xs sm:text-sm text-cyan-400 block whitespace-pre-wrap break-all">
{`I'm claiming my AI Agent "${agent.agent_name}"
Verification Code: ${agent.verification_code}`}
                          </code>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            onClick={() => {
                              navigator.clipboard.writeText(`I'm claiming my AI Agent "${agent.agent_name}"\nVerification Code: ${agent.verification_code}`);
                              toast.success('Verification text copied!');
                            }}
                            variant="outline"
                            size="sm"
                            className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 text-xs sm:text-sm"
                          >
                            📋 Copy
                          </Button>
                          <a
                            href="https://arena.social"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm">
                              <Globe className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                              Arena
                            </Button>
                          </a>
                          <Button
                            onClick={async () => {
                              await handleSyncAgent();
                              fetchAgents();
                            }}
                            variant="outline"
                            size="sm"
                            className="border-zinc-700 text-zinc-400 text-xs sm:text-sm"
                          >
                            <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                            Check
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Agent Card with Banner */}
              <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
                {/* Banner Section */}
                {agent.banner_url && (
                  <div className="relative h-32 sm:h-40 md:h-48 w-full">
                    <img 
                      src={agent.banner_url} 
                      alt="Agent banner" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 to-transparent" />
                  </div>
                )}
                
                <CardContent className={agent.banner_url ? "pt-0 -mt-8 relative z-10" : "pt-6"}>
                  <div className="flex items-start gap-4">
                    <Avatar className={`w-16 h-16 border-2 border-cyan-500/30 ${agent.banner_url ? 'ring-4 ring-zinc-900' : ''}`}>
                      {agent.profile_picture_url ? (
                        <AvatarImage src={agent.profile_picture_url} />
                      ) : null}
                      <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xl">
                        {agent.agent_name?.charAt(0) || 'A'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold text-white">{agent.agent_name}</h3>
                        {agent.is_verified ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                            Pending Verification
                          </Badge>
                        )}
                        {agent.is_active && (
                          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Active</Badge>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400">@{agent.agent_handle}</p>
                      {agent.bio && <p className="text-sm text-zinc-300 mt-2">{agent.bio}</p>}
                    </div>
                    <Button 
                      onClick={handleTestPost} 
                      disabled={!agent.is_verified}
                      variant="outline" 
                      className="border-pink-500/30 text-pink-400 hover:bg-pink-500/10 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Test Post
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{agent.follower_count || 0}</p>
                        <p className="text-xs text-zinc-400">Followers</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-pink-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{agent.total_posts || 0}</p>
                        <p className="text-xs text-zinc-400">Posts</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <Heart className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{agent.total_likes_received || 0}</p>
                        <p className="text-xs text-zinc-400">Likes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <UserPlus className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{agent.following_count || 0}</p>
                        <p className="text-xs text-zinc-400">Following</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* API Key Info */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="pt-6 space-y-4">
                  {/* Warning Banner */}
                  <div className="p-4 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 rounded-lg border border-amber-500/40">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/30 flex items-center justify-center shrink-0">
                        <Key className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-amber-400 font-bold text-sm flex items-center gap-2">
                          ⚠️ IMPORTANT: Save Your API Key!
                        </h4>
                        <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                          Your API key is shown below. <span className="text-amber-400 font-semibold">Copy and store it in a safe place immediately!</span> 
                          This key is required to access your agent. If you lose it, you won't be able to recover it.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-red-500/20 text-red-400 rounded-full border border-red-500/30">
                            🔒 Store securely
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-orange-500/20 text-orange-400 rounded-full border border-orange-500/30">
                            📋 Copy now
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full border border-yellow-500/30">
                            🚫 Never share
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* API Key Display */}
                  <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5 text-yellow-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white">API Key</p>
                        <p className="text-sm text-cyan-400 font-mono truncate">{agent.api_key_hint}</p>
                        <p className="text-[10px] text-zinc-500 mt-1">
                          ℹ️ This is a preview. For the full key, go to <span className="text-cyan-400 font-medium">Settings → API</span> tab and click Copy.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(agent.api_key_hint);
                        toast.info('This is just the preview. Go to Settings > API tab for the full key.');
                      }}
                      variant="outline"
                      size="sm"
                      className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 shrink-0 ml-2"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </Button>
                  </div>

                  {agent.last_sync_at && (
                    <p className="text-xs text-zinc-500 text-right">
                      Last synced: {new Date(agent.last_sync_at).toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab with Sub-Tabs */}
            <TabsContent value="settings">
              <Tabs defaultValue="profile" className="w-full">
                {/* Vertical tabs on mobile, horizontal scroll on desktop */}
                <div className="w-full mb-4">
                  <TabsList className="flex flex-col sm:flex-row w-full bg-zinc-900/80 border border-zinc-800 p-1.5 gap-1 rounded-lg h-auto">
                    <TabsTrigger 
                      value="profile" 
                      className="w-full sm:flex-1 justify-start sm:justify-center whitespace-nowrap px-3 py-2.5 text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/20 data-[state=active]:to-purple-500/20 data-[state=active]:text-cyan-400 rounded-md"
                    >
                      <Image className="w-4 h-4 mr-2" />
                      Profile
                    </TabsTrigger>
                    <TabsTrigger 
                      value="automation" 
                      className="w-full sm:flex-1 justify-start sm:justify-center whitespace-nowrap px-3 py-2.5 text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/20 data-[state=active]:to-purple-500/20 data-[state=active]:text-cyan-400 rounded-md"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Automation
                    </TabsTrigger>
                    
                    <TabsTrigger 
                      value="custom-ai" 
                      className="w-full sm:flex-1 justify-start sm:justify-center whitespace-nowrap px-3 py-2.5 text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/20 data-[state=active]:to-purple-500/20 data-[state=active]:text-cyan-400 rounded-md"
                    >
                      <Brain className="w-4 h-4 mr-2" />
                      Custom AI
                    </TabsTrigger>
                    <TabsTrigger 
                      value="limits" 
                      className="w-full sm:flex-1 justify-start sm:justify-center whitespace-nowrap px-3 py-2.5 text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/20 data-[state=active]:to-purple-500/20 data-[state=active]:text-cyan-400 rounded-md"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Limits
                    </TabsTrigger>
                    <TabsTrigger 
                      value="rate-limits" 
                      className="w-full sm:flex-1 justify-start sm:justify-center whitespace-nowrap px-3 py-2.5 text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/20 data-[state=active]:to-purple-500/20 data-[state=active]:text-cyan-400 rounded-md"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Rate Limits
                    </TabsTrigger>
                    <TabsTrigger 
                      value="api-security" 
                      className="w-full sm:flex-1 justify-start sm:justify-center whitespace-nowrap px-3 py-2.5 text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/20 data-[state=active]:to-purple-500/20 data-[state=active]:text-cyan-400 rounded-md"
                    >
                      <Key className="w-4 h-4 mr-2" />
                      API
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Profile Sub-Tab */}
                <TabsContent value="profile" className="space-y-4">
                  <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-white flex items-center gap-2">
                            <Image className="w-5 h-5 text-cyan-400" />
                            Agent Profile
                          </CardTitle>
                          <CardDescription className="text-zinc-400">Update your agent's display name, bio, and avatar</CardDescription>
                        </div>
                        {!isEditingProfile ? (
                          <Button
                            onClick={handleStartEditProfile}
                            variant="outline"
                            size="sm"
                            className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              onClick={handleSaveProfile}
                              disabled={isSavingProfile}
                              size="sm"
                              className="bg-green-500 hover:bg-green-600 text-white"
                            >
                              {isSavingProfile ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4 mr-1" />
                              )}
                              Save
                            </Button>
                            <Button
                              onClick={() => setIsEditingProfile(false)}
                              variant="outline"
                              size="sm"
                              className="border-zinc-700 text-zinc-400"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {isEditingProfile ? (
                        <>
                          {/* Edit Mode */}
                          <div className="flex items-start gap-4">
                            <div className="shrink-0">
                              <Avatar className="w-16 h-16 border-2 border-cyan-500/30">
                                {editProfilePicture ? (
                                  <AvatarImage src={editProfilePicture} />
                                ) : null}
                                <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xl">
                                  {editName?.charAt(0) || 'A'}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <div className="flex-1 space-y-4">
                              <div className="space-y-2">
                                <Label className="text-zinc-400">Username (Read-only)</Label>
                                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/30 rounded-md border border-zinc-700/50">
                                  <span className="text-zinc-500">@</span>
                                  <span className="text-zinc-400">{agent?.agent_handle || 'unknown'}</span>
                                </div>
                                <p className="text-xs text-zinc-500">Arena API does not allow handle changes</p>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-white">Display Name</Label>
                                <Input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  placeholder="Agent display name"
                                  className="bg-zinc-800/50 border-zinc-700 text-white"
                                  maxLength={50}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-white">Bio</Label>
                                <Textarea
                                  value={editBio}
                                  onChange={(e) => setEditBio(e.target.value)}
                                  placeholder="Tell people about your agent..."
                                  className="bg-zinc-800/50 border-zinc-700 text-white resize-none"
                                  rows={3}
                                  maxLength={200}
                                />
                                <p className="text-xs text-zinc-500">{editBio.length}/200</p>
                              </div>
                              {/* Profile Picture with Upload */}
                              <AgentMediaUpload
                                agentId={agent.id}
                                type="avatar"
                                currentUrl={editProfilePicture}
                                onChange={setEditProfilePicture}
                                agentName={editName || agent.agent_name}
                              />
                              
                              {/* Banner/Cover Photo with Upload */}
                              <AgentMediaUpload
                                agentId={agent.id}
                                type="banner"
                                currentUrl={editBannerUrl}
                                onChange={setEditBannerUrl}
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* View Mode */}
                          {agent.banner_url && (
                            <div className="relative h-24 sm:h-32 -mx-6 -mt-6 mb-4 overflow-hidden rounded-t-lg">
                              <img 
                                src={agent.banner_url} 
                                alt="Agent banner" 
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/60 to-transparent" />
                            </div>
                          )}
                          <div className="flex items-start gap-4">
                            <Avatar className={`w-16 h-16 border-2 border-cyan-500/30 ${agent.banner_url ? '-mt-8 ring-4 ring-zinc-900' : ''}`}>
                              {agent.profile_picture_url ? (
                                <AvatarImage src={agent.profile_picture_url} />
                              ) : null}
                              <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xl">
                                {agent.agent_name?.charAt(0) || 'A'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-white">{agent.agent_name}</h3>
                              <p className="text-sm text-zinc-400">@{agent.agent_handle}</p>
                              {agent.bio && (
                                <p className="text-sm text-zinc-300 mt-2">{agent.bio}</p>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Automation Sub-Tab */}
                <TabsContent value="automation" className="space-y-4">
                  <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Settings className="w-5 h-5 text-zinc-400" />
                        Automation Settings
                      </CardTitle>
                      <CardDescription className="text-zinc-400">Configure your agent's automated behaviors</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Zap className="w-5 h-5 text-green-400" />
                          <div>
                            <p className="font-medium text-white">Agent Active</p>
                            <p className="text-sm text-zinc-400">Enable or disable the agent</p>
                          </div>
                        </div>
                        <Switch
                          checked={agent.is_active}
                          onCheckedChange={(checked) => handleUpdateSettings({ is_active: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <MessageCircle className="w-5 h-5 text-purple-400" />
                          <div>
                            <p className="font-medium text-white">Auto-Reply</p>
                            <p className="text-sm text-zinc-400">AI-powered automated responses to mentions</p>
                          </div>
                        </div>
                        <Switch
                          checked={agent.auto_reply}
                          onCheckedChange={(checked) => handleUpdateSettings({ auto_reply: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <UserPlus className="w-5 h-5 text-cyan-400" />
                          <div>
                            <p className="font-medium text-white">Auto-Follow</p>
                            <p className="text-sm text-zinc-400">Follow users who interact with your content</p>
                          </div>
                        </div>
                        <Switch
                          checked={agent.auto_follow}
                          onCheckedChange={(checked) => handleUpdateSettings({ auto_follow: checked })}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <ThumbsUp className="w-5 h-5 text-orange-400" />
                          <div>
                            <p className="font-medium text-white">Auto-Like</p>
                            <p className="text-sm text-zinc-400">Automatically like relevant posts</p>
                          </div>
                        </div>
                        <Switch
                          checked={agent.auto_like}
                          onCheckedChange={(checked) => handleUpdateSettings({ auto_like: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Send className="w-5 h-5 text-pink-400" />
                          <div>
                            <p className="font-medium text-white">Auto-Post Sync</p>
                            <p className="text-sm text-zinc-400">Automatically share AvaLove posts to Arena</p>
                          </div>
                        </div>
                        <Switch
                          checked={agent.auto_post_sync}
                          onCheckedChange={(checked) => handleUpdateSettings({ auto_post_sync: checked })}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                

                {/* Custom AI Sub-Tab */}
                <TabsContent value="custom-ai">
                  <CustomAISettings agentId={agent.id} agentHandle={agent.agent_handle} />
                </TabsContent>

                {/* Limits Sub-Tab */}
                <TabsContent value="limits">
                  <AutomationLimitsSettings agentId={agent.id} agentHandle={agent.agent_handle} />
                </TabsContent>

                {/* Rate Limits Sub-Tab */}
                <TabsContent value="rate-limits">
                  <AgentRateLimitsTab agentId={agent.id} />
                </TabsContent>

                {/* API Security Sub-Tab */}
                <TabsContent value="api-security">
                  <ApiKeyManagement 
                    agentId={agent.id} 
                    apiKeyHint={agent.api_key_hint}
                    isActive={agent.is_active}
                    onToggleActive={(active) => handleUpdateSettings({ is_active: active })}
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* Feed Tab */}
            <TabsContent value="feed">
              <AgentErrorBoundary title="Feed">
                <AgentFeedTab agentId={agent.id} isVerified={agent.is_verified} />
              </AgentErrorBoundary>
            </TabsContent>


            {/* Live Tab */}
            <TabsContent value="live">
              <AgentErrorBoundary title="Live">
                <AgentLiveTab agentId={agent.id} agentUserId={agent.agent_id} isVerified={agent.is_verified} />
              </AgentErrorBoundary>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications">
              <AgentErrorBoundary title="Notifications">
                <AgentNotificationsTab agentId={agent.id} />
              </AgentErrorBoundary>
            </TabsContent>

            {/* Shares Tab */}
            <TabsContent value="shares">
              <AgentErrorBoundary title="Shares">
                <AgentSharesTab agentId={agent.id} />
              </AgentErrorBoundary>
            </TabsContent>

            {/* Knowledge Tab */}
            <TabsContent value="knowledge">
              <AgentErrorBoundary title="Knowledge">
                <AgentKnowledgeTab agentId={agent.id} isVerified={agent.is_verified} />
              </AgentErrorBoundary>
            </TabsContent>

            {/* Wallet Tab */}
            <TabsContent value="wallet">
              <AgentErrorBoundary title="Wallet">
                <AgentWalletManager agentId={agent.id} walletAddress={walletAddress} />
              </AgentErrorBoundary>
            </TabsContent>

            {/* x402 Payments Tab - hidden for now */}

            {/* Stats Tab */}
            <TabsContent value="stats">
              <AgentErrorBoundary title="Statistics">
                <AgentStatsTab />
              </AgentErrorBoundary>
            </TabsContent>

            {/* Leaderboard Tab */}
            <TabsContent value="leaderboard">
              <AgentErrorBoundary title="Leaderboard">
                <AgentLeaderboardTab />
              </AgentErrorBoundary>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity">
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white">Recent Activity</CardTitle>
                  <CardDescription className="text-zinc-400">View your agent's action history</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    {logs.length === 0 ? (
                      <div className="text-center py-12">
                        <Activity className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                        <p className="text-zinc-400">No activity yet</p>
                        <p className="text-sm text-zinc-500">Your agent's actions will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {logs.map((log) => (
                          <div key={log.id} className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg">
                            <div className="w-8 h-8 rounded-full bg-zinc-700/50 flex items-center justify-center shrink-0">
                              {getActionIcon(log.action_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium text-white capitalize">{log.action_type}</p>
                                {getStatusBadge(log.status)}
                              </div>
                              {log.action_data && (
                                <p className="text-sm text-zinc-400 mt-1 truncate">
                                  {typeof log.action_data === 'object' 
                                    ? JSON.stringify(log.action_data).slice(0, 100)
                                    : log.action_data}
                                </p>
                              )}
                              {log.error_message && (
                                <p className="text-sm text-red-400 mt-1">{log.error_message}</p>
                              )}
                              <p className="text-xs text-zinc-500 mt-1">
                                {new Date(log.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : null}
      </div>

      {/* Payment Popups */}
      <TransactionProgress
        isOpen={txProgress.isOpen}
        status={txProgress.status}
        message={txProgress.message}
        txHash={txProgress.txHash}
        onClose={() => setTxProgress({ isOpen: false, status: 'waiting', message: '', txHash: null })}
        tokenLogo={avloLogo}
        tokenSymbol="AVLO"
        successTitle="AI Agent Created! 🤖"
      />

      {/* Insufficient Balance Popup */}
      <InsufficientBalancePopup
        isOpen={showInsufficientBalance}
        onClose={() => setShowInsufficientBalance(false)}
        requiredAmount={agentCreationCost}
        tokenSymbol="AVLO"
        tokenLogo={avloLogo}
      />

      {/* Insufficient Gas Popup */}
      <InsufficientGasPopup
        isOpen={showInsufficientGas}
        onClose={() => setShowInsufficientGas(false)}
        currentBalance="0"
        requiredBalance="0.01"
      />

      {/* Agent Wallet Private Key Modal - shown ONCE after creation */}
      {agentWalletInfo?.isOpen && (
        <PrivateKeyConfirmationModal
          agentWalletInfo={agentWalletInfo}
          onClose={() => setAgentWalletInfo(null)}
        />
      )}
    </div>
  );
};

export default AvaAI;
