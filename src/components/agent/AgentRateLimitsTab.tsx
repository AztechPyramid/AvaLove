import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Clock, Zap, MessageSquare, Heart, UserPlus, Trash2, Eye, Globe, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AgentRateLimitsTabProps {
  agentId: string;
}

// Arena API official rate limits per agent API key
const ARENA_RATE_LIMITS = {
  write: [
    { endpoint: 'POST /threads', label: 'Create Post', limit: 10, period: 'hour', icon: MessageSquare },
    { endpoint: 'POST /threads/answer', label: 'Reply / Answer', limit: 10, period: 'hour', icon: MessageSquare },
    { endpoint: 'POST /threads/like', label: 'Like Post', limit: 10, period: 'hour', icon: Heart },
    { endpoint: 'POST /follow/follow', label: 'Follow User', limit: 10, period: 'hour', icon: UserPlus },
    { endpoint: 'POST /chat/message', label: 'Send Chat Message', limit: 90, period: 'hour', icon: MessageSquare },
    { endpoint: 'POST /livestreams', label: 'Create Livestream', limit: 1, period: 'hour', icon: Zap },
    { endpoint: 'POST /stages', label: 'Create Stage', limit: 1, period: 'hour', icon: Zap },
  ],
  update: [
    { endpoint: 'PUT/PATCH (all)', label: 'Update Operations', limit: 10, period: 'hour', icon: RefreshCw },
  ],
  delete: [
    { endpoint: 'DELETE (all)', label: 'Delete Operations', limit: 5, period: 'hour', icon: Trash2 },
  ],
  read: [
    { endpoint: 'GET (all)', label: 'Read Operations', limit: 100, period: 'minute', icon: Eye },
  ],
  global: [
    { endpoint: 'ALL', label: 'Global Limit (all combined)', limit: 1000, period: 'hour', icon: Globe },
  ],
};

interface UsageStats {
  replies_1h: number;
  posts_1h: number;
  likes_1h: number;
  follows_1h: number;
  total_actions_1h: number;
  total_actions_24h: number;
  last_action_at: string | null;
}

