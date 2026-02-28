import { useState, useCallback } from 'react';

const BOT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/love-bot`;

export interface UserInfo {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface MatchData {
  user1: UserInfo;
  user2: UserInfo;
  created_at: string;
}

export interface PostData {
  id: string;
  content: string;
  likes_count: number;
  author: UserInfo;
  created_at: string;
}

export interface GameData {
  player: UserInfo;
  game_title: string;
  play_time_seconds: number;
}

export interface LeaderboardData {
  player: UserInfo;
  rank: number;
  play_time_minutes: number;
}

export interface LoveAIResponse {
  response: string;
  matches?: MatchData[];
  users?: UserInfo[];
  posts?: PostData[];
  games?: GameData[];
  leaderboard?: LeaderboardData[];
}

export function useLoveAI() {
  const [isLoading, setIsLoading] = useState(false);

  const askLove = useCallback(async (message: string): Promise<string> => {
    setIsLoading(true);
    
    try {
      const response = await fetch(BOT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        return "Bir sorun oluştu, tekrar dener misin? 💜";
      }

      const data = await response.json();
      return data.response || "Hmm, bir şeyler ters gitti! 💜";
    } catch (error) {
      console.error("Love bot error:", error);
      return "Bağlantı sorunu var, tekrar dene! 💜";
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Full response with structured data
  const askLoveFull = useCallback(async (message: string): Promise<LoveAIResponse> => {
    setIsLoading(true);
    
    try {
      const response = await fetch(BOT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        return { response: "Bir sorun oluştu, tekrar dener misin? 💜" };
      }

      const data = await response.json();
      return {
        response: data.response || "Hmm, bir şeyler ters gitti! 💜",
        matches: data.matches || [],
        users: data.users || [],
        posts: data.posts || [],
        games: data.games || [],
        leaderboard: data.leaderboard || [],
      };
    } catch (error) {
      console.error("Love bot error:", error);
      return { response: "Bağlantı sorunu var, tekrar dene! 💜" };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { askLove, askLoveFull, isLoading };
}