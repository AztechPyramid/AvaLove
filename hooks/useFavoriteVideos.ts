import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { toast } from 'sonner';

export function useFavoriteVideos() {
  const { profile } = useWalletAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchFavorites();
    }
  }, [profile?.id]);

  const fetchFavorites = async () => {
    if (!profile?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('favorite_videos')
        .select('video_id')
        .eq('user_id', profile.id);

      if (error) throw error;
      
      setFavorites(data.map(fav => fav.video_id));
    } catch (error) {
      console.error('Error fetching favorite videos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isFavorite = (videoId: string) => {
    return favorites.includes(videoId);
  };

  const toggleFavorite = async (videoId: string) => {
    if (!profile?.id) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      if (isFavorite(videoId)) {
        // Remove from favorites
        const { error } = await supabase
          .from('favorite_videos')
          .delete()
          .eq('user_id', profile.id)
          .eq('video_id', videoId);

        if (error) throw error;

        setFavorites(prev => prev.filter(id => id !== videoId));
        toast.success('Removed from favorites');
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('favorite_videos')
          .insert({
            user_id: profile.id,
            video_id: videoId
          });

        if (error) throw error;

        setFavorites(prev => [...prev, videoId]);
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorites');
    }
  };

  return {
    favorites,
    isLoading,
    isFavorite,
    toggleFavorite,
    refetch: fetchFavorites
  };
}
