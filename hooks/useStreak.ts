import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';

interface UserStreak {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_login_date: string | null;
}

export const useStreak = () => {
  const { profile } = useWalletAuth();
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;

    fetchAndUpdateStreak();
  }, [profile?.id]);

  const fetchAndUpdateStreak = async () => {
    if (!profile?.id) return;

    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!data) {
        // Create new streak
        const { data: newStreak, error: insertError } = await supabase
          .from('user_streaks')
          .insert({
            user_id: profile.id,
            current_streak: 1,
            longest_streak: 1,
            last_login_date: today,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setStreak(newStreak);
      } else {
        // Update streak
        const lastLogin = data.last_login_date;
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        let newCurrentStreak = data.current_streak;
        
        if (lastLogin !== today) {
          if (lastLogin === yesterday) {
            // Continue streak
            newCurrentStreak = data.current_streak + 1;
          } else if (lastLogin && lastLogin < yesterday) {
            // Streak broken
            newCurrentStreak = 1;
          }

          const newLongestStreak = Math.max(data.longest_streak, newCurrentStreak);

          const { data: updatedStreak, error: updateError } = await supabase
            .from('user_streaks')
            .update({
              current_streak: newCurrentStreak,
              longest_streak: newLongestStreak,
              last_login_date: today,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', profile.id)
            .select()
            .single();

          if (updateError) throw updateError;
          setStreak(updatedStreak);
        } else {
          setStreak(data);
        }
      }
    } catch (error) {
      console.error('Error fetching/updating streak:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    streak,
    loading,
    refetch: fetchAndUpdateStreak,
  };
};