export function AgentRateLimitsTab({ agentId }: AgentRateLimitsTabProps) {
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<UsageStats | null>(null);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [logs1h, logs24h] = await Promise.all([
        supabase
          .from('arena_agent_logs')
          .select('action_type, created_at')
          .eq('agent_id', agentId)
          .gte('created_at', oneHourAgo)
          .eq('status', 'success'),
        supabase
          .from('arena_agent_logs')
          .select('action_type, created_at')
          .eq('agent_id', agentId)
          .gte('created_at', twentyFourHoursAgo)
          .eq('status', 'success')
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      const actions1h = logs1h.data || [];
      const replies = actions1h.filter(a => 
        ['auto_reply', 'auto_community_comment', 'auto_comment', 'proactive_comment'].includes(a.action_type)
      ).length;
      const posts = actions1h.filter(a => a.action_type === 'auto_post').length;
      const likes = actions1h.filter(a => a.action_type === 'auto_like').length;
      const follows = actions1h.filter(a => a.action_type === 'auto_follow').length;

      // Get total 24h count
      const { count: total24h } = await supabase
        .from('arena_agent_logs')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', agentId)
        .gte('created_at', twentyFourHoursAgo)
        .eq('status', 'success');

      setUsage({
        replies_1h: replies,
        posts_1h: posts,
        likes_1h: likes,
        follows_1h: follows,
        total_actions_1h: actions1h.length,
        total_actions_24h: total24h || 0,
        last_action_at: logs24h.data?.[0]?.created_at || null,
      });
    } catch (err) {
      console.error('Failed to fetch rate limit usage:', err);
      toast.error('Failed to load rate limit data');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const getUsedCount = (label: string): number => {
    if (!usage) return 0;
    switch (label) {
      case 'Reply / Answer': return usage.replies_1h;
      case 'Create Post': return usage.posts_1h;
      case 'Like Post': return usage.likes_1h;
      case 'Follow User': return usage.follows_1h;
      case 'Send Chat Message': return 0; // We don't track chat messages in logs yet
      default: return 0;
    }
  };

  const getGlobalUsed = (): number => usage?.total_actions_1h || 0;

  if (loading) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Arena API Rate Limits
              </CardTitle>
              <CardDescription className="text-zinc-400 mt-1">
                Each agent has independent rate limits via its unique API key (ak_live_*)
              </CardDescription>
            </div>
            <Button
              onClick={fetchUsage}
              variant="outline"
              size="sm"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Actions (1h)" value={usage?.total_actions_1h || 0} max={1000} />
            <StatCard label="Replies (1h)" value={usage?.replies_1h || 0} max={10} />
            <StatCard label="Actions (24h)" value={usage?.total_actions_24h || 0} />
            <StatCard 
              label="Last Action" 
              value={usage?.last_action_at 
                ? new Date(usage.last_action_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                : 'None'
              } 
              isText 
            />
          </div>
        </CardContent>
      </Card>

      {/* Write Operations */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Write Operations (Strict Limits)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ARENA_RATE_LIMITS.write.map((r) => {
            const used = getUsedCount(r.label);
            return (
              <RateLimitRow
                key={r.endpoint}
                icon={r.icon}
                label={r.label}
                endpoint={r.endpoint}
                used={used}
                limit={r.limit}
                period={r.period}
              />
            );
          })}
        </CardContent>
      </Card>

      {/* Update & Delete */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-400">Update Operations</CardTitle>
          </CardHeader>
          <CardContent>
            {ARENA_RATE_LIMITS.update.map((r) => (
              <RateLimitRow key={r.endpoint} icon={r.icon} label={r.label} used={0} limit={r.limit} period={r.period} endpoint={r.endpoint} />
            ))}
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-400">Delete Operations</CardTitle>
          </CardHeader>
          <CardContent>
            {ARENA_RATE_LIMITS.delete.map((r) => (
              <RateLimitRow key={r.endpoint} icon={r.icon} label={r.label} used={0} limit={r.limit} period={r.period} endpoint={r.endpoint} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Read & Global */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-green-400">Read & Global</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ARENA_RATE_LIMITS.read.map((r) => (
            <RateLimitRow key={r.endpoint} icon={r.icon} label={r.label} used={0} limit={r.limit} period={r.period} endpoint={r.endpoint} />
          ))}
          {ARENA_RATE_LIMITS.global.map((r) => (
            <RateLimitRow key={r.endpoint} icon={r.icon} label={r.label} used={getGlobalUsed()} limit={r.limit} period={r.period} endpoint={r.endpoint} />
          ))}
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-zinc-900/30 border-zinc-800/50">
        <CardContent className="pt-4">
          <p className="text-xs text-zinc-500 leading-relaxed">
            💡 Rate limits are enforced <strong className="text-zinc-400">per API key</strong> by the Arena platform. 
            Each agent operates independently with its own <code className="text-cyan-400/70 text-[11px]">ak_live_*</code> key, 
            so one agent's activity never affects another's quota. Usage shown here is tracked from our logs and may 
            slightly differ from Arena's internal counters.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, max, isText }: { label: string; value: number | string; max?: number; isText?: boolean }) {
  const pct = max ? Math.min(100, (Number(value) / max) * 100) : 0;
  return (
    <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
      <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold mt-1 ${isText ? 'text-zinc-300 text-sm' : 'text-white'}`}>
        {isText ? value : <>{value}{max ? <span className="text-zinc-500 text-sm font-normal">/{max}</span> : ''}</>}
      </p>
      {max && !isText && (
        <Progress value={pct} className="h-1 mt-2 bg-zinc-700" />
      )}
    </div>
  );
}

function RateLimitRow({ icon: Icon, label, endpoint, used, limit, period }: {
  icon: any;
  label: string;
  endpoint: string;
  used: number;
  limit: number;
  period: string;
}) {
  const pct = Math.min(100, (used / limit) * 100);
  const remaining = Math.max(0, limit - used);
  const isWarning = pct >= 70;
  const isDanger = pct >= 90;

  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className={`w-4 h-4 flex-shrink-0 ${isDanger ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-zinc-500'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-zinc-300 truncate">{label}</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-zinc-700 ${
              isDanger ? 'text-red-400 border-red-500/30' : isWarning ? 'text-amber-400 border-amber-500/30' : 'text-zinc-500'
            }`}>
              {used}/{limit} per {period}
            </Badge>
            <span className={`text-xs font-mono ${isDanger ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-green-400'}`}>
              {remaining} left
            </span>
          </div>
        </div>
        <Progress 
          value={pct} 
          className={`h-1 ${isDanger ? '[&>div]:bg-red-500' : isWarning ? '[&>div]:bg-amber-500' : '[&>div]:bg-cyan-500'} bg-zinc-700`} 
        />
        <p className="text-[10px] text-zinc-600 mt-0.5 font-mono truncate">{endpoint}</p>
      </div>
    </div>
  );
}
