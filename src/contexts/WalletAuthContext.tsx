import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWeb3Auth } from '@/hooks/useWeb3Auth';
import { useWalletVerification } from '@/hooks/useWalletVerification';

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  photo_urls: string[] | null;
  bio: string | null;
  wallet_address: string;
  date_of_birth: string | null;
  gender: string | null;
  looking_for: string[] | null;
  latitude: number | null;
  longitude: number | null;
  location: string | null;
  interests: string[] | null;
  max_distance_km: number | null;
  created_at: string;
  updated_at: string;
  last_active: string | null;
  special_badge: boolean | null;
  arena_verified: boolean | null;
}

interface WalletAuthContextType {
  walletAddress: string | null;
  profile: Profile | null;
  loading: boolean;
  isConnected: boolean;
  isVerified: boolean;
  isArena: boolean;
  connectWallet: () => void;
  disconnectWallet: () => void;
  refreshProfile: () => Promise<void>;
  verifyWallet: () => Promise<void>;
}

export const WalletAuthContext = createContext<WalletAuthContextType | undefined>(undefined);

export const WalletAuthProvider = ({ children }: { children: ReactNode }) => {
  const { walletAddress, isConnected, connectWallet: connectWeb3, disconnectWallet: disconnectWeb3, signMessage, arenaSDK, isArena } = useWeb3Auth();
  const { isVerified, generateNonce, verifySignature } = useWalletVerification();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Prevent duplicate decay application (Connect page polls refreshProfile frequently).
  // Keyed by wallet + verification sessionId (or 'unverified' before signature verification).
  const decayAttemptedRef = useRef<Set<string>>(new Set());
  const decayInFlightRef = useRef<Set<string>>(new Set());

  const maybeApplyPersistentScoreDecay = useCallback(async (wallet: string | null | undefined) => {
    if (!wallet) return;

    const walletLower = wallet.toLowerCase();
    const sessionId = typeof window !== 'undefined'
      ? localStorage.getItem(`wallet_session_${walletLower}`)
      : null;
    const key = `${walletLower}:${sessionId || 'unverified'}`;

    // Avoid spamming the backend.
    if (decayAttemptedRef.current.has(key) || decayInFlightRef.current.has(key)) return;
    decayInFlightRef.current.add(key);

    try {
      const { data, error } = await supabase.functions.invoke('apply-score-decay', {
        body: { walletAddress: walletLower, sessionId },
      });

      if (error) {
        // Non-fatal: user can still use the app; decay just won't persist this run
        console.warn('[SCORE DECAY] apply-score-decay failed:', error);
      } else if (data?.decayApplied > 0 || data?.creditDecayApplied > 0) {
        console.log('[DECAY] Applied:', {
          score: data?.decayApplied,
          credit: data?.creditDecayApplied,
          newScore: data?.newScore,
        });
      }
    } catch (err) {
      console.warn('[SCORE DECAY] apply-score-decay unexpected error:', err);
    } finally {
      decayInFlightRef.current.delete(key);
      decayAttemptedRef.current.add(key);
    }
  }, []);

  // Auto-verify Arena users - fire and forget (non-blocking)
  useEffect(() => {
    if (isArena && walletAddress && !isVerified) {
      console.log('[ARENA AUTH] Auto-verifying Arena wallet:', walletAddress);
      
      // Don't await - let it run in background without blocking profile loading
      Promise.resolve(
        supabase.rpc('create_verified_arena_session', {
          p_wallet_address: walletAddress.toLowerCase()
        })
      ).then(({ error }) => {
        if (error) {
          console.warn('[ARENA AUTH] Auto-verify failed (non-critical):', error.message);
        } else {
          console.log('[ARENA AUTH] Arena wallet auto-verified');
          maybeApplyPersistentScoreDecay(walletAddress);
        }
      }).catch(err => {
        console.warn('[ARENA AUTH] Auto-verify error (non-critical):', err);
      });
    }
  }, [isArena, walletAddress, isVerified]);

  useEffect(() => {
    if (walletAddress && isConnected) {
      loadProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [walletAddress, isConnected]);

  // For non-Arena users, apply offline decay once the wallet is verified.
  // This prevents earn sessions from being decayed due to Connect page polling.
  useEffect(() => {
    if (!walletAddress || !isConnected) return;
    if (isArena) return;
    if (!isVerified) return;

    void maybeApplyPersistentScoreDecay(walletAddress);
  }, [walletAddress, isConnected, isArena, isVerified, maybeApplyPersistentScoreDecay]);

  // Lazy Arena avatar sync - runs after profile is loaded and user has no avatar
  // Uses both SDK (fast) and edge function (reliable fallback)
  useEffect(() => {
    if (!isArena || !profile || profile.avatar_url) return;
    
    const syncTimer = setTimeout(async () => {
      let avatarUrl: string | null = null;

      // Try SDK first (instant if available)
      if (arenaSDK) {
        try {
          const arenaProfile = await arenaSDK.sendRequest('getUserProfile');
          if (arenaProfile?.avatar) {
            avatarUrl = arenaProfile.avatar;
          }
        } catch (err) {
          console.warn('[ARENA AVATAR SYNC] SDK failed, trying edge function:', err);
        }
      }

      // Fallback: use edge function to fetch from Arena API
      if (!avatarUrl) {
        const username = profile.username || (profile as any).arena_username;
        if (username) {
          try {
            const { data } = await supabase.functions.invoke('sync-arena-avatars', {
              body: { action: 'sync_single', username }
            });
            if (data?.success && data?.avatar) {
              avatarUrl = data.avatar;
              // Edge function already updated the DB, just update local state
              setProfile(prev => prev ? { ...prev, avatar_url: avatarUrl } as Profile : null);
              return;
            }
          } catch (err) {
            console.warn('[ARENA AVATAR SYNC] Edge function failed:', err);
          }
        }
      }

      // If SDK gave us an avatar, save it
      if (avatarUrl) {
        try {
          await supabase
            .from('profiles')
            .update({ avatar_url: avatarUrl, arena_verified: true })
            .eq('id', profile.id);
          
          setProfile(prev => prev ? { ...prev, avatar_url: avatarUrl } as Profile : null);
        } catch (err) {
          console.warn('[ARENA AVATAR SYNC] DB update failed:', err);
        }
      }
    }, 3000); // Delay 3s to prioritize initial load
    
    return () => clearTimeout(syncTimer);
  }, [isArena, arenaSDK, profile?.id, profile?.avatar_url]);

  const loadProfile = async () => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const walletLower = walletAddress.toLowerCase();
    const cacheKey = `profile_cache_${walletLower}`;
    
    // INSTANT PATH: Use cached profile from localStorage
    const cachedStr = localStorage.getItem(cacheKey);
    if (cachedStr) {
      try {
        const cached = JSON.parse(cachedStr);
        if (cached._cachedAt && Date.now() - cached._cachedAt < 3600000) {
          console.log('[PROFILE] Using cached profile (instant)');
          delete cached._cachedAt;
          setProfile(cached as Profile);
          setLoading(false);
          // Still try to refresh from DB in background (non-blocking)
          loadProfileFromDB(walletLower, cacheKey).catch(() => {});
          return;
        }
      } catch { /* ignore bad cache */ }
    }
    
    // No valid cache - load from DB with a safety timeout
    let resolved = false;
    
    const safetyTimer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      console.warn('[PROFILE] Safety timeout reached, stopping loading state');
      // If we have ANY cached profile (even old), use it
      if (cachedStr) {
        try {
          const cached = JSON.parse(cachedStr);
          delete cached._cachedAt;
          console.log('[PROFILE] Using stale cache after timeout');
          setProfile(cached as Profile);
        } catch { /* ignore */ }
      }
      setLoading(false);
    }, 8000);
    
    try {
      await loadProfileFromDB(walletLower, cacheKey);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      if (!resolved) {
        resolved = true;
        clearTimeout(safetyTimer);
      }
      setLoading(false);
    }
  };

  const loadProfileFromDB = async (walletLower: string, cacheKey: string) => {
    try {
      if (isArena) {
        // FAST PATH: Simple direct query
        try {
          const { data: directProfile, error: directError } = await supabase
            .from('profiles')
            .select('*')
            .eq('wallet_address', walletLower)
            .maybeSingle();
          
          if (!directError && directProfile) {
            console.log('[ARENA PROFILE] Fast path: profile found');
            const profileObj = directProfile as unknown as Profile;
            setProfile(profileObj);
            localStorage.setItem(cacheKey, JSON.stringify({ ...directProfile, _cachedAt: Date.now() }));
            return;
          }
        } catch (fastErr) {
          console.warn('[ARENA PROFILE] Fast path failed:', fastErr);
        }

        // SLOW PATH: Create profile via RPC
        let arenaProfile = null;
        if (arenaSDK) {
          try {
            arenaProfile = await arenaSDK.sendRequest('getUserProfile');
          } catch { /* ignore */ }
        }
        
        const { data: profileData, error: rpcError } = await supabase.rpc('get_or_create_arena_profile', {
          p_wallet_address: walletLower,
          p_username: arenaProfile?.username || null,
          p_display_name: arenaProfile?.displayName || arenaProfile?.username || null,
          p_avatar_url: arenaProfile?.avatar || null,
          p_twitter_username: arenaProfile?.twitterUsername || null
        });
        
        if (rpcError) {
          console.error('[ARENA PROFILE] RPC error:', rpcError);
        } else if (profileData) {
          setProfile(profileData as unknown as Profile);
          localStorage.setItem(cacheKey, JSON.stringify({ ...(profileData as any), _cachedAt: Date.now() }));
          return;
        }
      }
      
      // Non-Arena path
      const { data: profileData, error: rpcError } = await supabase.rpc('get_profile_by_wallet', {
        p_wallet_address: walletLower
      });
      
      if (rpcError) {
        console.error('[PROFILE] RPC error:', rpcError);
      }
      
      if (profileData) {
        localStorage.setItem(cacheKey, JSON.stringify({ ...(profileData as any), _cachedAt: Date.now() }));
      }
      setProfile(profileData as unknown as Profile | null);
    } catch (error) {
      console.error('[PROFILE] DB load failed:', error);
      throw error;
    }
  };

  const refreshProfile = async () => {
    await loadProfile();
  };

  const verifyWallet = async () => {
    if (!walletAddress || !signMessage) return;

    try {
      const nonceData = await generateNonce();
      if (!nonceData) {
        console.error('Failed to generate nonce');
        return;
      }

      console.log('Generated nonce, asking for signature', nonceData);

      const signature = await signMessage(nonceData.message);
      if (!signature) {
        console.error('Failed to sign message');
        return;
      }

      console.log('Got signature, verifying', { signature: signature.substring(0, 10) + '...' });
      await verifySignature(signature, nonceData);
    } catch (error) {
      console.error('Wallet verification error:', error);
    }
  };

  const connectWallet = () => {
    connectWeb3();
  };

  const disconnectWallet = () => {
    disconnectWeb3();
    setProfile(null);
  };

  return (
    <WalletAuthContext.Provider
      value={{
        walletAddress,
        profile,
        loading,
        isConnected,
        isVerified,
        isArena,
        connectWallet,
        disconnectWallet,
        refreshProfile,
        verifyWallet,
      }}
    >
      {children}
    </WalletAuthContext.Provider>
  );
};

export const useWalletAuth = () => {
  const context = useContext(WalletAuthContext);

  // Graceful fallback if provider is missing (avoids hard crash)
  if (!context) {
    return {
      walletAddress: null,
      profile: null,
      loading: false,
      isConnected: false,
      isVerified: false,
      isArena: false,
      connectWallet: () => {},
      disconnectWallet: () => {},
      refreshProfile: async () => {},
      verifyWallet: async () => {},
    } as WalletAuthContextType;
  }

  return context;
};
