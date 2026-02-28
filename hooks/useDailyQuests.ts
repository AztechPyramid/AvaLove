import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { useUserLevel } from './useUserLevel';
import { toast } from 'sonner';

interface DailyQuest {
  id: string;
  quest_type: 'swipe' | 'match' | 'message' | 'tip' | 'login';
  target: number;
  progress: number;
  completed: boolean;
  xp_reward: number;
  date: string;
}

const QUEST_TEMPLATES = {
  swipe: { target: 20, xp_reward: 100 },
  match: { target: 3, xp_reward: 150 },
  message: { target: 10, xp_reward: 100 },
  tip: { target: 2, xp_reward: 200 },
  login: { target: 1, xp_reward: 50 },
};

export const useDailyQuests = () => {
  const { profile } = useWalletAuth();
  const { addXP } = useUserLevel();
  const [quests, setQuests] = useState<DailyQuest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;

    initializeDailyQuests();
  }, [profile?.id]);

  const initializeDailyQuests = async () => {
    if (!profile?.id) return;

    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch existing quests for today
      const { data: existingQuests, error: fetchError } = await supabase
        .from('daily_quests')
        .select('*')
        .eq('user_id', profile.id)
        .eq('date', today);

      if (fetchError) throw fetchError;

      // Create missing quests
      const existingTypes = new Set(existingQuests?.map((q) => q.quest_type) || []);
      const missingTypes = Object.keys(QUEST_TEMPLATES).filter(
        (type) => !existingTypes.has(type as any)
      );

      if (missingTypes.length > 0) {
        const newQuests = missingTypes.map((type) => ({
          user_id: profile.id,
          quest_type: type as keyof typeof QUEST_TEMPLATES,
          target: QUEST_TEMPLATES[type as keyof typeof QUEST_TEMPLATES].target,
          progress: type === 'login' ? 1 : 0, // Auto-complete login quest
          completed: type === 'login',
          xp_reward: QUEST_TEMPLATES[type as keyof typeof QUEST_TEMPLATES].xp_reward,
          date: today,
        }));

        const { data: insertedQuests, error: insertError } = await supabase
          .from('daily_quests')
          .insert(newQuests)
          .select();

        if (insertError) throw insertError;

        // Auto-complete login quest and award XP
        if (missingTypes.includes('login')) {
          await addXP(QUEST_TEMPLATES.login.xp_reward);
        }

        setQuests([...(existingQuests as DailyQuest[] || []), ...(insertedQuests as DailyQuest[] || [])]);
      } else {
        setQuests((existingQuests as DailyQuest[]) || []);
      }
    } catch (error) {
      console.error('Error initializing daily quests:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuestProgress = async (questType: keyof typeof QUEST_TEMPLATES, increment = 1) => {
    if (!profile?.id) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const quest = quests.find((q) => q.quest_type === questType && q.date === today);

      if (!quest || quest.completed) return;

      const newProgress = Math.min(quest.progress + increment, quest.target);
      const completed = newProgress >= quest.target;

      const { data, error } = await supabase
        .from('daily_quests')
        .update({
          progress: newProgress,
          completed,
        })
        .eq('id', quest.id)
        .select()
        .single();

      if (error) throw error;

      setQuests((prev) => prev.map((q) => (q.id === quest.id ? (data as DailyQuest) : q)));

      if (completed && !quest.completed) {
        await addXP(quest.xp_reward);
        toast.success(`🎯 Quest Completed! +${quest.xp_reward} XP`);

        // Create notification
        await supabase.from('notifications').insert({
          user_id: profile.id,
          type: 'achievement',
          title: '🎯 Quest Completed!',
          message: `You completed the ${questType} quest and earned ${quest.xp_reward} XP!`,
          data: { quest_type: questType, xp_reward: quest.xp_reward },
        });
      }
    } catch (error) {
      console.error('Error updating quest progress:', error);
    }
  };

  return {
    quests,
    loading,
    updateQuestProgress,
    refetch: initializeDailyQuests,
  };
};
