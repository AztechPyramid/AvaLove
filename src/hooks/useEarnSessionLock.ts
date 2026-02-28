import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type EarnType = 'games' | 'watch' | 'listen';

interface UseEarnSessionLockOptions {
  earnType: EarnType;
  userId: string | undefined;
  onKicked: () => void;
}

// Generate a unique device ID for this browser session
const getDeviceId = () => {
  let deviceId = sessionStorage.getItem('earn_device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('earn_device_id', deviceId);
  }
  return deviceId;
};

export function useEarnSessionLock({ earnType, userId, onKicked }: UseEarnSessionLockOptions) {
  const [isLocked, setIsLocked] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const deviceId = useRef<string>(getDeviceId());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isActiveRef = useRef(false);
  const onKickedRef = useRef(onKicked);
  
  // Keep onKicked ref updated
  useEffect(() => {
    onKickedRef.current = onKicked;
  }, [onKicked]);

  // Start a new earn session - this will automatically kick any existing session
  const startSession = useCallback(async () => {
    if (!userId) {
      console.log('[EarnLock] No userId, cannot start session');
      return false;
    }

    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionIdRef.current = newSessionId;

    try {
      console.log(`[EarnLock] Starting ${earnType} session:`, newSessionId, 'for user:', userId);
      
      const { data, error } = await supabase.rpc('start_earn_session', {
        p_user_id: userId,
        p_earn_type: earnType,
        p_session_id: newSessionId,
        p_device_id: deviceId.current
      });

      console.log(`[EarnLock] start_earn_session response:`, { data, error });

      if (error) {
        console.error('[EarnLock] Error starting session:', error);
        return false;
      }

      const result = data as { success: boolean; session_id: string; kicked_existing: boolean; kicked_device_id: string | null };
      
      if (result.kicked_existing) {
        console.log('[EarnLock] Kicked existing session from device:', result.kicked_device_id);
      }

      setSessionId(newSessionId);
      setIsLocked(true);
      isActiveRef.current = true;

      // Start heartbeat
      heartbeatRef.current = setInterval(async () => {
        if (!sessionIdRef.current || !isActiveRef.current) return;
        
        await supabase.rpc('heartbeat_earn_session', {
          p_user_id: userId,
          p_earn_type: earnType,
          p_session_id: sessionIdRef.current
        });
      }, 10000); // Heartbeat every 10 seconds

      // Subscribe to realtime changes to detect if WE get kicked
      // We listen for any update to our session (could be kicked by any earn type)
      const channelName = `earn_session_kick_${userId}_${newSessionId}`;
      console.log(`[EarnLock] Subscribing to channel: ${channelName}`);
      
      channelRef.current = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'active_earn_sessions',
            filter: `session_id=eq.${newSessionId}`
          },
          (payload) => {
            console.log('[EarnLock] Received realtime update:', payload);
            const record = payload.new as { 
              session_id: string; 
              earn_type: string;
              kicked: boolean; 
              is_active: boolean;
              kicked_reason: string | null;
            };
            
            // Check if OUR session was kicked
            if (record.kicked === true) {
              console.log('[EarnLock] Our session was kicked!', record.kicked_reason);
              toast.warning("Session Ended", {
                description: record.kicked_reason || "You started earning from another device. This session has been closed.",
                duration: 5000
              });
              
              // Clean up and notify
              isActiveRef.current = false;
              setIsLocked(false);
              setSessionId(null);
              sessionIdRef.current = null;
              onKickedRef.current();
            }
          }
        )
        .subscribe((status) => {
          console.log(`[EarnLock] Channel ${channelName} status:`, status);
        });

      return true;
    } catch (error) {
      console.error('[EarnLock] Error in startSession:', error);
      return false;
    }
  }, [userId, earnType, onKicked]);

  // End the session gracefully
  const endSession = useCallback(async () => {
    if (!userId || !sessionIdRef.current) {
      console.log('[EarnLock] No session to end');
      return;
    }

    isActiveRef.current = false;

    // Stop heartbeat
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    // Unsubscribe from realtime
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    try {
      console.log(`[EarnLock] Ending ${earnType} session:`, sessionIdRef.current);
      
      await supabase.rpc('end_earn_session', {
        p_user_id: userId,
        p_earn_type: earnType,
        p_session_id: sessionIdRef.current
      });
    } catch (error) {
      console.error('[EarnLock] Error ending session:', error);
    }

    setIsLocked(false);
    setSessionId(null);
    sessionIdRef.current = null;
  }, [userId, earnType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      // End session on unmount if active (fire and forget)
      if (isActiveRef.current && sessionIdRef.current && userId) {
        const sessionToEnd = sessionIdRef.current;
        // Use void to ignore the promise
        void supabase.rpc('end_earn_session', {
          p_user_id: userId,
          p_earn_type: earnType,
          p_session_id: sessionToEnd
        });
      }
    };
  }, [userId, earnType]);

  return {
    isLocked,
    sessionId,
    startSession,
    endSession
  };
}
