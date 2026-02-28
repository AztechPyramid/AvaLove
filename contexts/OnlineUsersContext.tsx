import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface OnlineUsersContextType {
  onlineUserIds: Set<string>;
  onlineCount: number;
  isUserOnline: (userId: string) => boolean;
}

const OnlineUsersContext = createContext<OnlineUsersContextType | undefined>(undefined);

export const OnlineUsersProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useWalletAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mountedRef = useRef(true);
  const keepAliveRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    
    if (!profile?.id) return;

    console.log('[PRESENCE] Setting up global presence channel for user:', profile.id);

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: profile.id,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        if (!mountedRef.current) return;
        
        const state = channel.presenceState();
        const ids = new Set<string>();
        
        Object.keys(state).forEach(key => {
          ids.add(key);
          const presences = state[key] as any[];
          presences.forEach(p => {
            if (p.user_id) ids.add(p.user_id);
          });
        });
        
        console.log('[PRESENCE] Synced online users:', ids.size);
        setOnlineUserIds(ids);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (!mountedRef.current) return;
        console.log('[PRESENCE] User joined:', key);
        setOnlineUserIds(prev => {
          const next = new Set(prev);
          next.add(key);
          newPresences.forEach((p: any) => {
            if (p.user_id) next.add(p.user_id);
          });
          return next;
        });
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (!mountedRef.current) return;
        console.log('[PRESENCE] User left:', key);
        setOnlineUserIds(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (status) => {
        if (!mountedRef.current) return;
        console.log('[PRESENCE] Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          // NOTE: Score/credit decay is applied in WalletAuthContext (after verification / Arena auto-verify)
          // Do NOT call apply-score-decay here to avoid duplicate decay application
          
          await channel.track({
            user_id: profile.id,
            online_at: new Date().toISOString(),
          });
          
          // Update last_active in profiles for DAU tracking
          await supabase
            .from('profiles')
            .update({ last_active: new Date().toISOString() })
            .eq('id', profile.id);
        }
      });

    // Periodic re-track to keep presence alive and update last_active
    keepAliveRef.current = setInterval(async () => {
      if (channelRef.current && mountedRef.current) {
        try {
          await channelRef.current.track({
            user_id: profile.id,
            online_at: new Date().toISOString(),
          });
          
          // Update last_active every 20 minutes for accurate DAU
          await supabase
            .from('profiles')
            .update({ last_active: new Date().toISOString() })
            .eq('id', profile.id);
        } catch {
          // Ignore errors during keep-alive
        }
      }
    }, 1200000); // 20 minutes — reduces DB writes significantly

    return () => {
      console.log('[PRESENCE] Cleaning up presence channel');
      mountedRef.current = false;
      
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [profile?.id]);

  const isUserOnline = useCallback((userId: string): boolean => {
    return onlineUserIds.has(userId);
  }, [onlineUserIds]);

  return (
    <OnlineUsersContext.Provider
      value={{
        onlineUserIds,
        onlineCount: onlineUserIds.size,
        isUserOnline,
      }}
    >
      {children}
    </OnlineUsersContext.Provider>
  );
};

export const useOnlineUsersContext = () => {
  const context = useContext(OnlineUsersContext);
  
  if (!context) {
    return {
      onlineUserIds: new Set<string>(),
      onlineCount: 0,
      isUserOnline: () => false,
    } as OnlineUsersContextType;
  }
  
  return context;
};
