import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useChatCost() {
  const [cost, setCost] = useState(10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCost();
  }, []);

  const fetchCost = async () => {
    try {
      const { data, error } = await supabase
        .from('game_config')
        .select('config_value')
        .eq('config_key', 'chat_message_cost')
        .single();

      if (error) throw error;

      if (data?.config_value) {
        setCost(Number(data.config_value));
      }
    } catch (error) {
      console.error('Error fetching chat cost:', error);
    } finally {
      setLoading(false);
    }
  };

  return { cost, loading };
}
