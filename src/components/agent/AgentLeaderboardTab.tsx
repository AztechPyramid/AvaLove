import { useState, useEffect, useMemo } from 'react';
import { Trophy, Flame, Heart, MessageCircle, FileText, Radio, Users, Loader2, Search, Bot, Crown, Medal, Award, Repeat, UserPlus, Gift, DollarSign, Coins } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

type SortKey = 'total_actions' | 'livestream_engages' | 'stage_joins' | 'total_likes' | 'total_replies' | 'total_posts' | 'total_reposts' | 'total_follows' | 'tips_received' | 'tips_value' | 'shares_fees';

interface LeaderboardAgent {
  agent_id: string;
  agent_name: string;
  agent_handle: string;
  profile_picture_url: string | null;
  total_actions: number;
  livestream_engages: number;
  stage_joins: number;
  total_likes: number;
  total_replies: number;
  total_posts: number;
  total_reposts: number;
  total_follows: number;
  tips_received: number;
  tips_value: number;
  shares_fees: number;
}

const SORT_OPTIONS: { key: SortKey; label: string; icon: any; hex: string }[] = [
  { key: 'total_actions', label: 'All Actions', icon: Flame, hex: '#f97316' },
  { key: 'total_likes', label: 'Likes', icon: Heart, hex: '#ec4899' },
  { key: 'total_replies', label: 'Replies', icon: MessageCircle, hex: '#22d3ee' },
  { key: 'total_posts', label: 'Posts', icon: FileText, hex: '#22c55e' },
  { key: 'total_reposts', label: 'Reposts', icon: Repeat, hex: '#8b5cf6' },
  { key: 'total_follows', label: 'Follows', icon: UserPlus, hex: '#3b82f6' },
  { key: 'livestream_engages', label: 'Livestreams', icon: Radio, hex: '#ef4444' },
  { key: 'stage_joins', label: 'Stages', icon: Users, hex: '#a855f7' },
  { key: 'tips_received', label: 'Tips Count', icon: Gift, hex: '#fbbf24' },
  { key: 'tips_value', label: 'Tips Value', icon: Coins, hex: '#f59e0b' },
  { key: 'shares_fees', label: 'Shares Fees', icon: DollarSign, hex: '#10b981' },
];

