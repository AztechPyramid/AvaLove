import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GenerousBurnerBadgeProps {
  userId: string;
  size?: 'sm' | 'md';
}

export const GenerousBurnerBadge = ({ userId, size = 'sm' }: GenerousBurnerBadgeProps) => {
  const [hasGenerousBadge, setHasGenerousBadge] = useState(false);

  useEffect(() => {
    checkGenerousBadge();
  }, [userId]);

  const checkGenerousBadge = async () => {
    try {
      // Get the Generous Burner badge ID
      const { data: badge } = await supabase
        .from('badges')
        .select('id')
        .eq('name', 'Generous Burner')
        .single();

      if (!badge) return;

      // Check if user has this badge
      const { data: userBadge } = await supabase
        .from('user_badges')
        .select('id')
        .eq('user_id', userId)
        .eq('badge_id', badge.id)
        .single();

      setHasGenerousBadge(!!userBadge);
    } catch (error) {
      console.error('Error checking generous badge:', error);
    }
  };

  if (!hasGenerousBadge) return null;

  const sizeClass = size === 'sm' ? 'text-base' : 'text-lg';

  return (
    <span 
      className={`${sizeClass}`}
      title="Generous Burner - Can send AVLO tips with likes"
    >
      💎
    </span>
  );
};
