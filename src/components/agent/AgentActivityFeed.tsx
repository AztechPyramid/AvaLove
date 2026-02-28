import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles, ExternalLink } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface AgentActivity {
  id: string;
  agentName: string;
  agentHandle: string;
  agentAvatar: string | null;
  creatorName: string;
  creatorAvatar: string | null;
  createdAt: string;
  isVerified: boolean;
}

interface AgentActivityFeedProps {
  limit?: number;
  compact?: boolean;
  showTitle?: boolean;
  className?: string;
}

export function AgentActivityFeed({ 
  limit = 5, 
  compact = false, 
  showTitle = true,
  className = '' 
}: AgentActivityFeedProps) {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchAgentActivities();
    const interval = setInterval(fetchAgentActivities, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  // Cycle through activities for compact mode
  useEffect(() => {
    if (!compact || activities.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activities.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [compact, activities.length]);

  const fetchAgentActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('arena_agents')
        .select(`
          id,
          agent_name,
          agent_handle,
          profile_picture_url,
          is_verified,
          created_at,
          creator:user_id(username, display_name, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const mapped: AgentActivity[] = (data || []).map((agent: any) => ({
        id: agent.id,
        agentName: agent.agent_name,
        agentHandle: agent.agent_handle,
        agentAvatar: agent.profile_picture_url,
        creatorName: agent.creator?.display_name || agent.creator?.username || 'Unknown',
        creatorAvatar: agent.creator?.avatar_url,
        createdAt: agent.created_at,
        isVerified: agent.is_verified || false,
      }));

      setActivities(mapped);
    } catch (error) {
      console.error('Error fetching agent activities:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-12 bg-zinc-800/50 rounded-lg" />
      </div>
    );
  }

  if (activities.length === 0) {
    return null;
  }

  // Compact mode - single rotating item
  if (compact) {
    const activity = activities[currentIndex];
    return (
      <div className={`${className}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 text-sm"
          >
            <Bot className="w-4 h-4 text-purple-400 shrink-0" />
            <Avatar className="w-5 h-5">
              <AvatarImage src={activity.creatorAvatar || undefined} />
              <AvatarFallback className="text-[10px] bg-purple-500/20">
                {activity.creatorName[0]}
              </AvatarFallback>
            </Avatar>
            <span className="text-zinc-400 truncate">
              <span className="text-white font-medium">{activity.creatorName}</span>
              {' '}created{' '}
              <span className="text-purple-400 font-medium">@{activity.agentHandle}</span>
            </span>
            <Sparkles className="w-3 h-3 text-yellow-400" />
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // Full list mode
  return (
    <div className={`space-y-3 ${className}`}>
      {showTitle && (
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-purple-400" />
          <h3 className="text-white font-semibold">New AI Agents</h3>
          <Badge className="bg-purple-500/20 text-purple-400 text-xs">Live</Badge>
        </div>
      )}
      
      <div className="space-y-2">
        {activities.map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-3 p-3 bg-zinc-800/40 rounded-lg border border-zinc-700/50 hover:border-purple-500/30 transition-all group"
          >
            {/* Creator Avatar */}
            <div className="relative">
              <Avatar className="w-10 h-10 ring-2 ring-purple-500/30">
                <AvatarImage src={activity.creatorAvatar || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                  {activity.creatorName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center ring-2 ring-zinc-900">
                <Bot className="w-3 h-3 text-white" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium truncate">
                  {activity.creatorName}
                </span>
                <span className="text-zinc-500 text-sm">created</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Avatar className="w-4 h-4">
                  <AvatarImage src={activity.agentAvatar || undefined} />
                  <AvatarFallback className="text-[8px] bg-cyan-500/20">
                    {activity.agentName[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-purple-400 font-medium text-sm">
                  @{activity.agentHandle}
                </span>
                {activity.isVerified && (
                  <Badge className="bg-green-500/20 text-green-400 text-[10px] px-1.5 py-0">
                    Verified
                  </Badge>
                )}
              </div>
            </div>

            {/* Time & Link */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-zinc-500">
                {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
              </span>
              <a
                href={`https://starsarena.com/${activity.agentHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Export compact version for activity feeds
export function AgentActivityItem() {
  return <AgentActivityFeed limit={5} compact showTitle={false} />;
}
