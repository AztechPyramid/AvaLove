import { useState, useEffect, useCallback, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WalletAuthContext } from '@/contexts/WalletAuthContext';
import { getAvloTokenId } from '@/lib/avloTokenCache';

interface TimeScoreData {
  totalScore: number;
  initialScore: number;
  earnedScore: number;
  decayedScore: number;
  lastActiveAt: string | null;
  timeRemainingMinutes: number;
}

interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  arena_verified: boolean;
  total_score: number;
  earned_score: number;
  initial_score: number;
  active_time_minutes: number;
  time_lost_minutes: number;
}

const DEFAULT_DATA: TimeScoreData = {
  totalScore: 10,
  initialScore: 10,
  earnedScore: 0,
  decayedScore: 0,
  lastActiveAt: null,
  timeRemainingMinutes: 10,
};

export function useTimeScore() {
  const walletAuth = useContext(WalletAuthContext);
  const profile = walletAuth?.profile;
  const profileLoading = walletAuth?.loading ?? true;

  const [data, setData] = useState<TimeScoreData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [avloTokenId, setAvloTokenId] = useState<string | null>(null);

  const fetchAvloToken = useCallback(async () => {
    try {
      // 1) If the user already has a score row, use that token_id (most accurate)
      if (profile?.id) {
        const { data: existing } = await supabase
          .from('user_scores')
          .select('token_id, total_score, updated_at, dao_tokens!inner(token_symbol)')
          .eq('user_id', profile.id)
          .eq('dao_tokens.token_symbol', 'AVLO')
          .order('total_score', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing?.token_id) {
          setAvloTokenId(existing.token_id);
          return existing.token_id;
        }
      }

      // 2) Fallback: use cached AVLO token ID
      const tokenId = await getAvloTokenId();
      setAvloTokenId(tokenId);
      return tokenId;
    } catch (err) {
      console.error('[TIME SCORE] Exception fetching AVLO token:', err);
      return null;
    }
  }, [profile?.id]);

  const fetchTimeScore = useCallback(async () => {
    // IMPORTANT: The Time Matrix must use the canonical persisted values (incl. decayed_score + manual_bonus)
    // from `user_scores`, to match Airdrop/Leaderboard and avoid 0/incorrect breakdowns.
    if (!profile?.id || !avloTokenId) return;

    try {
      const { data: row, error } = await supabase
        .from('user_scores')
        .select('total_score, initial_score, earned_score, decayed_score, manual_bonus, updated_at')
        .eq('user_id', profile.id)
        .eq('token_id', avloTokenId)
        .order('total_score', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[TIME SCORE] user_scores fetch error:', error);
        throw error;
      }

      if (!row) {
        setData(DEFAULT_DATA);
        return;
      }

      const total = Number((row as any).total_score ?? 10);
      const initial = Number((row as any).initial_score ?? 10);
      const earned = Number((row as any).earned_score ?? 0) + Number((row as any).manual_bonus ?? 0);
      const decayed = Number((row as any).decayed_score ?? 0);

      setData({
        totalScore: total,
        initialScore: initial,
        earnedScore: earned,
        decayedScore: decayed,
        lastActiveAt: ((row as any).updated_at as string | null) ?? null,
        timeRemainingMinutes: total,
      });
    } catch (error) {
      console.error('[TIME SCORE] Error fetching user_scores:', error);
      setData(DEFAULT_DATA);
    }
  }, [profile?.id, avloTokenId]);

  const fetchLeaderboard = useCallback(async () => {
    if (!avloTokenId) return;

    try {
      // Fetch directly from user_scores with profiles join for accurate data
      const { data: leaderboardData, error } = await supabase
        .from('user_scores')
        .select(`
          user_id,
          total_score,
          initial_score,
          earned_score,
          decayed_score,
          manual_bonus,
          profiles!inner(username, avatar_url, arena_verified)
        `)
        .eq('token_id', avloTokenId)
        .order('total_score', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Transform to expected format
      const transformed: LeaderboardEntry[] = (leaderboardData || []).map((entry: any) => ({
        user_id: entry.user_id,
        username: entry.profiles?.username || 'Anonymous',
        avatar_url: entry.profiles?.avatar_url || null,
        arena_verified: entry.profiles?.arena_verified || false,
        total_score: entry.total_score || 0,
        earned_score: (entry.earned_score || 0) + (entry.manual_bonus || 0),
        initial_score: entry.initial_score || 10,
        active_time_minutes: entry.total_score || 0,
        time_lost_minutes: entry.decayed_score || 0,
      }));

      setLeaderboard(transformed);
    } catch (error) {
      console.error('[TIME SCORE] Error fetching leaderboard:', error);
    }
  }, [avloTokenId]);

  // Simplified - just refetch time score, no activity tracking needed
  const refreshScore = useCallback(async () => {
    await fetchTimeScore();
  }, [fetchTimeScore]);

  // Resolve AVLO token for current user/session
  useEffect(() => {
    fetchAvloToken();
  }, [fetchAvloToken]);

  // When auth/token state changes, fetch fresh data
  useEffect(() => {
    if (profileLoading) return;

    setLoading(true);

    if (!avloTokenId) {
      setData(DEFAULT_DATA);
      setLoading(false);
      return;
    }

    if (!profile?.id) {
      setData(DEFAULT_DATA);
      setLoading(false);
      fetchLeaderboard();
      return;
    }

    (async () => {
      await fetchTimeScore();
      await fetchLeaderboard();
      setLoading(false);
    })();
  }, [profileLoading, profile?.id, avloTokenId, fetchTimeScore, fetchLeaderboard]);

  // Poll for server-side score updates every 60s
  useEffect(() => {
    if (!profile?.id || !avloTokenId) return;
    const interval = setInterval(fetchTimeScore, 60000);
    return () => clearInterval(interval);
  }, [profile?.id, avloTokenId, fetchTimeScore]);

  // Purchase score with AVLO
  const purchaseScore = useCallback(
    async (avloAmount: number, txHash?: string) => {
      if (!profile?.id || !avloTokenId) {
        return { success: false, message: 'Not authenticated' };
      }

      try {
        const { data: result, error } = await supabase.rpc('purchase_score', {
          p_user_id: profile.id,
          p_token_id: avloTokenId,
          p_avlo_amount: avloAmount,
          p_tx_hash: txHash || null,
        });

        if (error) throw error;

        await fetchTimeScore();
        return result;
      } catch (error: any) {
        console.error('[TIME SCORE] Purchase error:', error);
        return { success: false, message: error.message };
      }
    },
    [profile?.id, avloTokenId, fetchTimeScore],
  );

  // Initialize data if still null
  useEffect(() => {
    if (!data && !loading && profileLoading === false) {
      setData(DEFAULT_DATA);
    }
  }, [data, loading, profileLoading]);

  return {
    data,
    leaderboard,
    loading,
    purchaseScore,
    refetch: async () => {
      setLoading(true);
      await fetchTimeScore();
      setLoading(false);
    },
    refetchLeaderboard: fetchLeaderboard,
  };
}
