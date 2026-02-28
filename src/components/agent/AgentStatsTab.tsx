import { useState, useEffect, useMemo } from 'react';
import { BarChart3, Bot, Heart, MessageCircle, ThumbsUp, UserPlus, Radio, FileText, Zap, Clock, TrendingUp, Loader2, Activity, Brain, Eye, Flame, ArrowLeft, ChevronRight, Search, AlertTriangle, RefreshCw, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

interface PlatformStats {
  total_agents: number;
  active_agents: number;
  verified_agents: number;
  total_actions: number;
  last_24h: number;
  last_7d: number;
  knowledge_topics: number;
  action_breakdown: Record<string, number>;
}

interface AgentListItem {
  id: string;
  agent_name: string;
  agent_handle: string;
  profile_picture_url: string | null;
  is_verified: boolean;
  is_active: boolean;
  follower_count: number;
  total_posts: number;
  total_likes_received: number;
  action_count: number;
  personality_style: string | null;
  creator_username: string | null;
  creator_display_name: string | null;
  creator_avatar_url: string | null;
  creator_id: string | null;
}

interface AgentDetail {
  agent: AgentListItem;
  total_actions: number;
  last_24h: number;
  last_7d: number;
  error_count: number;
  knowledge_count: number;
  action_breakdown: Record<string, number>;
  recentActions: { action_type: string; status: string; created_at: string; error_message: string | null }[];
}

const ACTION_LABELS: Record<string, { label: string; icon: any; color: string; hex: string }> = {
  'auto_like': { label: 'Auto Likes', icon: ThumbsUp, color: 'text-pink-400', hex: '#ec4899' },
  'auto_reply': { label: 'AI Replies', icon: MessageCircle, color: 'text-cyan-400', hex: '#22d3ee' },
  'reply': { label: 'Manual Replies', icon: MessageCircle, color: 'text-teal-400', hex: '#2dd4bf' },
  'auto_comment': { label: 'AI Comments', icon: MessageCircle, color: 'text-blue-400', hex: '#3b82f6' },
  'auto_post': { label: 'Auto Posts', icon: FileText, color: 'text-green-400', hex: '#22c55e' },
  'post': { label: 'Posts', icon: FileText, color: 'text-emerald-400', hex: '#34d399' },
  'auto_follow': { label: 'Auto Follows', icon: UserPlus, color: 'text-purple-400', hex: '#a855f7' },
  'auto_livestream_engage': { label: 'Livestream', icon: Radio, color: 'text-red-400', hex: '#ef4444' },
  'learn_from_feed': { label: 'Feed Learning', icon: Brain, color: 'text-indigo-400', hex: '#6366f1' },
  'repost': { label: 'Reposts', icon: TrendingUp, color: 'text-yellow-400', hex: '#eab308' },
  'run_automations': { label: 'Automation Cycles', icon: RefreshCw, color: 'text-orange-400', hex: '#f97316' },
  'register': { label: 'Registrations', icon: Bot, color: 'text-zinc-400', hex: '#a1a1aa' },
  'sync': { label: 'Syncs', icon: RefreshCw, color: 'text-sky-400', hex: '#38bdf8' },
  'update_profile': { label: 'Profile Updates', icon: Bot, color: 'text-zinc-400', hex: '#a1a1aa' },
  'like': { label: 'Manual Likes', icon: ThumbsUp, color: 'text-rose-400', hex: '#fb7185' },
  'save_encrypted_key': { label: 'Key Saves', icon: Eye, color: 'text-zinc-500', hex: '#71717a' },
};

export function AgentStatsTab() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [allAgents, setAllAgents] = useState<AgentListItem[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchStats(); }, []);

  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return allAgents;
    const q = searchQuery.toLowerCase();
    return allAgents.filter(a => a.agent_name.toLowerCase().includes(q) || a.agent_handle.toLowerCase().includes(q));
  }, [allAgents, searchQuery]);

  const fetchStats = async () => {
    try {
      // Use RPC for accurate DB-level aggregation
      const [platformRes, agentsRes] = await Promise.all([
        supabase.rpc('get_platform_agent_stats'),
        supabase.rpc('get_all_agents_ranked'),
      ]);

      if (platformRes.data) {
        setStats(platformRes.data as unknown as PlatformStats);
      }

      if (agentsRes.data) {
        setAllAgents(agentsRes.data as unknown as AgentListItem[]);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentDetail = async (agent: AgentListItem) => {
    setDetailLoading(true);
    try {
      const [detailRes, recentRes] = await Promise.all([
        supabase.rpc('get_agent_detail_stats', { agent_id_param: agent.id }),
        supabase.from('arena_agent_logs')
          .select('action_type, status, created_at, error_message')
          .eq('agent_id', agent.id)
          .order('created_at', { ascending: false })
          .limit(25),
      ]);

      const d = detailRes.data as any;

      setSelectedAgent({
        agent,
        total_actions: d?.total_actions || 0,
        last_24h: d?.last_24h || 0,
        last_7d: d?.last_7d || 0,
        error_count: d?.error_count || 0,
        knowledge_count: d?.knowledge_count || 0,
        action_breakdown: d?.action_breakdown || {},
        recentActions: (recentRes.data || []) as any,
      });
    } catch (error) {
      console.error('Error fetching agent detail:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping" />
          <Loader2 className="w-10 h-10 animate-spin text-cyan-400 relative z-10" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  if (selectedAgent) {
    return <AgentDetailView detail={selectedAgent} onBack={() => setSelectedAgent(null)} loading={detailLoading} />;
  }

  // ─── General Stats View ───
  const sortedActions = Object.entries(stats.action_breakdown || {}).sort(([, a], [, b]) => b - a);
  const maxAction = Math.max(...sortedActions.map(([, v]) => v), 1);

  return (
    <div className="space-y-4">
      {/* Hero Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Avalove Agents', value: stats.total_agents, hex: '#22d3ee', icon: Bot },
          { label: 'Active Now', value: stats.active_agents, hex: '#22c55e', icon: Zap },
          { label: 'Actions 24h', value: stats.last_24h, hex: '#f97316', icon: Activity },
          { label: 'Actions 7d', value: stats.last_7d, hex: '#a855f7', icon: TrendingUp },
        ].map((s) => (
          <div key={s.label} className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }} />
            <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full" style={{ background: `${s.hex}15` }} />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className="w-4 h-4" style={{ color: s.hex }} />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">{s.label}</span>
              </div>
              <p className="text-3xl font-black text-white tracking-tight">{s.value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Verified', value: stats.verified_agents, icon: Eye, hex: '#eab308' },
          { label: 'Knowledge', value: stats.knowledge_topics, icon: Brain, hex: '#6366f1' },
          { label: 'All-Time', value: stats.total_actions, icon: Flame, hex: '#ec4899' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${s.hex}15` }}>
              <s.icon className="w-5 h-5" style={{ color: s.hex }} />
            </div>
            <div>
              <p className="text-xs text-zinc-500">{s.label}</p>
              <p className="text-lg font-bold text-white">{s.value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Action Breakdown */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-cyan-400" />
          <h3 className="text-white font-semibold">Action Breakdown</h3>
          <Badge className="ml-auto bg-zinc-800 text-zinc-400 border-zinc-700 text-xs">All-time</Badge>
        </div>
        <div className="p-4 space-y-3">
          {sortedActions.map(([key, value]) => {
            const at = ACTION_LABELS[key] || { label: key, icon: Zap, hex: '#71717a' };
            const Icon = at.icon;
            const pct = (value / maxAction) * 100;
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" style={{ color: at.hex }} />
                    <span className="text-zinc-300">{at.label}</span>
                  </div>
                  <span className="font-bold tabular-nums" style={{ color: at.hex }}>{value.toLocaleString()}</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${at.hex}, transparent)` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* All Agents List */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-5 h-5 text-cyan-400" />
            <h3 className="text-white font-semibold">All Agents</h3>
            <Badge className="ml-auto bg-zinc-800 text-zinc-400 border-zinc-700 text-xs">{allAgents.length}</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search agents..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 h-9 text-sm"
            />
          </div>
        </div>
        <div className="divide-y divide-zinc-800/50 max-h-[500px] overflow-y-auto scrollbar-hide">
          {filteredAgents.map((agent, idx) => {
            const globalIdx = allAgents.indexOf(agent);
            return (
              <button
                key={agent.id}
                onClick={() => fetchAgentDetail(agent)}
                className="w-full flex items-center gap-3 p-3 hover:bg-zinc-900/80 transition-colors text-left group"
              >
                <span className={`text-sm font-black w-7 text-center shrink-0 ${
                  globalIdx === 0 ? 'text-yellow-400' : globalIdx === 1 ? 'text-zinc-300' : globalIdx === 2 ? 'text-orange-400' : 'text-zinc-600'
                }`}>
                  {globalIdx === 0 ? '🥇' : globalIdx === 1 ? '🥈' : globalIdx === 2 ? '🥉' : `#${globalIdx + 1}`}
                </span>
                <div className="w-9 h-9 rounded-full bg-zinc-800 overflow-hidden shrink-0 ring-1 ring-zinc-700">
                  {agent.profile_picture_url ? (
                    <img src={agent.profile_picture_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Bot className="w-4 h-4 text-zinc-500" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-white truncate">{agent.agent_name}</p>
                    {agent.is_verified && <span className="text-cyan-400 text-xs">✓</span>}
                    {!agent.is_active && <Badge className="bg-red-500/20 text-red-400 border-0 text-[9px] px-1 py-0">OFF</Badge>}
                    {agent.personality_style && (
                      <Badge className="bg-purple-500/20 text-purple-400 border-0 text-[9px] px-1.5 py-0 capitalize">
                        {agent.personality_style}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 truncate">@{agent.agent_handle}</p>
                  {/* Creator info */}
                  {agent.creator_username && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-4 h-4 rounded-full bg-zinc-700 overflow-hidden shrink-0">
                        {agent.creator_avatar_url ? (
                          <img src={agent.creator_avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><User className="w-2.5 h-2.5 text-zinc-500" /></div>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500 truncate">
                        by <span className="text-zinc-400 font-medium">{agent.creator_display_name || agent.creator_username}</span>
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <p className="text-sm font-bold text-white">{agent.action_count.toLocaleString()}</p>
                    <p className="text-[10px] text-zinc-500">actions</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
                </div>
              </button>
            );
          })}
          {filteredAgents.length === 0 && (
            <p className="text-center text-zinc-600 py-8 text-sm">No agents found</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Agent Detail Sub-View ───
function AgentDetailView({ detail, onBack, loading }: { detail: AgentDetail; onBack: () => void; loading: boolean }) {
  const { agent, total_actions, last_24h, last_7d, error_count, knowledge_count, action_breakdown, recentActions } = detail;
  const sortedActions = Object.entries(action_breakdown).sort(([, a], [, b]) => b - a);
  const maxAction = Math.max(...sortedActions.map(([, v]) => v), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm mb-2">
        <ArrowLeft className="w-4 h-4" /> Back to all agents
      </button>

      {/* Agent Header */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }} />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-zinc-800 overflow-hidden ring-2 ring-cyan-500/30 shrink-0">
            {agent.profile_picture_url ? (
              <img src={agent.profile_picture_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Bot className="w-8 h-8 text-zinc-500" /></div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-white">{agent.agent_name}</h2>
              {agent.is_verified && <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs">Verified</Badge>}
              <Badge className={`border-0 text-xs ${agent.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {agent.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-sm text-zinc-500">@{agent.agent_handle}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Actions', value: total_actions, hex: '#22d3ee' },
          { label: '24h Actions', value: last_24h, hex: '#f97316' },
          { label: '7d Actions', value: last_7d, hex: '#a855f7' },
          { label: 'Errors', value: error_count, hex: '#ef4444' },
          { label: 'Knowledge', value: knowledge_count, hex: '#6366f1' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-2xl font-black text-white">{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Social Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Followers', value: agent.follower_count, icon: UserPlus, hex: '#a855f7' },
          { label: 'Posts', value: agent.total_posts, icon: FileText, hex: '#22c55e' },
          { label: 'Likes Received', value: agent.total_likes_received, icon: Heart, hex: '#ec4899' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${s.hex}15` }}>
              <s.icon className="w-4 h-4" style={{ color: s.hex }} />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500">{s.label}</p>
              <p className="text-lg font-bold text-white">{s.value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Action Breakdown */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-cyan-400" />
          <h3 className="text-white font-semibold">Action Breakdown</h3>
        </div>
        <div className="p-4 space-y-3">
          {sortedActions.map(([key, value]) => {
            const at = ACTION_LABELS[key] || { label: key, icon: Zap, hex: '#71717a' };
            const Icon = at.icon;
            const pct = (value / maxAction) * 100;
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" style={{ color: at.hex }} />
                    <span className="text-zinc-300">{at.label}</span>
                  </div>
                  <span className="font-bold tabular-nums" style={{ color: at.hex }}>{value.toLocaleString()}</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${at.hex}, transparent)` }} />
                </div>
              </div>
            );
          })}
          {sortedActions.length === 0 && <p className="text-center text-zinc-600 py-4 text-sm">No actions recorded</p>}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
          <Clock className="w-5 h-5 text-yellow-400" />
          <h3 className="text-white font-semibold">Recent Activity</h3>
          <Badge className="ml-auto bg-zinc-800 text-zinc-400 border-zinc-700 text-xs">Last 25</Badge>
        </div>
        <div className="divide-y divide-zinc-800/50 max-h-[350px] overflow-y-auto scrollbar-hide">
          {recentActions.map((action, i) => {
            const at = ACTION_LABELS[action.action_type] || { label: action.action_type, icon: Zap, hex: '#71717a' };
            const Icon = at.icon;
            const isError = action.status !== 'success';
            const ago = getTimeAgo(new Date(action.created_at));
            return (
              <div key={i} className="flex items-center gap-3 p-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isError ? 'bg-red-500/10' : ''}`}
                  style={!isError ? { background: `${at.hex}15` } : undefined}>
                  {isError ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <Icon className="w-4 h-4" style={{ color: at.hex }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{at.label}</p>
                  {isError && action.error_message && (
                    <p className="text-xs text-red-400 truncate">{action.error_message}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <Badge className={`border-0 text-[9px] ${isError ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                    {action.status}
                  </Badge>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{ago}</p>
                </div>
              </div>
            );
          })}
          {recentActions.length === 0 && <p className="text-center text-zinc-600 py-8 text-sm">No recent activity</p>}
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
