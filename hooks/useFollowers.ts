import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useFollowers = (userId?: string, currentUserId?: string) => {
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchFollowerStats();
      if (currentUserId) {
        checkFollowStatus();
      }
    }
  }, [userId, currentUserId]);

  const fetchFollowerStats = async () => {
    if (!userId) return;

    try {
      // Get followers count
      const { count: followers } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);

      // Get following count
      const { count: following } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);

      setFollowersCount(followers || 0);
      setFollowingCount(following || 0);
    } catch (error) {
      console.error('Error fetching follower stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkFollowStatus = async () => {
    if (!currentUserId || !userId || currentUserId === userId) {
      setIsFollowing(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('followers')
        .select('id')
        .eq('follower_id', currentUserId)
        .eq('following_id', userId)
        .maybeSingle();

      if (error) throw error;
      setIsFollowing(!!data);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const toggleFollow = async () => {
    if (!currentUserId || !userId || currentUserId === userId) {
      toast.error('Cannot follow yourself');
      return;
    }

    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', userId);

        if (error) throw error;
        
        setIsFollowing(false);
        toast.success('Unfollowed');
        
        // Refresh counts from database
        await fetchFollowerStats();
      } else {
        // Follow
        const { error } = await supabase
          .from('followers')
          .insert({
            follower_id: currentUserId,
            following_id: userId,
          });

        if (error) throw error;
        
        setIsFollowing(true);
        toast.success('Following');
        
        // Notification is created automatically by database trigger
        // Refresh counts from database
        await fetchFollowerStats();
      }
    } catch (error: any) {
      console.error('Error toggling follow:', error);
      toast.error('Failed to update follow status');
      
      // Revert state on error
      await checkFollowStatus();
      await fetchFollowerStats();
    }
  };

  return {
    followersCount,
    followingCount,
    isFollowing,
    loading,
    toggleFollow,
    refetch: fetchFollowerStats,
  };
};