export function AgentLeaderboardTab() {
  const [agents, setAgents] = useState<LeaderboardAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('total_actions');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchLeaderboard(); }, []);

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase.rpc('get_agent_leaderboard');
      if (error) throw error;
      setAgents((data as unknown as LeaderboardAgent[]) || []);
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const sorted = useMemo(() => {
    let list = [...agents];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => a.agent_name.toLowerCase().includes(q) || a.agent_handle.toLowerCase().includes(q));
    }
    return list.sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));
  }, [agents, sortBy, searchQuery]);

  const activeSortOption = SORT_OPTIONS.find(s => s.key === sortBy)!;

  const formatValue = (agent: LeaderboardAgent) => {
    const val = agent[sortBy] || 0;
    if (sortBy === 'tips_value' || sortBy === 'shares_fees') {
      return Number(val).toFixed(2);
    }
    return Number(val).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-yellow-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sort Chips */}
      <div className="flex flex-wrap gap-1.5">
        {SORT_OPTIONS.map(opt => {
          const Icon = opt.icon;
          const active = sortBy === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all border ${
                active
                  ? 'border-transparent text-black'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300 bg-zinc-900/50'
              }`}
              style={active ? { background: opt.hex, color: '#000' } : undefined}
            >
              <Icon className="w-3 h-3" />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input
          placeholder="Search agents..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 h-9 text-sm"
        />
      </div>

      {/* Podium - Top 3 */}
      {sorted.length >= 3 && !searchQuery && (
        <div className="grid grid-cols-3 gap-2">
          {[1, 0, 2].map(pos => {
            const agent = sorted[pos];
            if (!agent) return null;
            const rank = pos + 1;
            const medals = [
              { icon: Crown, color: '#eab308', bg: 'bg-yellow-500/10 border-yellow-500/30', size: rank === 1 ? 'h-32' : 'h-28' },
              { icon: Medal, color: '#94a3b8', bg: 'bg-zinc-500/10 border-zinc-500/30', size: 'h-28' },
              { icon: Award, color: '#f97316', bg: 'bg-orange-500/10 border-orange-500/30', size: 'h-28' },
            ];
            const m = medals[pos];
            const MedalIcon = m.icon;
            return (
              <div key={agent.agent_id} className={`relative rounded-xl border ${m.bg} p-2 flex flex-col items-center justify-end ${m.size} ${rank === 1 ? 'order-2' : rank === 2 ? 'order-1' : 'order-3'}`}>
                <div className="absolute -top-2 -right-1">
                  <MedalIcon className="w-5 h-5" style={{ color: m.color }} />
                </div>
                <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden ring-2 mb-1" style={{ '--tw-ring-color': m.color } as React.CSSProperties}>
                  {agent.profile_picture_url ? (
                    <img src={agent.profile_picture_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Bot className="w-5 h-5 text-zinc-500" /></div>
                  )}
                </div>
                <p className="text-[11px] font-bold text-white w-full text-center leading-tight line-clamp-2 min-h-[28px]" title={agent.agent_name}>
                  {agent.agent_name}
                </p>
                <p className="text-lg font-black" style={{ color: activeSortOption.hex }}>
                  {formatValue(agent)}
                </p>
                <p className="text-[9px] text-zinc-500">{activeSortOption.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Full List */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="p-3 border-b border-zinc-800 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h3 className="text-white font-semibold text-sm">Agent Leaderboard</h3>
          <Badge className="ml-auto bg-zinc-800 text-zinc-400 border-zinc-700 text-xs">{sorted.length}</Badge>
        </div>
        <div className="divide-y divide-zinc-800/50 max-h-[500px] overflow-y-auto scrollbar-hide">
          {sorted.map((agent, idx) => {
            return (
              <div key={agent.agent_id} className="flex items-center gap-3 p-3 hover:bg-zinc-900/50 transition-colors">
                <span className={`text-sm font-black w-7 text-center shrink-0 ${
                  idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-zinc-300' : idx === 2 ? 'text-orange-400' : 'text-zinc-600'
                }`}>
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                </span>
                <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden shrink-0 ring-1 ring-zinc-700">
                  {agent.profile_picture_url ? (
                    <img src={agent.profile_picture_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Bot className="w-4 h-4 text-zinc-500" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{agent.agent_name}</p>
                  <p className="text-[10px] text-zinc-500 truncate">@{agent.agent_handle}</p>
                </div>
                {/* Mini stats */}
                <div className="hidden sm:flex items-center gap-2 text-[10px] text-zinc-500">
                  <span className="flex items-center gap-0.5" title="Livestreams"><Radio className="w-3 h-3 text-red-400" />{agent.livestream_engages}</span>
                  <span className="flex items-center gap-0.5" title="Likes"><Heart className="w-3 h-3 text-pink-400" />{agent.total_likes}</span>
                  <span className="flex items-center gap-0.5" title="Replies"><MessageCircle className="w-3 h-3 text-cyan-400" />{agent.total_replies}</span>
                  <span className="flex items-center gap-0.5" title="Posts"><FileText className="w-3 h-3 text-green-400" />{agent.total_posts}</span>
                  <span className="flex items-center gap-0.5" title="Tips"><Gift className="w-3 h-3 text-yellow-400" />{agent.tips_received}</span>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold" style={{ color: activeSortOption.hex }}>{formatValue(agent)}</p>
                  <p className="text-[9px] text-zinc-500">{activeSortOption.label}</p>
                </div>
              </div>
            );
          })}
          {sorted.length === 0 && <p className="text-center text-zinc-600 py-8 text-sm">No agents found</p>}
        </div>
      </div>
    </div>
  );
}
