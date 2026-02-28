import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  reaction: string;
  created_at: string;
}

export const useMessageReactions = (matchId: string | undefined) => {
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});

  // Fetch initial reactions
  useEffect(() => {
    if (!matchId) return;

    const fetchReactions = async () => {
      const { data: messages } = await supabase
        .from('messages')
        .select('id')
        .eq('match_id', matchId);

      if (messages && messages.length > 0) {
        const messageIds = messages.map(m => m.id);
        const { data: reactionsData } = await supabase
          .from('message_reactions')
          .select('*')
          .in('message_id', messageIds);

        if (reactionsData) {
          const grouped = reactionsData.reduce((acc, r) => {
            if (!acc[r.message_id]) acc[r.message_id] = [];
            acc[r.message_id].push(r);
            return acc;
          }, {} as Record<string, Reaction[]>);
          setReactions(grouped);
        }
      }
    };

    fetchReactions();
  }, [matchId]);

  // Subscribe to reaction changes - filter by message IDs in this match
  useEffect(() => {
    if (!matchId) return;

    // Get message IDs for this match to filter reactions properly
    const setupChannel = async () => {
      const { data: messages } = await supabase
        .from('messages')
        .select('id')
        .eq('match_id', matchId);
      
      const messageIds = messages?.map(m => m.id) || [];
      if (messageIds.length === 0) return;

      const channel = supabase
        .channel(`reactions:${matchId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'message_reactions',
          },
          (payload: any) => {
            const newReaction = payload.new as Reaction;
            // Only add if it belongs to this match's messages
            if (messageIds.includes(newReaction.message_id)) {
              setReactions(prev => ({
                ...prev,
                [newReaction.message_id]: [...(prev[newReaction.message_id] || []), newReaction]
              }));
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'message_reactions',
          },
          (payload: any) => {
            const deletedReaction = payload.old as Reaction;
            setReactions(prev => ({
              ...prev,
              [deletedReaction.message_id]: (prev[deletedReaction.message_id] || []).filter(
                r => r.id !== deletedReaction.id
              )
            }));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setupChannel();
    return () => {
      cleanup.then(fn => fn?.());
    };
  }, [matchId]);

  const addReaction = useCallback(async (messageId: string, userId: string, reaction: string) => {
    try {
      const { error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: userId,
          reaction
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  }, []);

  const removeReaction = useCallback(async (messageId: string, userId: string, reaction: string) => {
    try {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('reaction', reaction);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    }
  }, []);

  const toggleReaction = useCallback(async (messageId: string, userId: string, reaction: string) => {
    const messageReactions = reactions[messageId] || [];
    const existingReaction = messageReactions.find(
      r => r.user_id === userId && r.reaction === reaction
    );

    if (existingReaction) {
      await removeReaction(messageId, userId, reaction);
    } else {
      await addReaction(messageId, userId, reaction);
    }
  }, [reactions, addReaction, removeReaction]);

  return {
    reactions,
    toggleReaction,
    addReaction,
    removeReaction
  };
};
