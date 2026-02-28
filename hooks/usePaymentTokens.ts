import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PaymentToken {
  id: string;
  token_address: string;
  token_name: string;
  token_symbol: string;
  logo_url: string | null;
  swipe_price: number;
  post_price: number;
  comment_price: number;
  payment_address: string;
  decimals: number;
  is_active: boolean;
  is_verified?: boolean; // For user-submitted tokens
}

const FAVORITE_TOKEN_KEY = 'avalove_favorite_payment_token';
const MULTIPLIER_KEY = 'avalove_payment_multiplier';

export function usePaymentTokens() {
  const [tokens, setTokens] = useState<PaymentToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState<PaymentToken | null>(null);
  const [multiplier, setMultiplier] = useState<number>(() => {
    const saved = localStorage.getItem(MULTIPLIER_KEY);
    return saved ? parseInt(saved, 10) : 1;
  });
  const [favoriteTokenId, setFavoriteTokenId] = useState<string | null>(() => {
    return localStorage.getItem(FAVORITE_TOKEN_KEY);
  });

  // Cache tokens for 10 minutes to reduce DB reads (custom_payment_tokens had 67K scans)
  const tokensCacheRef = useRef<{ data: PaymentToken[]; ts: number } | null>(null);
  
  useEffect(() => {
    const cached = tokensCacheRef.current;
    if (cached && Date.now() - cached.ts < 600000) {
      setTokens(cached.data);
      setLoading(false);
      return;
    }
    fetchTokens();
  }, []);

  // Restore favorite token after tokens are loaded
  useEffect(() => {
    if (tokens.length > 0 && favoriteTokenId) {
      const favoriteToken = tokens.find(t => t.id === favoriteTokenId);
      if (favoriteToken && !selectedToken) {
        setSelectedToken(favoriteToken);
      }
    }
  }, [tokens, favoriteTokenId]);

  const fetchTokens = async () => {
    try {
      // Fetch admin-added tokens
      const { data: adminTokens, error: adminError } = await supabase
        .from('custom_payment_tokens')
        .select('*')
        .eq('is_active', true)
        .order('token_name', { ascending: true });

      if (adminError) throw adminError;

      // Fetch user-submitted tokens
      const { data: userTokens, error: userError } = await supabase
        .from('user_token_submissions')
        .select('*')
        .eq('is_active', true);

      if (userError) throw userError;

      // Convert user tokens to PaymentToken format
      const userPaymentTokens: PaymentToken[] = (userTokens || []).map(t => ({
        id: t.id,
        token_address: t.token_address,
        token_name: t.token_name,
        token_symbol: t.token_symbol,
        logo_url: t.logo_url,
        swipe_price: t.swipe_price,
        post_price: t.swipe_price, // Use swipe_price for all
        comment_price: t.swipe_price,
        payment_address: t.payment_address,
        decimals: t.decimals,
        is_active: t.is_active,
        is_verified: t.is_verified // Extra field for badge
      }));

      // Merge and dedupe by address (case-insensitive)
      const addressMap = new Map<string, PaymentToken>();
      
      // Process admin tokens first
      (adminTokens || []).forEach(t => {
        const addr = (t.token_address || '').trim().toLowerCase();
        // Skip invalid addresses
        if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return;
        
        const token: PaymentToken = {
          ...t as PaymentToken,
          token_address: addr, // Normalize to lowercase
          is_verified: (t as any).is_verified ?? true
        };
        addressMap.set(addr, token);
      });
      
      // Then add user tokens (skip if address already exists)
      userPaymentTokens.forEach(t => {
        const addr = (t.token_address || '').trim().toLowerCase();
        // Skip invalid addresses
        if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return;
        
        if (!addressMap.has(addr)) {
          addressMap.set(addr, { ...t, token_address: addr });
        }
      });

      const sorted = Array.from(addressMap.values()).sort((a, b) => a.token_name.localeCompare(b.token_name));
      tokensCacheRef.current = { data: sorted, ts: Date.now() };
      setTokens(sorted);
    } catch (error) {
      console.error('Error fetching payment tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectToken = (token: PaymentToken | null, newMultiplier?: number) => {
    setSelectedToken(token);
    
    // Update multiplier if provided
    if (newMultiplier !== undefined) {
      setMultiplier(newMultiplier);
      localStorage.setItem(MULTIPLIER_KEY, newMultiplier.toString());
    }
    
    // Save as favorite
    if (token) {
      localStorage.setItem(FAVORITE_TOKEN_KEY, token.id);
      setFavoriteTokenId(token.id);
    } else {
      localStorage.removeItem(FAVORITE_TOKEN_KEY);
      setFavoriteTokenId(null);
    }
  };

  const updateMultiplier = (newMultiplier: number) => {
    setMultiplier(newMultiplier);
    localStorage.setItem(MULTIPLIER_KEY, newMultiplier.toString());
  };

  // Check if using custom token (not AVLO burn)
  const isCustomPayment = selectedToken !== null;

  // Get price for specific action (with multiplier applied)
  const getPrice = (action: 'swipe' | 'post' | 'comment'): number => {
    if (!selectedToken) return 0;
    let basePrice = 0;
    switch (action) {
      case 'swipe': basePrice = selectedToken.swipe_price; break;
      case 'post': basePrice = selectedToken.post_price; break;
      case 'comment': basePrice = selectedToken.comment_price; break;
      default: basePrice = 0;
    }
    return basePrice * multiplier;
  };

  // Get base price without multiplier
  const getBasePrice = (action: 'swipe' | 'post' | 'comment'): number => {
    if (!selectedToken) return 0;
    switch (action) {
      case 'swipe': return selectedToken.swipe_price;
      case 'post': return selectedToken.post_price;
      case 'comment': return selectedToken.comment_price;
      default: return 0;
    }
  };

  return {
    tokens,
    loading,
    selectedToken,
    selectToken,
    isCustomPayment,
    getPrice,
    getBasePrice,
    multiplier,
    updateMultiplier,
    favoriteTokenId,
    refetch: fetchTokens,
  };
}
