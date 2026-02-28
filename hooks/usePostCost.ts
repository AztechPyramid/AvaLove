import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PostCosts {
  text: number;
  image: number;
  video: number;
  gif: number;
  comment: number;
}

export function usePostCost() {
  const [costs, setCosts] = useState<PostCosts>({ text: 500, image: 1000, video: 100000, gif: 3000, comment: 100 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCosts();
  }, []);

  const fetchCosts = async () => {
    try {
      const { data, error } = await supabase
        .from('game_config')
        .select('config_value')
        .eq('config_key', 'post_costs')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.config_value) {
        const value = data.config_value as Record<string, number>;
        setCosts({
          text: value.text ?? 500,
          image: value.image ?? 1000,
          video: value.video ?? 100000,
          gif: value.gif ?? 3000,
          comment: value.comment ?? 100,
        });
      }
    } catch (error) {
      console.error('Error fetching post costs:', error);
    } finally {
      setLoading(false);
    }
  };

  return { costs, loading };
}
