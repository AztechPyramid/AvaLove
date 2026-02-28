import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWalletAuth } from "@/contexts/WalletAuthContext";
import { toast } from "sonner";

export interface FavoriteGame {
  id: string;
  user_id: string;
  game_id: string;
  game_type: 'online' | 'mobile';
  created_at: string;
}

export function useFavoriteGames() {
  const { profile } = useWalletAuth();
  const [favorites, setFavorites] = useState<FavoriteGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchFavorites();
    } else {
      setFavorites([]);
      setLoading(false);
    }
  }, [profile?.id]);

  const fetchFavorites = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('user_favorite_games')
        .select('*')
        .eq('user_id', profile.id);

      if (error) throw error;
      setFavorites((data || []) as FavoriteGame[]);
    } catch (error) {
      console.error("Error fetching favorites:", error);
    } finally {
      setLoading(false);
    }
  };

  const isFavorite = (gameId: string, gameType: 'online' | 'mobile'): boolean => {
    return favorites.some(
      (fav) => fav.game_id === gameId && fav.game_type === gameType
    );
  };

  const addFavorite = async (gameId: string, gameType: 'online' | 'mobile') => {
    if (!profile?.id) {
      toast.error("Favori eklemek için giriş yapmalısınız");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_favorite_games')
        .insert({
          user_id: profile.id,
          game_id: gameId,
          game_type: gameType
        })
        .select()
        .single();

      if (error) throw error;
      
      setFavorites([...favorites, data as FavoriteGame]);
      toast.success("Favorilere eklendi!");
    } catch (error: any) {
      console.error("Error adding favorite:", error);
      if (error.code === '23505') {
        toast.error("Bu oyun zaten favorilerde");
      } else {
        toast.error("Favorilere eklenemedi");
      }
    }
  };

  const removeFavorite = async (gameId: string, gameType: 'online' | 'mobile') => {
    if (!profile?.id) return;

    try {
      const { error } = await supabase
        .from('user_favorite_games')
        .delete()
        .eq('user_id', profile.id)
        .eq('game_id', gameId)
        .eq('game_type', gameType);

      if (error) throw error;

      setFavorites(favorites.filter(
        (fav) => !(fav.game_id === gameId && fav.game_type === gameType)
      ));
      toast.success("Favorilerden çıkarıldı");
    } catch (error) {
      console.error("Error removing favorite:", error);
      toast.error("Favorilerden çıkarılamadı");
    }
  };

  const toggleFavorite = async (gameId: string, gameType: 'online' | 'mobile') => {
    if (isFavorite(gameId, gameType)) {
      await removeFavorite(gameId, gameType);
    } else {
      await addFavorite(gameId, gameType);
    }
  };

  return {
    favorites,
    loading,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    refetch: fetchFavorites
  };
}
