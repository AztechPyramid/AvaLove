import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useAPY() {
  const [totalUserCount, setTotalUserCount] = useState<number>(0);
  const [totalRewardPool, setTotalRewardPool] = useState<number>(200_000_000);
  const [distributedRewards, setDistributedRewards] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAPYData();
  }, []);

  const fetchAPYData = async () => {
    try {
      // Get total user count
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      setTotalUserCount(userCount || 0);

      // Get total reward pool from config
      const { data: poolData } = await supabase
        .from('game_config')
        .select('config_value')
        .eq('config_key', 'total_reward_pool')
        .single();
      
      if (poolData?.config_value && typeof poolData.config_value === 'object' && 'value' in poolData.config_value) {
        setTotalRewardPool((poolData.config_value as { value: number }).value);
      }

      // Get distributed rewards (paid = true)
      const [{ data: gameData }, { data: musicData }, { data: watchData }] = await Promise.all([
        supabase
          .from('embedded_game_sessions')
          .select('reward_earned')
          .eq('paid', true),
        supabase
          .from('music_track_listens')
          .select('reward_earned')
          .eq('paid', true),
        supabase
          .from('watch_video_views')
          .select('reward_earned')
          .eq('paid', true)
      ]);
      
      const gamePaid = gameData?.reduce((sum, item) => sum + Number(item.reward_earned || 0), 0) || 0;
      const musicPaid = musicData?.reduce((sum, item) => sum + Number(item.reward_earned || 0), 0) || 0;
      const watchPaid = watchData?.reduce((sum, item) => sum + Number(item.reward_earned || 0), 0) || 0;
      
      setDistributedRewards(gamePaid + musicPaid + watchPaid);
    } catch (error) {
      console.error('Error fetching APY data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate APY: (Remaining Pool / User Count) / 144,000
  const calculateAPY = (): number => {
    if (totalUserCount === 0) return 0;
    const remaining = totalRewardPool - distributedRewards;
    const poolPerUser = remaining / totalUserCount;
    const apy = poolPerUser / 144_000;
    return apy;
  };

  const estimatedAPY = calculateAPY();
  const remainingPool = totalRewardPool - distributedRewards;

  return {
    estimatedAPY,
    totalUserCount,
    totalRewardPool,
    distributedRewards,
    remainingPool,
    loading,
    refetch: fetchAPYData
  };
}
