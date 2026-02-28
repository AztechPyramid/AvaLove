import { supabase } from '@/integrations/supabase/client';

// Cached AVLO token ID lookup - dao_tokens table is queried 50K+ times for the same value
let cachedAvloTokenId: string | null = null;
let avloTokenFetched = false;

export const getAvloTokenId = async (): Promise<string | null> => {
  if (avloTokenFetched) return cachedAvloTokenId;

  try {
    const { data } = await supabase
      .from('dao_tokens')
      .select('id')
      .eq('token_address', '0xb5B3e63540fD53DCFFD4e65c726a84aA67B24E61')
      .maybeSingle();

    cachedAvloTokenId = data?.id || null;
    avloTokenFetched = true;
    return cachedAvloTokenId;
  } catch (error) {
    console.error('[AVLO Token] Error fetching token ID:', error);
    avloTokenFetched = true;
    return null;
  }
};

// Reset cache if needed (e.g., on logout)
export const resetAvloTokenCache = () => {
  cachedAvloTokenId = null;
  avloTokenFetched = false;
};