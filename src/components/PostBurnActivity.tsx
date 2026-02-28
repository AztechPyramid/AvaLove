import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Flame } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import avloLogo from '@/assets/avlo-logo.jpg';
import { useAvloPrice } from '@/hooks/useAvloPrice';

interface BurnActivity {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_burned: number;
}

export const PostBurnActivity = () => {
  const [activities, setActivities] = useState<BurnActivity[]>([]);
  const [totalBurned, setTotalBurned] = useState(0);
  const [newBurnUserIds, setNewBurnUserIds] = useState<Set<string>>(new Set());
  const { formatAvloWithUsd } = useAvloPrice();

  useEffect(() => {
    fetchBurnActivities();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('token-burns-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'token_burns',
          filter: 'burn_type=like.post_%',
        },
        (payload) => {
          const newBurn = payload.new as any;
          
          // Add to new burns for animation
          setNewBurnUserIds(prev => new Set(prev).add(newBurn.user_id));
          
          // Remove animation after 2 seconds
          setTimeout(() => {
            setNewBurnUserIds(prev => {
              const updated = new Set(prev);
              updated.delete(newBurn.user_id);
              return updated;
            });
          }, 2000);

          // Refetch to get user data
          fetchBurnActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchBurnActivities = async () => {
    try {
      // Fetch all post burns
      const { data: burns } = await supabase
        .from('token_burns')
        .select(`
          user_id,
          amount,
          profiles!token_burns_user_id_fkey(username, avatar_url)
        `)
        .like('burn_type', 'post_%');

      if (!burns) return;

      // Group by user and sum amounts
      const userBurns = burns.reduce((acc: Record<string, BurnActivity>, burn: any) => {
        const userId = burn.user_id;
        if (!acc[userId]) {
          acc[userId] = {
            user_id: userId,
            username: burn.profiles?.username || 'Unknown',
            avatar_url: burn.profiles?.avatar_url || null,
            total_burned: 0,
          };
        }
        acc[userId].total_burned += burn.amount;
        return acc;
      }, {});

      // Convert to array and sort by total burned
      const sortedActivities = Object.values(userBurns)
        .sort((a, b) => b.total_burned - a.total_burned)
        .slice(0, 5);

      // Calculate total
      const total = burns.reduce((sum, burn) => sum + burn.amount, 0);

      setActivities(sortedActivities);
      setTotalBurned(total);
    } catch (error) {
      console.error('Error fetching burn activities:', error);
    }
  };

  return (
    <>
      {/* Desktop Version */}
      <Card className="hidden xl:block bg-black border-zinc-800 p-3 sm:p-4">
        <h3 className="text-white font-bold text-base sm:text-lg mb-2 sm:mb-3 flex items-center gap-2">
          <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
          Post Burns
        </h3>
        
        <div className="space-y-3 sm:space-y-4">
          <div className="p-2 sm:p-3 bg-zinc-800/50 rounded-lg">
            <div className="text-xs text-zinc-400 mb-1">Total AVLO Burned</div>
            <div className="flex items-center gap-2">
              <img src={avloLogo} alt="AVLO" className="w-4 h-4 sm:w-5 sm:h-5 rounded-full" />
              <span className="text-xl sm:text-2xl font-bold text-orange-500">
                {formatAvloWithUsd(totalBurned).avlo}
              </span>
              <span className="text-xs text-green-400">({formatAvloWithUsd(totalBurned).usd})</span>
            </div>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <div className="text-xs text-zinc-400 font-semibold mb-1 sm:mb-2">Top Burners</div>
            {activities.length === 0 ? (
              <div className="text-zinc-500 text-xs">No burns yet...</div>
            ) : (
              activities.map((activity) => {
                const isVideo = activity.avatar_url && /\.(mp4|webm|ogg|mov)$/i.test(activity.avatar_url);
                return (
                  <div 
                    key={activity.user_id} 
                    className={`flex items-center gap-2 text-xs p-1.5 sm:p-2 rounded transition-all duration-500 ${
                      newBurnUserIds.has(activity.user_id) 
                        ? 'bg-orange-500/20 animate-pulse scale-105' 
                        : 'bg-transparent'
                    }`}
                  >
                    <Flame className="w-3 h-3 text-orange-500 flex-shrink-0" />
                    {isVideo ? (
                      <video
                        src={activity.avatar_url}
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover border border-white/30"
                        autoPlay
                        loop
                        muted
                        playsInline
                      />
                    ) : (
                      <Avatar className="w-5 h-5 sm:w-6 sm:h-6 border border-white/30">
                        <AvatarImage src={activity.avatar_url || ''} />
                        <AvatarFallback className="bg-orange-500/30 text-white text-xs">
                          {activity.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <span className="text-zinc-400 truncate text-xs">
                      {activity.username}
                    </span>
                    <span className="text-orange-400 font-semibold ml-auto text-xs">
                      {formatAvloWithUsd(activity.total_burned).avlo}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>

      {/* Mobile Version - Minimal Horizontal */}
      <div className="xl:hidden w-full px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center justify-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-sm text-zinc-400">Total Post Burns:</span>
          <img src={avloLogo} alt="AVLO" className="w-4 h-4 rounded-full" />
          <span className="text-base font-bold text-orange-500">
            {formatAvloWithUsd(totalBurned).avlo} AVLO
          </span>
          <span className="text-xs text-green-400">({formatAvloWithUsd(totalBurned).usd})</span>
        </div>
      </div>
    </>
  );
};
