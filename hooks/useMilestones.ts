import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { useUserLevel } from './useUserLevel';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

interface MilestoneXP {
  profile_complete: number;
  first_post: number;
  first_match: number;
  first_message: number;
  first_swipe: number;
  total_matches_10: number;
  total_posts_10: number;
  total_messages_50: number;
}

const DEFAULT_MILESTONE_XP: MilestoneXP = {
  profile_complete: 200,
  first_post: 150,
  first_match: 300,
  first_message: 100,
  first_swipe: 50,
  total_matches_10: 500,
  total_posts_10: 400,
  total_messages_50: 300,
};

export const useMilestones = () => {
  const { profile } = useWalletAuth();
  const { addXP } = useUserLevel();
  const [milestoneXP, setMilestoneXP] = useState<MilestoneXP>(DEFAULT_MILESTONE_XP);

  // Fetch milestone XP values from config
  useEffect(() => {
    const fetchMilestoneConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('game_config')
          .select('config_value')
          .eq('config_key', 'milestone_xp')
          .single();

        if (error) throw error;

        if (data?.config_value) {
          setMilestoneXP(data.config_value as unknown as MilestoneXP);
        }
      } catch (error) {
        console.error('[MILESTONE XP] Error fetching config:', error);
      }
    };

    fetchMilestoneConfig();
  }, []);

  const checkAndAwardMilestone = useCallback(async (
    milestoneType: keyof MilestoneXP,
    badgeName: string
  ) => {
    if (!profile?.id) return;

    try {
      // Check if milestone already achieved
      const { data: existingReward } = await supabase
        .from('milestone_rewards')
        .select('*')
        .eq('user_id', profile.id)
        .eq('milestone_type', milestoneType)
        .single();

      if (existingReward) return; // Already awarded

      const xpAmount = milestoneXP[milestoneType];

      // Record milestone reward
      const { error: rewardError } = await supabase
        .from('milestone_rewards')
        .insert({
          user_id: profile.id,
          milestone_type: milestoneType,
          xp_earned: xpAmount,
        });

      if (rewardError) throw rewardError;

      // Award XP
      await addXP(xpAmount);

      // Find and award badge
      const { data: badge } = await supabase
        .from('badges')
        .select('*')
        .eq('name', badgeName)
        .single();

      if (badge) {
        const { error: badgeError } = await supabase
          .from('user_badges')
          .insert({
            user_id: profile.id,
            badge_id: badge.id,
          });

        if (!badgeError) {
          // Create notification
          await supabase.from('notifications').insert({
            user_id: profile.id,
            type: 'achievement',
            title: '🎉 Achievement Unlocked!',
            message: `${badge.name}: ${badge.description}`,
            data: { badge_id: badge.id, xp_earned: xpAmount },
          });
        }
      }

      // Show celebration
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f97316', '#ec4899', '#fbbf24'],
      });

      toast.success(`🎉 ${badgeName} unlocked! +${xpAmount} XP`, {
        duration: 4000,
      });
    } catch (error) {
      console.error('Error checking milestone:', error);
    }
  }, [profile?.id, addXP, milestoneXP]);

  const checkProfileCompletion = useCallback(async () => {
    if (!profile?.id) return;

    const isComplete = !!(
      profile.bio &&
      profile.avatar_url &&
      profile.date_of_birth &&
      profile.interests &&
      profile.interests.length > 0
    );

    if (isComplete) {
      await checkAndAwardMilestone('profile_complete', 'Profile Complete');
    }
  }, [profile, checkAndAwardMilestone]);

  const checkFirstPost = useCallback(async () => {
    if (!profile?.id) return;

    const { count } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id);

    if (count === 1) {
      await checkAndAwardMilestone('first_post', 'First Post');
    } else if (count === 10) {
      await checkAndAwardMilestone('total_posts_10', 'Content Creator');
    }
  }, [profile?.id, checkAndAwardMilestone]);

  const checkFirstMatch = useCallback(async () => {
    if (!profile?.id) return;

    const { count } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`);

    if (count === 1) {
      await checkAndAwardMilestone('first_match', 'First Match');
    } else if (count === 10) {
      await checkAndAwardMilestone('total_matches_10', 'Social Butterfly');
    }
  }, [profile?.id, checkAndAwardMilestone]);

  const checkFirstMessage = useCallback(async () => {
    if (!profile?.id) return;

    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', profile.id);

    if (count === 1) {
      await checkAndAwardMilestone('first_message', 'First Message');
    } else if (count === 50) {
      await checkAndAwardMilestone('total_messages_50', 'Conversation Starter');
    }
  }, [profile?.id, checkAndAwardMilestone]);

  const checkFirstSwipe = useCallback(async () => {
    if (!profile?.id) return;

    const { count } = await supabase
      .from('swipes')
      .select('*', { count: 'exact', head: true })
      .eq('swiper_id', profile.id);

    if (count === 1) {
      await checkAndAwardMilestone('first_swipe', 'First Swipe');
    }
  }, [profile?.id, checkAndAwardMilestone]);

  return {
    checkProfileCompletion,
    checkFirstPost,
    checkFirstMatch,
    checkFirstMessage,
    checkFirstSwipe,
  };
};
