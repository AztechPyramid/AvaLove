import { useMemo } from 'react';
import { useRewardPerSecond } from './useRewardPerSecond';

/**
 * Unified cost hook that derives all costs from reward_per_second
 * All costs = rewardPerSecond * 10
 */
export function useUnifiedCost() {
  const { rewardPerSecond, loading, refetch } = useRewardPerSecond();

  const costs = useMemo(() => {
    const baseCost = rewardPerSecond * 10;
    
    return {
      // Base cost for all actions
      baseCost,
      
      // Chat costs
      chatMessageCost: baseCost,
      
      // Post costs (all same base cost)
      textPostCost: baseCost,
      imagePostCost: baseCost,
      videoPostCost: baseCost,
      gifPostCost: baseCost,
      repostCost: baseCost,
      
      // Pixel art cost
      pixelCost: baseCost,
      
      // Helper to get cost by type
      getCostForMediaType: (type: string): number => {
        // All media types have the same cost now
        return baseCost;
      },
    };
  }, [rewardPerSecond]);

  return {
    ...costs,
    rewardPerSecond,
    loading,
    refetch,
  };
}
