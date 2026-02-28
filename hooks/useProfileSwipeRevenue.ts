import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TokenStats {
  token_symbol: string;
  logo_url: string | null;
  count: number;
  usd: number;
}

interface SwipeRevenueStats {
  gift: { count: number; usd: number; topToken: TokenStats | null };
  burn: { count: number; usd: number; topToken: TokenStats | null };
  team: { count: number; usd: number; topToken: TokenStats | null };
  total: { count: number; usd: number };
}

const SWIPE_USD_VALUE = 0.10;

export const useProfileSwipeRevenue = (profileId: string) => {
  const [stats, setStats] = useState<SwipeRevenueStats>({
    gift: { count: 0, usd: 0, topToken: null },
    burn: { count: 0, usd: 0, topToken: null },
    team: { count: 0, usd: 0, topToken: null },
    total: { count: 0, usd: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!profileId) return;

      try {
        // Fetch all right swipes for this profile with token info
        const { data: swipes, error } = await supabase
          .from('swipes')
          .select(`
            id,
            payment_destination,
            payment_token_id,
            custom_payment_tokens (
              token_symbol,
              logo_url
            )
          `)
          .eq('swiped_id', profileId)
          .eq('direction', 'right');

        if (error) {
          console.error('Error fetching swipe revenue:', error);
          return;
        }

        // Initialize counters
        const giftTokens: Record<string, TokenStats> = {};
        const burnTokens: Record<string, TokenStats> = {};
        const teamTokens: Record<string, TokenStats> = {};

        let giftCount = 0, burnCount = 0, teamCount = 0;

        swipes?.forEach((swipe: any) => {
          const destination = swipe.payment_destination || 'gift'; // Default to gift
          const tokenSymbol = swipe.custom_payment_tokens?.token_symbol || 'AVLO';
          const logoUrl = swipe.custom_payment_tokens?.logo_url || null;

          const tokenKey = tokenSymbol;

          if (destination === 'gift') {
            giftCount++;
            if (!giftTokens[tokenKey]) {
              giftTokens[tokenKey] = { token_symbol: tokenSymbol, logo_url: logoUrl, count: 0, usd: 0 };
            }
            giftTokens[tokenKey].count++;
            giftTokens[tokenKey].usd += SWIPE_USD_VALUE;
          } else if (destination === 'burn') {
            burnCount++;
            if (!burnTokens[tokenKey]) {
              burnTokens[tokenKey] = { token_symbol: tokenSymbol, logo_url: logoUrl, count: 0, usd: 0 };
            }
            burnTokens[tokenKey].count++;
            burnTokens[tokenKey].usd += SWIPE_USD_VALUE;
          } else if (destination === 'team') {
            teamCount++;
            if (!teamTokens[tokenKey]) {
              teamTokens[tokenKey] = { token_symbol: tokenSymbol, logo_url: logoUrl, count: 0, usd: 0 };
            }
            teamTokens[tokenKey].count++;
            teamTokens[tokenKey].usd += SWIPE_USD_VALUE;
          }
        });

        // Get top token for each category
        const getTopToken = (tokens: Record<string, TokenStats>): TokenStats | null => {
          const sorted = Object.values(tokens).sort((a, b) => b.count - a.count);
          return sorted[0] || null;
        };

        setStats({
          gift: { 
            count: giftCount, 
            usd: giftCount * SWIPE_USD_VALUE, 
            topToken: getTopToken(giftTokens) 
          },
          burn: { 
            count: burnCount, 
            usd: burnCount * SWIPE_USD_VALUE, 
            topToken: getTopToken(burnTokens) 
          },
          team: { 
            count: teamCount, 
            usd: teamCount * SWIPE_USD_VALUE, 
            topToken: getTopToken(teamTokens) 
          },
          total: { 
            count: giftCount + burnCount + teamCount, 
            usd: (giftCount + burnCount + teamCount) * SWIPE_USD_VALUE 
          },
        });
      } catch (err) {
        console.error('Error in useProfileSwipeRevenue:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [profileId]);

  return { stats, isLoading };
};
