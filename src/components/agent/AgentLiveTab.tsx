import { useState, useEffect, useMemo } from 'react';
import { Radio, Video, Users, Loader2, RefreshCw, Play, LogOut, Heart, MessageCircle, Mic, MicOff, Eye, Clock, ChevronLeft, ChevronRight, Plus, Square, Send, ExternalLink, Monitor, Copy, Check, Tv, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

// Arena API returns threads with nested user, livestream, and stage objects
interface ArenaThread {
  id: string;
  content: string;
  contentUrl?: string;
  threadType: 'livestream' | 'stage';
  createdDate: string;
  updatedAt?: string;
  answerCount?: number;
  likeCount?: number;
  displayStatus?: number;
  user?: {
    id: string;
    handle: string;
    userName?: string;
    profilePicture?: string;
    followerCount?: number;
  };
  livestream?: {
    id: string;
    hostId: string;
    name: string;
    isActive: boolean;
    startedOn?: string;
    thumbnailUrl?: string;
  };
  stage?: {
    id: string;
    hostId: string;
    name: string;
    isActive: boolean;
    startedOn?: string;
    endedOn?: string;
  };
}

interface Livestream {
  id: string;
  livestreamId?: string;
  title: string;
  description?: string;
  streamerId: string;
  streamer?: {
    id: string;
    handle: string;
    userName: string;
    profilePicture?: string;
    followerCount?: number;
  };
  status: 'scheduled' | 'live' | 'ended' | 'paused';
  viewerCount: number;
  startedAt?: string;
  thumbnailUrl?: string;
  categories?: string[];
  chatEnabled?: boolean;
  likeCount?: number;
}

interface Stage {
  id: string;
  stageId?: string;
  title: string;
  description?: string;
  hostId: string;
  host?: {
    id: string;
    handle: string;
    userName: string;
    profilePicture?: string;
  };
  status: 'scheduled' | 'live' | 'ended';
  participantCount: number;
  maxParticipants?: number;
  startedAt?: string;
  thumbnailUrl?: string;
  categories?: string[];
}

function normalizeArenaLivestream(thread: ArenaThread): Livestream {
  const user = thread.user;
  const livestream = thread.livestream;
  return {
    id: thread.id,
    livestreamId: livestream?.id,
    title: livestream?.name || thread.content || 'Untitled Stream',
    streamerId: user?.id || livestream?.hostId || '',
    streamer: user ? {
      id: user.id,
      handle: user.handle,
      userName: user.userName || user.handle,
      profilePicture: user.profilePicture,
      followerCount: user.followerCount,
    } : undefined,
    status: livestream?.isActive ? 'live' : 'ended',
    viewerCount: thread.answerCount || 0,
    startedAt: livestream?.startedOn || thread.createdDate,
    thumbnailUrl: livestream?.thumbnailUrl,
    likeCount: thread.likeCount,
    chatEnabled: true,
  };
}

function normalizeArenaStage(thread: ArenaThread): Stage {
  const user = thread.user;
  const stage = thread.stage;
  return {
    id: thread.id,
    stageId: stage?.id,
    title: stage?.name || thread.content || 'Untitled Stage',
    hostId: user?.id || stage?.hostId || '',
    host: user ? {
      id: user.id,
      handle: user.handle,
      userName: user.userName || user.handle,
      profilePicture: user.profilePicture,
    } : undefined,
    status: stage?.isActive ? 'live' : (stage?.endedOn ? 'ended' : 'scheduled'),
    participantCount: thread.answerCount || 0,
    startedAt: stage?.startedOn || thread.createdDate,
  };
}

const PAGE_SIZE = 25;

interface AgentLiveTabProps {
  agentId: string;
  agentUserId: string;
  isVerified: boolean;
}

export function AgentLiveTab({ agentId, agentUserId, isVerified }: AgentLiveTabProps) {
  const [activeTab, setActiveTab] = useState<'livestreams' | 'stages'>('livestreams');
  const [livestreams, setLivestreams] = useState<Livestream[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [joinedStages, setJoinedStages] = useState<Set<string>>(new Set());
  const [joinedLivestreams, setJoinedLivestreams] = useState<Set<string>>(new Set());
  const [engagingWith, setEngagingWith] = useState<string | null>(null);
  const [livestreamPage, setLivestreamPage] = useState(1);
  const [stagePage, setStagePage] = useState(1);
  const [createStageOpen, setCreateStageOpen] = useState(false);
  const [createLivestreamOpen, setCreateLivestreamOpen] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStagePrivacy, setNewStagePrivacy] = useState('0');
  const [newLivestreamName, setNewLivestreamName] = useState('');
  const [newLivestreamPrivacy, setNewLivestreamPrivacy] = useState('0');
  const [isCreating, setIsCreating] = useState(false);
  const [agentHandle, setAgentHandle] = useState<string>('');
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  // Manual chat state
  const [chatMessages, setChatMessages] = useState<Record<string, string>>({});
  const [sendingChat, setSendingChat] = useState<string | null>(null);
  // Ingress state for streaming panel
  const [ingressData, setIngressData] = useState<Record<string, { rtmpUrl: string; streamKey: string; playbackUrl: string }>>({});
  const [generatingIngress, setGeneratingIngress] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    fetchLiveContent();
    supabase.from('arena_agents').select('agent_handle').eq('id', agentId).single()
      .then(({ data }) => {
        if (data?.agent_handle) setAgentHandle(data.agent_handle.replace('_agent', ''));
      });
  }, [agentId]);

  const isOwnStream = (streamerId: string, handle?: string) => {
    if (streamerId === agentUserId) return true;
    if (handle && agentHandle && handle.toLowerCase() === agentHandle.toLowerCase()) return true;
    return false;
  };

  const fetchLiveContent = async () => {
    setIsLoading(true);
    try {
      const [cachedLivestreams, cachedStages] = await Promise.all([
        supabase.functions.invoke('arena-agent', { body: { action: 'get_cached_data', cacheKey: 'active_livestreams' } }),
        supabase.functions.invoke('arena-agent', { body: { action: 'get_cached_data', cacheKey: 'active_stages' } }),
      ]);

      let livestreamItems = cachedLivestreams.data?.cached
        ? (cachedLivestreams.data.data?.threads || cachedLivestreams.data.data?.livestreams || [])
        : null;
      let stageItems = cachedStages.data?.cached
        ? (cachedStages.data.data?.threads || cachedStages.data.data?.stages || [])
        : null;

      if (!livestreamItems) {
        const res = await supabase.functions.invoke('arena-agent', { body: { action: 'get_livestreams', agentId } });
        livestreamItems = res.data?.livestreams || res.data?.threads || [];
      }
      if (!stageItems) {
        const res = await supabase.functions.invoke('arena-agent', { body: { action: 'get_stages', agentId } });
        stageItems = res.data?.stages || res.data?.threads || [];
      }

      if (Array.isArray(livestreamItems) && livestreamItems.length > 0) {
        const normalized = livestreamItems
          .filter((item: any) => item.threadType === 'livestream' || item.livestream || item.streamer)
          .map((item: any) => {
            if (item.streamer || (item.title && !item.user)) return item as Livestream;
            return normalizeArenaLivestream(item as ArenaThread);
          })
          .filter((item: Livestream) => item.status !== 'ended');
        setLivestreams(normalized);
      } else {
        setLivestreams([]);
      }

      if (Array.isArray(stageItems) && stageItems.length > 0) {
        const normalized = stageItems
          .filter((item: any) => item.threadType === 'stage' || item.stage || item.host)
          .map((item: any) => {
            if (item.host || (item.title && !item.user)) return item as Stage;
            return normalizeArenaStage(item as ArenaThread);
          })
          .filter((item: Stage) => item.status !== 'ended');
        setStages(normalized);
      } else {
        setStages([]);
      }
    } catch (error) {
      console.error('Error fetching live content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinStage = async (stage: Stage) => {
    if (!isVerified) { toast.error('Agent must be verified first'); return; }
    const realStageId = stage.stageId || stage.id;
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'join_stage', agentId, stageId: realStageId }
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || 'Join failed');
      setJoinedStages(prev => new Set([...prev, stage.id]));
      toast.success(`Joined "${stage.title}" as listener`);
    } catch (error: any) { toast.error(error.message || 'Failed to join stage'); }
  };

  const handleJoinLivestream = async (stream: Livestream) => {
    if (!isVerified) { toast.error('Agent must be verified first'); return; }
    const realId = stream.livestreamId || stream.id;
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'join_livestream', agentId, livestreamId: realId }
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || 'Join failed');
      setJoinedLivestreams(prev => new Set([...prev, stream.id]));
      toast.success(`Joined "${stream.title}"`);
    } catch (error: any) { toast.error(error.message || 'Failed to join livestream'); }
  };

  const handleLeaveLivestream = async (stream: Livestream) => {
    const realId = stream.livestreamId || stream.id;
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'leave_livestream', agentId, livestreamId: realId }
      });
      if (error) throw error;
      setJoinedLivestreams(prev => { const next = new Set(prev); next.delete(stream.id); return next; });
      toast.success('Left livestream');
    } catch (error: any) { toast.error(error.message || 'Failed to leave'); }
  };

  const handleLeaveStage = async (stage: Stage) => {
    const realStageId = stage.stageId || stage.id;
    try {
      const { error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'leave_stage', agentId, stageId: realStageId }
      });
      if (error) throw error;
      setJoinedStages(prev => { const next = new Set(prev); next.delete(stage.id); return next; });
      toast.success('Left stage');
    } catch (error: any) { toast.error(error.message || 'Failed to leave stage'); }
  };

  const handleSmartEngage = async (stream: Livestream) => {
    if (!isVerified) { toast.error('Agent must be verified first'); return; }
    // Use the real livestream ID for chat, fall back to thread ID
    const realLivestreamId = stream.livestreamId || stream.id;
    setEngagingWith(stream.id);
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'smart_livestream_engage', agentId, livestreamId: realLivestreamId, force: true }
      });
      if (error) throw error;
      if (data?.engaged) {
        const chatStatus = data.chatSent ? '✅' : '⚠️ chat failed';
        toast.success(`Engaged with "${stream.title}": ${data.message} ${chatStatus}`);
      } else {
        toast.info(`Skipped: ${data?.reason || 'Not exciting enough'}`);
      }
    } catch (error: any) { toast.error(error.message || 'Failed to engage'); }
    finally { setEngagingWith(null); }
  };

  const handleLikeLivestream = async (livestreamId: string) => {
    try {
      await supabase.functions.invoke('arena-agent', {
        body: { action: 'like_livestream', agentId, livestreamId }
      });
      toast.success('Liked livestream!');
    } catch (error: any) { toast.error(error.message || 'Failed to like'); }
  };

  const handleGenerateIngress = async (stream: Livestream) => {
    const realId = stream.livestreamId || stream.id;
    setGeneratingIngress(realId);
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'generate_ingress', agentId, livestreamId: realId }
      });
      if (error) throw error;
      if (data?.success === false) {
        toast.error(data.error || 'Arena API error');
        return;
      }
      const raw = data?.rawResponse || data;
      const rtmpUrl = raw?.server || raw?.rtmpUrl || '';
      const streamKey = raw?.streamKey || '';
      const playbackUrl = raw?.playbackUrl || '';
      if (rtmpUrl || streamKey) {
        setIngressData(prev => ({
          ...prev,
          [realId]: { rtmpUrl, streamKey, playbackUrl }
        }));
        toast.success('Streaming details ready!');
      } else {
        console.error('Unexpected ingress response:', JSON.stringify(data));
        toast.error('No ingress data returned from Arena');
      }
    } catch (e: any) { toast.error(e.message || 'Failed to generate ingress'); }
    finally { setGeneratingIngress(null); }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSendChat = async (stream: Livestream) => {
    const msg = chatMessages[stream.id]?.trim();
    if (!msg) return;
    const realId = stream.livestreamId || stream.id;
    setSendingChat(stream.id);
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'send_livestream_chat', agentId, livestreamId: realId, content: msg }
      });
      if (error) throw error;
      setChatMessages(prev => ({ ...prev, [stream.id]: '' }));
      toast.success('Message sent!');
    } catch (e: any) { toast.error(e.message || 'Failed to send'); }
    finally { setSendingChat(null); }
  };

  const handleCreateStage = async () => {
    if (!newStageName.trim() || !isVerified) return;
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'create_stage', agentId, name: newStageName, privacyType: Number(newStagePrivacy) }
      });
      if (error) throw error;
      toast.success('Stage created!');
      // Add optimistically to state so it shows immediately
      const newStage: Stage = {
        id: data?.stage?.id || data?.stageId || `temp-${Date.now()}`,
        stageId: data?.stage?.id || data?.stageId,
        title: newStageName,
        hostId: agentUserId,
        host: { id: agentUserId, handle: agentHandle, userName: agentHandle, profilePicture: undefined },
        status: 'live',
        participantCount: 1,
        startedAt: new Date().toISOString(),
      };
      setStages(prev => [newStage, ...prev]);
      setActiveTab('stages');
      setNewStageName('');
      setCreateStageOpen(false);
    } catch (e: any) { toast.error(e.message || 'Failed to create stage'); }
    finally { setIsCreating(false); }
  };

  const handleCreateLivestream = async () => {
    if (!newLivestreamName.trim() || !isVerified) return;
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'create_livestream', agentId, name: newLivestreamName, privacyType: Number(newLivestreamPrivacy) }
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || 'Arena rejected the request');
      toast.success('Livestream created!');
      const newStream: Livestream = {
        id: data?.livestream?.id || data?.livestreamId || `temp-${Date.now()}`,
        livestreamId: data?.livestream?.id || data?.livestreamId,
        title: newLivestreamName,
        streamerId: agentUserId,
        streamer: { id: agentUserId, handle: agentHandle, userName: agentHandle, profilePicture: undefined },
        status: 'live',
        viewerCount: 0,
        startedAt: new Date().toISOString(),
        chatEnabled: true,
      };
      setLivestreams(prev => [newStream, ...prev]);
      setActiveTab('livestreams');
      setNewLivestreamName('');
      setCreateLivestreamOpen(false);
    } catch (e: any) { toast.error(e.message || 'Failed to create livestream'); }
    finally { setIsCreating(false); }
  };

  const handleEndStage = async (stageId: string) => {
    try {
      await supabase.functions.invoke('arena-agent', { body: { action: 'end_stage', agentId, stageId } });
      toast.success('Stage ended');
      setStages(prev => prev.filter(s => (s.stageId || s.id) !== stageId));
      fetchLiveContent();
    } catch { toast.error('Failed to end stage'); }
  };

  const handleEndLivestream = async (livestreamId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', { body: { action: 'end_livestream', agentId, livestreamId } });
      if (error) throw error;
      toast.success('Livestream ended');
      setLivestreams(prev => prev.filter(l => (l.livestreamId || l.id) !== livestreamId));
      fetchLiveContent();
    } catch (e: any) {
      toast.error(e.message || 'Failed to end livestream');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live': return <Badge className="bg-red-500/20 text-red-400 animate-pulse">🔴 LIVE</Badge>;
      case 'scheduled': return <Badge className="bg-blue-500/20 text-blue-400">📅 Scheduled</Badge>;
      case 'ended': return <Badge className="bg-zinc-500/20 text-zinc-400">Ended</Badge>;
      case 'paused': return <Badge className="bg-yellow-500/20 text-yellow-400">⏸️ Paused</Badge>;
      default: return null;
    }
  };

  // Sort: own streams first, then live, then by date; filter by search
  const sortedLivestreams = useMemo(() => {
    let items = [...livestreams];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.streamer?.handle?.toLowerCase().includes(q) ||
        s.streamer?.userName?.toLowerCase().includes(q)
      );
    }
    return items.sort((a, b) => {
      const aOwn = isOwnStream(a.streamerId, a.streamer?.handle) ? 1 : 0;
      const bOwn = isOwnStream(b.streamerId, b.streamer?.handle) ? 1 : 0;
      if (aOwn !== bOwn) return bOwn - aOwn;
      const aLive = a.status === 'live' ? 1 : 0;
      const bLive = b.status === 'live' ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;
      return new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime();
    });
  }, [livestreams, searchQuery, agentUserId, agentHandle]);

  const sortedStages = useMemo(() => {
    let items = [...stages];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.host?.handle?.toLowerCase().includes(q) ||
        s.host?.userName?.toLowerCase().includes(q)
      );
    }
    return items.sort((a, b) => {
      const aOwn = isOwnStream(a.hostId, a.host?.handle) ? 1 : 0;
      const bOwn = isOwnStream(b.hostId, b.host?.handle) ? 1 : 0;
      if (aOwn !== bOwn) return bOwn - aOwn;
      const aLive = a.status === 'live' ? 1 : 0;
      const bLive = b.status === 'live' ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;
      return new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime();
    });
  }, [stages, searchQuery, agentUserId, agentHandle]);

  const paginatedLivestreams = sortedLivestreams.slice((livestreamPage - 1) * PAGE_SIZE, livestreamPage * PAGE_SIZE);
  const totalLivestreamPages = Math.max(1, Math.ceil(sortedLivestreams.length / PAGE_SIZE));
  const paginatedStages = sortedStages.slice((stagePage - 1) * PAGE_SIZE, stagePage * PAGE_SIZE);
  const totalStagePages = Math.max(1, Math.ceil(sortedStages.length / PAGE_SIZE));

  const PaginationControls = ({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (p: number) => void }) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 pt-3">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs text-zinc-400">{page} / {totalPages}</span>
        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const renderLivestreamCard = (stream: Livestream) => (
    <div key={stream.id} className="p-3 sm:p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors">
      <div className="flex items-start gap-2 sm:gap-3">
        <Avatar className="w-10 h-10 shrink-0">
          {stream.streamer?.profilePicture && <AvatarImage src={stream.streamer.profilePicture} />}
          <AvatarFallback className="bg-red-500/20 text-red-400">
            {stream.streamer?.userName?.charAt(0) || 'S'}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {getStatusBadge(stream.status)}
            <span className="text-white font-medium truncate text-sm">{stream.title}</span>
          </div>

          <div className="flex items-center gap-3 text-xs sm:text-sm text-zinc-400 flex-wrap">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{stream.viewerCount}</span>
            {stream.likeCount !== undefined && (
              <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{stream.likeCount}</span>
            )}
            {stream.streamer && <span className="truncate">@{stream.streamer.handle}</span>}
          </div>

          {/* Streaming Panel for own streams */}
          {isOwnStream(stream.streamerId, stream.streamer?.handle) && stream.status === 'live' && (
            <div className="mt-2 space-y-2">
              {(() => {
                const realId = stream.livestreamId || stream.id;
                const ingress = ingressData[realId];
                
                if (!ingress) {
                  return (
                    <Button
                      size="sm"
                      onClick={() => handleGenerateIngress(stream)}
                      disabled={generatingIngress === realId}
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 h-9"
                    >
                      {generatingIngress === realId ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Tv className="w-4 h-4 mr-2" />
                      )}
                      Generate Stream Details
                    </Button>
                  );
                }

                return (
                  <div className="space-y-2 p-3 bg-zinc-900/80 border border-cyan-500/20 rounded-lg">
                    <p className="text-xs font-medium text-cyan-300 flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5" /> Streaming Details
                    </p>

                    {/* RTMP URL */}
                    {ingress.rtmpUrl && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">RTMP URL</label>
                        <div className="flex items-center gap-1.5">
                          <code className="flex-1 text-[11px] bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-300 truncate font-mono">
                            {ingress.rtmpUrl}
                          </code>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => handleCopy(ingress.rtmpUrl, `rtmp-${realId}`)}>
                            {copiedField === `rtmp-${realId}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Stream Key */}
                    {ingress.streamKey && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Stream Key</label>
                        <div className="flex items-center gap-1.5">
                          <code className="flex-1 text-[11px] bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-300 truncate font-mono">
                            {ingress.streamKey.slice(0, 12)}...
                          </code>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => handleCopy(ingress.streamKey, `key-${realId}`)}>
                            {copiedField === `key-${realId}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Playback URL */}
                    {ingress.playbackUrl && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Playback Preview</label>
                        <div className="rounded-lg overflow-hidden border border-zinc-700 bg-black aspect-video">
                          <video
                            src={ingress.playbackUrl}
                            controls
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <code className="flex-1 text-[10px] bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-400 truncate font-mono">
                            {ingress.playbackUrl}
                          </code>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => handleCopy(ingress.playbackUrl, `play-${realId}`)}>
                            {copiedField === `play-${realId}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                          </Button>
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-zinc-500 mt-1">
                      Paste the RTMP URL & Stream Key into OBS or any streaming software to go live.
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Action buttons */}
          {stream.status === 'live' && isVerified && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {isOwnStream(stream.streamerId, stream.streamer?.handle) && (
                <Button size="sm" variant="outline" onClick={() => handleEndLivestream(stream.livestreamId || stream.id)}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8 px-3">
                  <Square className="w-3.5 h-3.5 mr-1" />End
                </Button>
              )}
              {joinedLivestreams.has(stream.id) ? (
                <Button size="sm" variant="outline" onClick={() => handleLeaveLivestream(stream)}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8 px-3">
                  <LogOut className="w-3.5 h-3.5 mr-1" />Leave
                </Button>
              ) : (
                <Button size="sm" onClick={() => handleJoinLivestream(stream)}
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-8 px-3">
                  <Play className="w-3.5 h-3.5 mr-1" />Join
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => handleLikeLivestream(stream.id)}
                className="border-pink-500/30 text-pink-400 hover:bg-pink-500/10 h-8 px-3">
                <Heart className="w-3.5 h-3.5 mr-1" />Like
              </Button>
              <Button size="sm" onClick={() => handleSmartEngage(stream)}
                disabled={engagingWith === stream.id}
                className="bg-gradient-to-r from-orange-500 to-red-500 h-8 px-3">
                {engagingWith === stream.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <><MessageCircle className="w-3.5 h-3.5 mr-1" />Smart</>
                )}
              </Button>
            </div>
          )}

          {/* Chat removed - handled via agent automation */}
        </div>
      </div>
    </div>
  );

  const renderStageCard = (stage: Stage) => {
    const isJoined = joinedStages.has(stage.id);
    return (
      <div key={stage.id} className="p-3 sm:p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors">
        <div className="flex items-start gap-2 sm:gap-3">
          <Avatar className="w-10 h-10 shrink-0">
            {stage.host?.profilePicture && <AvatarImage src={stage.host.profilePicture} />}
            <AvatarFallback className="bg-purple-500/20 text-purple-400">
              {stage.host?.userName?.charAt(0) || 'H'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {getStatusBadge(stage.status)}
              <span className="text-white font-medium truncate text-sm">{stage.title}</span>
            </div>

            <div className="flex items-center gap-3 text-xs sm:text-sm text-zinc-400 flex-wrap">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {stage.participantCount}{stage.maxParticipants && `/${stage.maxParticipants}`}
              </span>
              {stage.startedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(stage.startedAt), { addSuffix: true })}
                </span>
              )}
              {stage.host && <span className="truncate">@{stage.host.handle}</span>}
            </div>

            {isJoined && (
              <div className="mt-2 flex items-center gap-2 text-xs text-purple-400">
                <MicOff className="w-3 h-3" />Listening
              </div>
            )}

            {/* Action buttons */}
            {stage.status === 'live' && isVerified && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {isOwnStream(stage.hostId, stage.host?.handle) && (
                  <Button size="sm" variant="outline" onClick={() => handleEndStage(stage.stageId || stage.id)}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8">
                    <Square className="w-3.5 h-3.5 mr-1" />End
                  </Button>
                )}
                {isJoined ? (
                  <Button size="sm" variant="outline" onClick={() => handleLeaveStage(stage)}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8">
                    <LogOut className="w-3.5 h-3.5 mr-1" />Leave
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => handleJoinStage(stage)}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-8">
                    <Play className="w-3.5 h-3.5 mr-1" />Join
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader className="px-3 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2 text-base sm:text-lg">
              <Radio className="w-5 h-5 text-red-400" />
              Live Content
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs sm:text-sm">
              Join stages & engage with livestreams
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {isVerified && (
              <>
                <Dialog open={createStageOpen} onOpenChange={setCreateStageOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-purple-400 text-xs h-8">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Stage
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-zinc-900 border-zinc-800">
                    <DialogHeader><DialogTitle className="text-white">Create Stage</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <Input value={newStageName} onChange={e => setNewStageName(e.target.value)} placeholder="Stage name..." className="bg-zinc-800 border-zinc-700 text-white" />
                      <Select value={newStagePrivacy} onValueChange={setNewStagePrivacy}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="0">Public</SelectItem></SelectContent>
                      </Select>
                      <Button onClick={handleCreateStage} disabled={isCreating || !newStageName.trim()} className="w-full bg-purple-500 hover:bg-purple-600">
                        {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Stage'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={createLivestreamOpen} onOpenChange={setCreateLivestreamOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-red-400 text-xs h-8">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Live
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-zinc-900 border-zinc-800">
                    <DialogHeader><DialogTitle className="text-white">Create Livestream</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <Input value={newLivestreamName} onChange={e => setNewLivestreamName(e.target.value)} placeholder="Livestream name..." className="bg-zinc-800 border-zinc-700 text-white" />
                      <Select value={newLivestreamPrivacy} onValueChange={setNewLivestreamPrivacy}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="0">Public</SelectItem></SelectContent>
                      </Select>
                      <Button onClick={handleCreateLivestream} disabled={isCreating || !newLivestreamName.trim()} className="w-full bg-red-500 hover:bg-red-600">
                        {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Livestream'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={fetchLiveContent} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-3 sm:px-6">
        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setLivestreamPage(1); setStagePage(1); }}
            placeholder="Search streams, stages, hosts..."
            className="bg-zinc-800/50 border-zinc-700 text-white pl-9 h-9 text-sm"
          />
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'livestreams' | 'stages')}>
          <TabsList className="bg-zinc-800/50 mb-4 w-full">
            <TabsTrigger value="livestreams" className="data-[state=active]:bg-red-500/20 flex-1 text-xs sm:text-sm">
              <Video className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Livestreams</span>
              <span className="sm:hidden">Live</span>
              <span className="ml-1">({sortedLivestreams.filter(l => l.status === 'live').length})</span>
            </TabsTrigger>
            <TabsTrigger value="stages" className="data-[state=active]:bg-purple-500/20 flex-1 text-xs sm:text-sm">
              <Mic className="w-4 h-4 mr-1 sm:mr-2" />
              Stages ({sortedStages.filter(s => s.status === 'live').length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="livestreams">
            <ScrollArea className="h-[400px]">
              {paginatedLivestreams.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <Video className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No active livestreams</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedLivestreams.map(renderLivestreamCard)}
                </div>
              )}
            </ScrollArea>
            <PaginationControls page={livestreamPage} totalPages={totalLivestreamPages} setPage={setLivestreamPage} />
          </TabsContent>

          <TabsContent value="stages">
            <ScrollArea className="h-[400px]">
              {paginatedStages.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <Mic className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No active stages</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedStages.map(renderStageCard)}
                </div>
              )}
            </ScrollArea>
            <PaginationControls page={stagePage} totalPages={totalStagePages} setPage={setStagePage} />
          </TabsContent>
        </Tabs>

        <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <MessageCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <p className="text-orange-300 font-medium">Smart + Manual Engagement</p>
              <p className="text-orange-400/70 text-xs mt-1">
                Use Smart to auto-generate messages, or type your own to send directly.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
