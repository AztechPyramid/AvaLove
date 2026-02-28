import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Session-level cache for score points config (rarely changes)
let cachedScorePoints: ScorePoints | null = null;
let scorePointsFetched = false;

interface ScorePoints {
  swipe: number;
  match: number;
  initial_bonus: number;
  message?: number;
  stake?: number;
  text_post?: number;
  image_post?: number;
  video_post?: number;
  gif_post?: number;
  comment?: number;
  qualified_referral?: number;
  streak?: number;
}

const DEFAULT_POINTS: ScorePoints = {
  swipe: 10,
  match: 10,
  initial_bonus: 1,
};

export function useScorePoints() {
  const [points, setPoints] = useState<ScorePoints>(cachedScorePoints || DEFAULT_POINTS);
  const [loading, setLoading] = useState(!scorePointsFetched);

  useEffect(() => {
    // Use session cache - config rarely changes, no need for realtime
    if (scorePointsFetched && cachedScorePoints) {
      setPoints(cachedScorePoints);
      setLoading(false);
      return;
    }

    fetchPoints();
  }, []);

  const fetchPoints = async () => {
    try {
      const { data, error } = await supabase
        .from('game_config')
        .select('config_value')
        .eq('config_key', 'score_points')
        .single();

      if (error) throw error;

      if (data?.config_value) {
        const parsed = data.config_value as unknown as ScorePoints;
        cachedScorePoints = parsed;
        scorePointsFetched = true;
        setPoints(parsed);
      } else {
        scorePointsFetched = true;
      }
    } catch (error) {
      console.error('[SCORE POINTS] Error fetching config:', error);
      scorePointsFetched = true;
    } finally {
      setLoading(false);
    }
  };

  return { points, loading };
}
