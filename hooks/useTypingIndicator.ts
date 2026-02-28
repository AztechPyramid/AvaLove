import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useTypingIndicator = (matchId: string | undefined, userId: string | undefined) => {
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingUpdateRef = useRef<number>(0);

  // Subscribe to typing indicators
  useEffect(() => {
    if (!matchId || !userId) return;

    const channel = supabase
      .channel(`typing:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `match_id=eq.${matchId}`,
        },
        (payload: any) => {
          const indicator = payload.new;
          if (indicator && indicator.user_id !== userId) {
            setIsOtherUserTyping(indicator.is_typing || false);
            
            // Auto-clear typing after 5 seconds
            if (indicator.is_typing) {
              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
              }
              typingTimeoutRef.current = setTimeout(() => {
                setIsOtherUserTyping(false);
              }, 5000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [matchId, userId]);

  // Update typing status (debounced)
  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!matchId || !userId) return;
    
    const now = Date.now();
    // Throttle updates to every 2 seconds
    if (isTyping && now - lastTypingUpdateRef.current < 2000) return;
    lastTypingUpdateRef.current = now;

    try {
      await supabase
        .from('typing_indicators')
        .upsert({
          match_id: matchId,
          user_id: userId,
          is_typing: isTyping,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'match_id,user_id'
        });
    } catch (error) {
      // Silently fail - typing indicators are non-critical
      console.debug('Typing indicator update failed:', error);
    }
  }, [matchId, userId]);

  // Clear typing on unmount
  useEffect(() => {
    return () => {
      if (matchId && userId) {
        supabase
          .from('typing_indicators')
          .upsert({
            match_id: matchId,
            user_id: userId,
            is_typing: false,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'match_id,user_id'
          });
      }
    };
  }, [matchId, userId]);

  return {
    isOtherUserTyping,
    setTyping
  };
};
