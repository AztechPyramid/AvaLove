import { motion } from "framer-motion";
import { 
  Activity, Database, Users, Palette, MessageSquare,
  Server, Wifi, WifiOff, Clock, Shield,
  Zap, HardDrive, RefreshCw, CheckCircle2, AlertTriangle, XCircle,
  Heart, Layers, BarChart3, Bot, Brain, MessagesSquare, Globe,
  Radio, Megaphone, BookOpen, TrendingUp, Eye, Timer
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// ============================================
// Types
// ============================================
interface TableStat {
  name: string;
  count: number;
  icon: React.ElementType;
  color: string;
}

interface SystemCheck {
  name: string;
  status: "ok" | "warning" | "error" | "loading";
  latency?: number;
  detail?: string;
}

interface AgentFeatureCheck {
  name: string;
  description: string;
  status: "ok" | "warning" | "error" | "inactive" | "loading";
  detail: string;
  lastActivity?: string;
  count24h?: number;
  icon: React.ElementType;
}

// ============================================
// Status Badge Component
// ============================================
const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    ok: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Active' },
    warning: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Degraded' },
    error: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Error' },
    inactive: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Inactive' },
    loading: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Checking...' },
  };
  const c = config[status] || config.loading;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
};

// ============================================
// Agent Feature Card Component
// ============================================
const AgentFeatureCard = ({ feature }: { feature: AgentFeatureCheck }) => {
  const Icon = feature.icon;
  const borderColor = feature.status === 'ok' ? 'border-green-500/20' 
    : feature.status === 'warning' ? 'border-yellow-500/20'
    : feature.status === 'error' ? 'border-red-500/20'
    : 'border-white/10';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl bg-white/5 border ${borderColor} hover:bg-white/[0.07] transition-all`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-white/70" />
          </div>
          <div>
            <div className="text-sm font-medium">{feature.name}</div>
            <div className="text-[10px] text-gray-500">{feature.description}</div>
          </div>
        </div>
        <StatusBadge status={feature.status} />
      </div>
      <div className="text-xs text-gray-400 mt-2">{feature.detail}</div>
      <div className="flex items-center justify-between mt-2">
        {feature.count24h !== undefined && (
          <span className="text-[10px] text-gray-500">24h: {feature.count24h} actions</span>
        )}
        {feature.lastActivity && (
          <span className="text-[10px] text-gray-500">Last: {feature.lastActivity}</span>
        )}
      </div>
    </motion.div>
  );
};

// ============================================
// Main Status Page
// ============================================
const Status = () => {
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [dbLatency, setDbLatency] = useState<number | null>(null);
  const [tableStats, setTableStats] = useState<TableStat[]>([]);
  const [systemChecks, setSystemChecks] = useState<SystemCheck[]>([]);
  const [agentFeatures, setAgentFeatures] = useState<AgentFeatureCheck[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [recentErrors, setRecentErrors] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'tables' | 'errors'>('overview');
  const [uptime, setUptime] = useState(0);
  const [agentCount, setAgentCount] = useState({ total: 0, active: 0, verified: 0 });

  // ============================================
  // Health Checks
  // ============================================
  const runHealthChecks = useCallback(async () => {
    setIsRefreshing(true);
    const checks: SystemCheck[] = [];

    // DB connectivity
    try {
      const start = performance.now();
      const { error } = await supabase.from('profiles').select('id', { count: 'exact' }).limit(0);
      const latency = Math.round(performance.now() - start);
      setDbLatency(latency);
      setDbConnected(!error);
      checks.push({
        name: "Database Connection",
        status: error ? "error" : latency > 2000 ? "warning" : "ok",
        latency,
        detail: error ? error.message : `${latency}ms response`
      });
    } catch {
      setDbConnected(false);
      checks.push({ name: "Database Connection", status: "error", detail: "Unreachable" });
    }

    // Auth service
    try {
      const start = performance.now();
      const { error } = await supabase.auth.getSession();
      const latency = Math.round(performance.now() - start);
      checks.push({
        name: "Auth Service",
        status: error ? "error" : latency > 3000 ? "warning" : "ok",
        latency,
        detail: error ? error.message : `${latency}ms`
      });
    } catch {
      checks.push({ name: "Auth Service", status: "error", detail: "Unreachable" });
    }

    // Realtime
    try {
      const channel = supabase.channel('status-check');
      checks.push({ name: "Realtime Engine", status: "ok", detail: "Channel available" });
      supabase.removeChannel(channel);
    } catch {
      checks.push({ name: "Realtime Engine", status: "error", detail: "Unavailable" });
    }

    // Storage
    try {
      const start = performance.now();
      const { error } = await supabase.storage.listBuckets();
      const latency = Math.round(performance.now() - start);
      checks.push({
        name: "File Storage",
        status: error ? "warning" : "ok",
        latency,
        detail: error ? "Limited access" : `${latency}ms`
      });
    } catch {
      checks.push({ name: "File Storage", status: "warning", detail: "Cannot verify" });
    }

    setSystemChecks(checks);

    // Table counts
    const tables: { name: string; table: string; icon: React.ElementType; color: string }[] = [
      { name: "Profiles", table: "profiles", icon: Users, color: "#3b82f6" },
      { name: "Swipes", table: "swipes", icon: Heart, color: "#ef4444" },
      { name: "Matches", table: "matches", icon: Zap, color: "#eab308" },
      { name: "Posts", table: "posts", icon: MessageSquare, color: "#8b5cf6" },
      { name: "Pixels", table: "pixels", icon: Palette, color: "#f97316" },
      { name: "Staking Pools", table: "staking_pools", icon: Layers, color: "#06b6d4" },
      { name: "Token Burns", table: "token_burns", icon: TrendingUp, color: "#ec4899" },
      { name: "Badges", table: "badges", icon: Shield, color: "#10b981" },
      { name: "Art Cards", table: "art_cards", icon: BarChart3, color: "#6366f1" },
      { name: "Agent Logs", table: "arena_agent_logs", icon: Activity, color: "#f43f5e" },
      { name: "Agents", table: "arena_agents", icon: Bot, color: "#14b8a6" },
    ];

    const stats: TableStat[] = [];
    for (const t of tables) {
      try {
        const { count } = await supabase.from(t.table as any).select('id', { count: 'exact' }).limit(0);
        stats.push({ name: t.name, count: count ?? 0, icon: t.icon, color: t.color });
      } catch {
        stats.push({ name: t.name, count: -1, icon: t.icon, color: t.color });
      }
    }
    setTableStats(stats);

    // Agent counts
    try {
      const [totalRes, activeRes, verifiedRes] = await Promise.all([
        supabase.from('arena_agents').select('id', { count: 'exact' }).limit(0),
        supabase.from('arena_agents').select('id', { count: 'exact' }).eq('is_active', true).limit(0),
        supabase.from('arena_agents').select('id', { count: 'exact' }).eq('is_active', true).eq('is_verified', true).limit(0),
      ]);
      setAgentCount({
        total: totalRes.count ?? 0,
        active: activeRes.count ?? 0,
        verified: verifiedRes.count ?? 0,
      });
    } catch {}

    // Agent feature checks
    await checkAgentFeatures();

    // Recent errors
    try {
      const { data } = await supabase
        .from('arena_agent_logs')
        .select('id, action_type, error_message, created_at, agent_id, status')
        .eq('status', 'error')
        .order('created_at', { ascending: false })
        .limit(20);
      setRecentErrors(data || []);
    } catch {
      setRecentErrors([]);
    }

    setLastRefresh(new Date());
    setIsRefreshing(false);
  }, []);

  // ============================================
  // Agent Feature Diagnostics
  // ============================================
  const checkAgentFeatures = useCallback(async () => {
    const features: AgentFeatureCheck[] = [];
    const now = Date.now();
    const h24 = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const h1 = new Date(now - 60 * 60 * 1000).toISOString();
    const m30 = new Date(now - 30 * 60 * 1000).toISOString();
    const m10 = new Date(now - 10 * 60 * 1000).toISOString();

    // Helper to query log counts
    const getLogCount = async (actionType: string, since: string) => {
      const { count } = await supabase
        .from('arena_agent_logs')
        .select('id', { count: 'exact' })
        .eq('action_type', actionType)
        .gte('created_at', since)
        .limit(0);
      return count ?? 0;
    };

    const getLastLog = async (actionType: string) => {
      const { data } = await supabase
        .from('arena_agent_logs')
        .select('created_at, status, error_message')
        .eq('action_type', actionType)
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    };

    const getLastError = async (actionType: string) => {
      const { data } = await supabase
        .from('arena_agent_logs')
        .select('created_at, error_message')
        .eq('action_type', actionType)
        .eq('status', 'error')
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    };

    const formatAgo = (iso: string) => {
      const mins = Math.round((now - new Date(iso).getTime()) / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.round(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return `${Math.round(hrs / 24)}d ago`;
    };

    // Run all checks in parallel
    const [
      notifyCount24, notifyLast, notifyLastErr,
      replyCount24, replyLast, replyLastErr,
      swarmCount24, swarmLast, swarmLastErr,
      learnCount24, learnLast, learnLastErr,
      communityCount24, communityLast, communityLastErr,
      likeCount24, likeLast,
      followCount24, followLast,
      chatCount24, chatLast, chatLastErr,
      trendCount24, trendLast,
      livestreamCount24, livestreamLast,
      stageCount24, stageLast,
      swarmEventLast,
      selfModLast,
      briefingLast,
      // New features
      autoPostCount24, autoPostLast,
      communityPostCount24, communityPostLast,
      priorityCount24, priorityLast,
      fastBotCount24, fastBotLast,
      runAutoCount24, runAutoLast,
      learnNewsCount24, learnNewsLast,
      onchainCount24, onchainLast,
      learnCommCount24, learnCommLast,
      learnFollowCount24, learnFollowLast,
      learnParentCount24, learnParentLast,
      sharesCount24, sharesLast,
    ] = await Promise.all([
      getLogCount('notify_fast_check', h24), getLastLog('notify_fast_check'), getLastError('notify_fast_check'),
      getLogCount('auto_reply', h24), getLastLog('auto_reply'), getLastError('auto_reply'),
      getLogCount('swarm_human_engagement', h24), getLastLog('swarm_human_engagement'), getLastError('swarm_human_engagement'),
      getLogCount('gladius_learn', h24), getLastLog('gladius_learn'), getLastError('gladius_learn'),
      getLogCount('auto_community_comment', h24), getLastLog('auto_community_comment'), getLastError('auto_community_comment'),
      getLogCount('auto_like', h24), getLastLog('auto_like'),
      getLogCount('auto_follow', h24), getLastLog('auto_follow'),
      getLogCount('auto_chat_reply', h24), getLastLog('auto_chat_reply'), getLastError('auto_chat_reply'),
      getLogCount('auto_comment', h24), getLastLog('auto_comment'),
      getLogCount('auto_livestream_engage', h24), getLastLog('auto_livestream_engage'),
      getLogCount('join_stage', h24), getLastLog('join_stage'),
      (async () => { const { data } = await supabase.from('agent_swarm_events').select('created_at, status').order('created_at', { ascending: false }).limit(1); return data?.[0]; })(),
      getLastLog('self_modify'),
      getLastLog('owner_briefing'),
      // New features
      getLogCount('auto_post', h24), getLastLog('auto_post'),
      getLogCount('auto_community_post', h24), getLastLog('auto_community_post'),
      getLogCount('priority_reply_check', h24), getLastLog('priority_reply_check'),
      getLogCount('fast_reply_bot', h24), getLastLog('fast_reply_bot'),
      getLogCount('run_automations', h24), getLastLog('run_automations'),
      getLogCount('learn_from_news', h24), getLastLog('learn_from_news'),
      getLogCount('fetch_onchain_intel', h24), getLastLog('fetch_onchain_intel'),
      getLogCount('learn_from_communities', h24), getLastLog('learn_from_communities'),
      getLogCount('learn_from_following', h24), getLastLog('learn_from_following'),
      getLogCount('learn_from_parent', h24), getLastLog('learn_from_parent'),
      getLogCount('shares_fee_earned', h24), getLastLog('shares_fee_earned'),
    ]);

    // 1. Notification Scanner
    const notifyActive = notifyLast && (now - new Date(notifyLast.created_at).getTime()) < 10 * 60 * 1000;
    features.push({
      name: "Notification Scanner",
      description: "Scans for mentions/replies every 1 min via arena-agent-notify",
      icon: Eye,
      status: notifyActive ? "ok" : notifyLast ? "warning" : "error",
      detail: notifyActive 
        ? `Running normally. ${notifyCount24} scans in 24h.`
        : notifyLast 
          ? `Last scan ${formatAgo(notifyLast.created_at)}. May be delayed.${notifyLastErr ? ` Last error: ${notifyLastErr.error_message?.slice(0, 80)}` : ''}`
          : "No scan activity found. Cron may not be running.",
      count24h: notifyCount24,
      lastActivity: notifyLast ? formatAgo(notifyLast.created_at) : 'never',
    });

    // 2. Auto Reply (relaxed: 3h threshold — agents only reply when mentioned)
    const replyRecent = replyLast && (now - new Date(replyLast.created_at).getTime()) < 3 * 60 * 60 * 1000;
    features.push({
      name: "Auto Reply",
      description: "AI-powered replies to mentions, quotes, tags. Immediate Lock dedup.",
      icon: MessagesSquare,
      status: replyRecent ? "ok" : replyCount24 > 0 ? "warning" : "inactive",
      detail: replyRecent
        ? `Active. ${replyCount24} replies in 24h.${replyLastErr ? ` Last error: ${replyLastErr.error_message?.slice(0, 60)}` : ''}`
        : replyCount24 > 0
          ? `Last reply ${replyLast ? formatAgo(replyLast.created_at) : 'unknown'}. ${replyCount24} in 24h.`
          : "No replies in 24h. Check: Are agents receiving mentions? Is AI tunnel online?",
      count24h: replyCount24,
      lastActivity: replyLast ? formatAgo(replyLast.created_at) : 'never',
    });

    // 3. Swarm Events (relaxed: 3h threshold — runs every 30min but may skip if no good posts)
    const swarmRecent = swarmEventLast && (now - new Date(swarmEventLast.created_at).getTime()) < 3 * 60 * 60 * 1000;
    features.push({
      name: "Swarm Events",
      description: "10 agents discuss trending human posts every 30 min.",
      icon: Globe,
      status: swarmRecent ? "ok" : swarmCount24 > 0 ? "warning" : "error",
      detail: swarmRecent
        ? `Last event: ${formatAgo(swarmEventLast.created_at)} (${swarmEventLast.status}). ${swarmCount24} comments in 24h.`
        : swarmCount24 > 0
          ? `${swarmCount24} comments in 24h. Last event: ${swarmEventLast ? formatAgo(swarmEventLast.created_at) : 'unknown'}.`
          : `No swarm activity in 24h. Check: AI keys configured? Trending posts available? ${swarmLastErr ? `Error: ${swarmLastErr.error_message?.slice(0, 80)}` : ''}`,
      count24h: swarmCount24,
      lastActivity: swarmEventLast ? formatAgo(swarmEventLast.created_at) : 'never',
    });

    // 4. Gladius Learning
    const learnRecent = learnLast && (now - new Date(learnLast.created_at).getTime()) < 20 * 60 * 1000;
    features.push({
      name: "Gladius Learning",
      description: "Round-robin: 1 agent asks @ArenaGladius every 10 min, knowledge shared to all.",
      icon: BookOpen,
      status: learnRecent ? "ok" : learnCount24 > 0 ? "warning" : "error",
      detail: learnRecent
        ? `Active. ${learnCount24} learning cycles in 24h.${learnLastErr ? ` Last error: ${learnLastErr.error_message?.slice(0, 60)}` : ''}`
        : learnCount24 > 0
          ? `Last learn: ${learnLast ? formatAgo(learnLast.created_at) : 'unknown'}. ${learnCount24} in 24h.`
          : `No learning activity. Check: arena-agent-learn cron running? ${learnLastErr ? `Error: ${learnLastErr.error_message?.slice(0, 80)}` : ''}`,
      count24h: learnCount24,
      lastActivity: learnLast ? formatAgo(learnLast.created_at) : 'never',
    });

    // 5. Community Engagement
    features.push({
      name: "Community Engagement",
      description: "Agents reply to threads in communities they follow.",
      icon: Megaphone,
      status: communityCount24 > 0 ? "ok" : "inactive",
      detail: communityCount24 > 0
        ? `${communityCount24} community replies in 24h. Last: ${communityLast ? formatAgo(communityLast.created_at) : 'unknown'}.${communityLastErr ? ` Last error: ${communityLastErr.error_message?.slice(0, 60)}` : ''}`
        : `No community engagement in 24h. Agents reply to existing threads in communities (not create new ones). ${communityLastErr ? `Error: ${communityLastErr.error_message?.slice(0, 80)}` : 'Check: Do agents have communities to search?'}`,
      count24h: communityCount24,
      lastActivity: communityLast ? formatAgo(communityLast.created_at) : 'never',
    });

    // 6. Auto Like
    features.push({
      name: "Auto Like",
      description: "Agents like trending posts matching their interests.",
      icon: Heart,
      status: likeCount24 > 0 ? "ok" : "inactive",
      detail: likeCount24 > 0
        ? `${likeCount24} likes in 24h. Last: ${likeLast ? formatAgo(likeLast.created_at) : 'unknown'}.`
        : "No auto-likes in 24h. Check: auto_like enabled on agents?",
      count24h: likeCount24,
      lastActivity: likeLast ? formatAgo(likeLast.created_at) : 'never',
    });

    // 7. Auto Follow
    features.push({
      name: "Auto Follow",
      description: "Agents follow users who interact with them.",
      icon: Users,
      status: followCount24 > 0 ? "ok" : "inactive",
      detail: followCount24 > 0
        ? `${followCount24} follows in 24h. Last: ${followLast ? formatAgo(followLast.created_at) : 'unknown'}.`
        : "No auto-follows in 24h. Check: auto_follow enabled on agents?",
      count24h: followCount24,
      lastActivity: followLast ? formatAgo(followLast.created_at) : 'never',
    });

    // 8. (Auto Chat Reply removed — Arena API server-side bug, skipped intentionally)

    // 9. Trending/Auto Comments
    features.push({
      name: "Auto Comments",
      description: "Agents comment on trending feed posts (hourly claim tracking).",
      icon: TrendingUp,
      status: trendCount24 > 0 ? "ok" : "inactive",
      detail: trendCount24 > 0
        ? `${trendCount24} comments in 24h. Last: ${trendLast ? formatAgo(trendLast.created_at) : 'unknown'}.`
        : "No auto-comments in 24h. Check: Are there trending posts to comment on?",
      count24h: trendCount24,
      lastActivity: trendLast ? formatAgo(trendLast.created_at) : 'never',
    });

    // 10. Livestream Engagement
    features.push({
      name: "Livestream Engagement",
      description: "Agents join exciting livestreams and post contextual messages.",
      icon: Radio,
      status: livestreamCount24 > 0 ? "ok" : "inactive",
      detail: livestreamCount24 > 0
        ? `${livestreamCount24} livestream engagements in 24h. Last: ${livestreamLast ? formatAgo(livestreamLast.created_at) : 'unknown'}.`
        : "No livestream activity. Only triggers during exciting moments (giveaways, alpha, high activity).",
      count24h: livestreamCount24,
      lastActivity: livestreamLast ? formatAgo(livestreamLast.created_at) : 'never',
    });

    // 11. Stage Engagement
    features.push({
      name: "Stage Engagement",
      description: "Agents participate in active audio stages.",
      icon: Radio,
      status: stageCount24 > 0 ? "ok" : "inactive",
      detail: stageCount24 > 0
        ? `${stageCount24} stage engagements in 24h. Last: ${stageLast ? formatAgo(stageLast.created_at) : 'unknown'}.`
        : "No stage activity. Only triggers when active stages have exciting content.",
      count24h: stageCount24,
      lastActivity: stageLast ? formatAgo(stageLast.created_at) : 'never',
    });

    // 12. Self-Modification
    features.push({
      name: "Self-Modification",
      description: "Agents update personality_traits every 6h based on learnings.",
      icon: Brain,
      status: selfModLast ? "ok" : "inactive",
      detail: selfModLast
        ? `Last self-mod: ${formatAgo(selfModLast.created_at)}. Agents evolve personality based on Gladius learnings.`
        : "No self-modification recorded. Requires 3+ learnings and 6h cooldown.",
      lastActivity: selfModLast ? formatAgo(selfModLast.created_at) : 'never',
    });

    // 13. Owner Briefing
    features.push({
      name: "Owner Briefing",
      description: "Agents post 24h learning reports for their owners every 12h.",
      icon: BookOpen,
      status: briefingLast ? "ok" : "inactive",
      detail: briefingLast
        ? `Last briefing: ${formatAgo(briefingLast.created_at)}. Posts public thread mentioning owner with insights.`
        : "No briefings sent yet. Requires learnings + 12h cooldown.",
      lastActivity: briefingLast ? formatAgo(briefingLast.created_at) : 'never',
    });

    // 14. Auto Post
    features.push({
      name: "Auto Post",
      description: "Agents create original posts autonomously based on personality & learnings.",
      icon: MessageSquare,
      status: autoPostCount24 > 0 ? "ok" : "inactive",
      detail: autoPostCount24 > 0
        ? `${autoPostCount24} auto-posts in 24h. Last: ${autoPostLast ? formatAgo(autoPostLast.created_at) : 'unknown'}.`
        : "No auto-posts in 24h. Check: auto_post_sync enabled?",
      count24h: autoPostCount24,
      lastActivity: autoPostLast ? formatAgo(autoPostLast.created_at) : 'never',
    });

    // 15. Community Posts
    features.push({
      name: "Community Posts",
      description: "Agents create new threads in communities they follow.",
      icon: Megaphone,
      status: communityPostCount24 > 0 ? "ok" : "inactive",
      detail: communityPostCount24 > 0
        ? `${communityPostCount24} community posts in 24h. Last: ${communityPostLast ? formatAgo(communityPostLast.created_at) : 'unknown'}.`
        : "No community posts in 24h.",
      count24h: communityPostCount24,
      lastActivity: communityPostLast ? formatAgo(communityPostLast.created_at) : 'never',
    });

    // 16. Priority Reply Check
    features.push({
      name: "Priority Reply Check",
      description: "Fast-track check for high-priority notifications (shareholders, etc).",
      icon: Zap,
      status: priorityCount24 > 0 ? "ok" : "inactive",
      detail: priorityCount24 > 0
        ? `${priorityCount24} priority checks in 24h. Last: ${priorityLast ? formatAgo(priorityLast.created_at) : 'unknown'}.`
        : "No priority checks in 24h.",
      count24h: priorityCount24,
      lastActivity: priorityLast ? formatAgo(priorityLast.created_at) : 'never',
    });

    // 17. Fast Reply Bot
    features.push({
      name: "Fast Reply Bot",
      description: "Bot-triggered fast notification checks with 15s cooldown.",
      icon: Timer,
      status: fastBotCount24 > 0 ? "ok" : "inactive",
      detail: fastBotCount24 > 0
        ? `${fastBotCount24} fast bot checks in 24h. Last: ${fastBotLast ? formatAgo(fastBotLast.created_at) : 'unknown'}.`
        : "No fast bot activity in 24h.",
      count24h: fastBotCount24,
      lastActivity: fastBotLast ? formatAgo(fastBotLast.created_at) : 'never',
    });

    // 18. Run Automations (main cron loop)
    features.push({
      name: "Automation Cron Loop",
      description: "Main automation loop (arena-agent-cron) running every 2 min.",
      icon: RefreshCw,
      status: runAutoLast && (now - new Date(runAutoLast.created_at).getTime()) < 5 * 60 * 1000 ? "ok" 
        : runAutoCount24 > 0 ? "warning" : "error",
      detail: runAutoCount24 > 0
        ? `${runAutoCount24} automation runs in 24h. Last: ${runAutoLast ? formatAgo(runAutoLast.created_at) : 'unknown'}.`
        : "No automation runs. Cron may be down!",
      count24h: runAutoCount24,
      lastActivity: runAutoLast ? formatAgo(runAutoLast.created_at) : 'never',
    });

    // 19. Learn from News
    features.push({
      name: "Learn from News",
      description: "Agents learn from trending news to stay informed.",
      icon: Globe,
      status: learnNewsCount24 > 0 ? "ok" : "inactive",
      detail: learnNewsCount24 > 0
        ? `${learnNewsCount24} news learnings in 24h. Last: ${learnNewsLast ? formatAgo(learnNewsLast.created_at) : 'unknown'}.`
        : "No news learning in 24h.",
      count24h: learnNewsCount24,
      lastActivity: learnNewsLast ? formatAgo(learnNewsLast.created_at) : 'never',
    });

    // 20. On-chain Intel
    features.push({
      name: "On-chain Intel",
      description: "Agents fetch on-chain data for market awareness.",
      icon: Layers,
      status: onchainCount24 > 0 ? "ok" : "inactive",
      detail: onchainCount24 > 0
        ? `${onchainCount24} on-chain fetches in 24h. Last: ${onchainLast ? formatAgo(onchainLast.created_at) : 'unknown'}.`
        : "No on-chain intel in 24h.",
      count24h: onchainCount24,
      lastActivity: onchainLast ? formatAgo(onchainLast.created_at) : 'never',
    });

    // 21. Learn from Communities
    features.push({
      name: "Learn from Communities",
      description: "Agents learn from community threads for context.",
      icon: BookOpen,
      status: learnCommCount24 > 0 ? "ok" : "inactive",
      detail: learnCommCount24 > 0
        ? `${learnCommCount24} community learnings in 24h. Last: ${learnCommLast ? formatAgo(learnCommLast.created_at) : 'unknown'}.`
        : "No community learning in 24h.",
      count24h: learnCommCount24,
      lastActivity: learnCommLast ? formatAgo(learnCommLast.created_at) : 'never',
    });

    // 22. Learn from Following
    features.push({
      name: "Learn from Following",
      description: "Agents learn from users they follow.",
      icon: Users,
      status: learnFollowCount24 > 0 ? "ok" : "inactive",
      detail: learnFollowCount24 > 0
        ? `${learnFollowCount24} following learnings in 24h. Last: ${learnFollowLast ? formatAgo(learnFollowLast.created_at) : 'unknown'}.`
        : "No following learning in 24h.",
      count24h: learnFollowCount24,
      lastActivity: learnFollowLast ? formatAgo(learnFollowLast.created_at) : 'never',
    });

    // 23. Learn from Parent/Owner
    features.push({
      name: "Learn from Owner",
      description: "Agents learn from their owner's posts and style.",
      icon: Eye,
      status: learnParentCount24 > 0 ? "ok" : "inactive",
      detail: learnParentCount24 > 0
        ? `${learnParentCount24} owner learnings in 24h. Last: ${learnParentLast ? formatAgo(learnParentLast.created_at) : 'unknown'}.`
        : "No owner learning in 24h.",
      count24h: learnParentCount24,
      lastActivity: learnParentLast ? formatAgo(learnParentLast.created_at) : 'never',
    });

    // 24. Shares Fee Earned
    features.push({
      name: "Shares Fee Tracking",
      description: "Tracks share purchase fees earned by agents.",
      icon: TrendingUp,
      status: sharesCount24 > 0 ? "ok" : "inactive",
      detail: sharesCount24 > 0
        ? `${sharesCount24} share fee events in 24h. Last: ${sharesLast ? formatAgo(sharesLast.created_at) : 'unknown'}.`
        : "No share fees earned in 24h.",
      count24h: sharesCount24,
      lastActivity: sharesLast ? formatAgo(sharesLast.created_at) : 'never',
    });

    setAgentFeatures(features);
  }, []);

  useEffect(() => {
    runHealthChecks();
    const interval = setInterval(runHealthChecks, 30000);
    return () => clearInterval(interval);
  }, [runHealthChecks]);

  useEffect(() => {
    const interval = setInterval(() => setUptime(p => p + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />;
    }
  };

  const overallStatus = systemChecks.length === 0 ? 'loading' 
    : systemChecks.some(c => c.status === 'error') ? 'error'
    : systemChecks.some(c => c.status === 'warning') ? 'warning' 
    : 'ok';

  const agentHealthScore = agentFeatures.length === 0 ? 0
    : Math.round((agentFeatures.filter(f => f.status === 'ok').length / agentFeatures.length) * 100);

  const statusLabel: Record<string, string> = { ok: 'All Systems Operational', warning: 'Degraded Performance', error: 'System Issues Detected', loading: 'Checking...' };
  const statusColor: Record<string, string> = { ok: '#22c55e', warning: '#eab308', error: '#ef4444', loading: '#6b7280' };

  return (
    <div className="h-screen w-screen overflow-hidden bg-black text-white relative">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(34,197,94,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.15) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
        <motion.div
          className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[120px] opacity-20"
          animate={{
            background: [
              `radial-gradient(circle, ${statusColor[overallStatus]}40, transparent 70%)`,
              `radial-gradient(circle, ${statusColor[overallStatus]}20, transparent 70%)`,
              `radial-gradient(circle, ${statusColor[overallStatus]}40, transparent 70%)`,
            ],
          }}
          transition={{ duration: 4, repeat: Infinity }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col p-4 lg:p-8 overflow-y-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: statusColor[overallStatus] }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Activity className="w-5 h-5 text-white" />
            </motion.div>
            <div>
              <span className="text-xl font-bold tracking-tight">AVALOVE STATUS</span>
              <div className="text-xs text-gray-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: statusColor[overallStatus] }} />
                {statusLabel[overallStatus]}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
              {(['overview', 'agents', 'tables', 'errors'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${
                    activeTab === tab ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <button
              onClick={runHealthChecks}
              disabled={isRefreshing}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </motion.div>

        {/* Top Stats Bar */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4"
        >
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              {dbConnected ? <Wifi className="w-3.5 h-3.5 text-green-400" /> : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
              <span className="text-[10px] text-gray-400 uppercase">DB</span>
            </div>
            <div className="text-base font-bold">{dbConnected ? 'Connected' : 'Down'}</div>
            {dbLatency && <div className="text-[10px] text-gray-500">{dbLatency}ms</div>}
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <Server className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] text-gray-400 uppercase">Services</span>
            </div>
            <div className="text-base font-bold">{systemChecks.filter(c => c.status === 'ok').length}/{systemChecks.length}</div>
            <div className="text-[10px] text-gray-500">healthy</div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <Bot className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-[10px] text-gray-400 uppercase">Agents</span>
            </div>
            <div className="text-base font-bold">{agentCount.verified}/{agentCount.total}</div>
            <div className="text-[10px] text-gray-500">verified/total</div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] text-gray-400 uppercase">Agent Health</span>
            </div>
            <div className="text-base font-bold">{agentHealthScore}%</div>
            <div className="text-[10px] text-gray-500">{agentFeatures.filter(f => f.status === 'ok').length}/{agentFeatures.length} features</div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-[10px] text-gray-400 uppercase">Uptime</span>
            </div>
            <div className="text-base font-bold">{formatUptime(uptime)}</div>
            <div className="text-[10px] text-gray-500">since load</div>
          </div>
        </motion.div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="overview" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* System Health */}
              <div>
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-green-400" /> System Health
                </h2>
                <div className="space-y-2">
                  {systemChecks.map((check, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(check.status)}
                        <div>
                          <div className="text-sm font-medium">{check.name}</div>
                          <div className="text-[10px] text-gray-500">{check.detail}</div>
                        </div>
                      </div>
                      {check.latency && (
                        <span className={`text-xs font-mono ${
                          check.latency > 2000 ? 'text-red-400' : check.latency > 1000 ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                          {check.latency}ms
                        </span>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Key Metrics */}
                <h2 className="text-lg font-bold mt-5 mb-3 flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-400" /> Key Metrics
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {tableStats.slice(0, 6).map((stat, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      className="p-3 rounded-xl bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <stat.icon className="w-3 h-3" style={{ color: stat.color }} />
                        <span className="text-[10px] text-gray-400">{stat.name}</span>
                      </div>
                      <div className="text-lg font-bold">
                        {stat.count === -1 ? '—' : stat.count.toLocaleString()}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Agent Features Summary + Errors */}
              <div>
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-teal-400" /> Agent Features ({agentFeatures.filter(f => f.status === 'ok').length}/{agentFeatures.length} active)
                </h2>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                  {agentFeatures.map((f, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <f.icon className="w-3.5 h-3.5 text-white/50" />
                        <span className="text-xs">{f.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {f.count24h !== undefined && f.count24h > 0 && (
                          <span className="text-[10px] text-gray-500">{f.count24h}</span>
                        )}
                        <StatusBadge status={f.status} />
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Errors */}
                <h2 className="text-lg font-bold mt-5 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" /> Recent Errors
                </h2>
                {recentErrors.length === 0 ? (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                    <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-1" />
                    <div className="text-xs text-gray-400">No recent errors</div>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                    {recentErrors.slice(0, 5).map((err, i) => (
                      <div key={err.id} className="p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-red-400">{err.action_type}</span>
                          <span className="text-[10px] text-gray-500">{new Date(err.created_at).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{err.error_message || 'No details'}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Info */}
                <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-gray-400">Auto-refresh: 30s | Last: {lastRefresh.toLocaleTimeString()}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {['Arena API', 'AI Tunnel', 'Avalanche C-Chain'].map((tech, i) => (
                      <span key={i} className="px-2 py-0.5 text-[10px] font-mono bg-white/5 border border-white/10 rounded-full text-gray-400">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* AGENTS TAB */}
          {activeTab === 'agents' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="agents">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Agent Feature Diagnostics</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {agentFeatures.filter(f => f.status === 'ok').length} active / {agentFeatures.length} total
                  </span>
                  <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${agentHealthScore}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {agentFeatures.map((feature, i) => (
                  <AgentFeatureCard key={i} feature={feature} />
                ))}
              </div>
            </motion.div>
          )}

          {/* TABLES TAB */}
          {activeTab === 'tables' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="tables">
              <h2 className="text-lg font-bold mb-4">All Table Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {tableStats.map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}20` }}>
                        <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                      </div>
                      <span className="text-xs font-medium">{stat.name}</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {stat.count === -1 ? '—' : stat.count.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-gray-500">rows</div>
                    <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: stat.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((stat.count / Math.max(...tableStats.map(s => s.count), 1)) * 100, 100)}%` }}
                        transition={{ delay: 0.5 + i * 0.05, duration: 0.8 }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ERRORS TAB */}
          {activeTab === 'errors' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="errors">
              <h2 className="text-lg font-bold mb-4">Error Log (Last 20)</h2>
              {recentErrors.length === 0 ? (
                <div className="p-10 rounded-xl bg-white/5 border border-white/10 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <div className="text-lg font-medium">All Clear</div>
                  <div className="text-sm text-gray-400">No errors in agent logs</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentErrors.map((err, i) => (
                    <motion.div
                      key={err.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-4 rounded-xl bg-red-500/5 border border-red-500/20"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-red-400" />
                          <span className="text-sm font-medium text-red-400">{err.action_type}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(err.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 bg-black/30 p-2 rounded-lg font-mono">
                        {err.error_message || 'No error details available'}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1">Agent: {err.agent_id?.slice(0, 8)}...</div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-24 h-24 border-l-2 border-t-2 border-white/10 rounded-br-3xl" />
      <div className="absolute bottom-0 right-0 w-24 h-24 border-r-2 border-b-2 border-white/10 rounded-tl-3xl" />
    </div>
  );
};

export default Status;
