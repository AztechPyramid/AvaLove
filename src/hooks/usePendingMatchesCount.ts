import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';

export const usePendingMatchesCount = () => {
  const { profile } = useWalletAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);

  const fetchCounts = async () => {
    if (!profile?.id) return;

    try {
      // Get matched user IDs first
      const { data: matches } = await supabase
        .from('matches')
        .select('user1_id, user2_id')
        .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`);

      const matchedUserIds = new Set<string>();
      matches?.forEach(m => {
        if (m.user1_id === profile.id) matchedUserIds.add(m.user2_id);
        else matchedUserIds.add(m.user1_id);
      });

      // Count received likes (not matched yet)
      const { data: receivedData } = await supabase
        .from('swipes')
        .select('swiper_id')
        .eq('swiped_id', profile.id)
        .eq('direction', 'right');

      const receivedCount = (receivedData || []).filter(s => !matchedUserIds.has(s.swiper_id)).length;

      // Count sent likes (not matched yet)
      const { data: sentData } = await supabase
        .from('swipes')
        .select('swiped_id')
        .eq('swiper_id', profile.id)
        .eq('direction', 'right');

      const sentCount = (sentData || []).filter(s => !matchedUserIds.has(s.swiped_id)).length;

      setPendingCount(receivedCount + sentCount);

      // Count rejected matches
      const { count: rejCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('type', 'match_cancelled');

      setRejectedCount(rejCount || 0);
    } catch (error) {
      console.error('Error fetching pending matches count:', error);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, [profile?.id]);

  // Realtime updates
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('pending-count-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'swipes', filter: `swiped_id=eq.${profile.id}` },
        () => fetchCounts()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'matches' },
        () => fetchCounts()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => fetchCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  return { pendingCount, rejectedCount, totalCount: pendingCount + rejectedCount, refetch: fetchCounts };
};
