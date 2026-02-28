import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';

interface Notification {
  id: string;
  type: 'match' | 'message' | 'tip' | 'achievement' | 'system' | 'reward' | 'follow' | 'like' | 'comment' | 'swipe_gift' | 'profile_boost' | 'pool_boost' | 'pool_created' | 'match_cancelled';
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at: string;
}

// Polling interval for fallback (realtime handles instant updates, polling is safety net)
const POLLING_INTERVAL = 120000; // 2 minutes

export const useNotifications = () => {
  const { profile } = useWalletAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const lastFetchRef = useRef<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNotifications = useCallback(async (isPolling = false) => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const newNotifications = (data as Notification[]) || [];
      
      // Check if there are new notifications since last fetch (for polling)
      if (isPolling && lastFetchRef.current && newNotifications.length > 0) {
        const latestId = newNotifications[0]?.id;
        if (latestId !== lastFetchRef.current) {
          // New notification detected via polling
          console.log('[NOTIFICATIONS] 🔔 New notification detected via polling');
        }
      }
      
      if (newNotifications.length > 0) {
        lastFetchRef.current = newNotifications[0].id;
      }

      setNotifications(newNotifications);
      setUnreadCount(newNotifications.filter((n) => !n.read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  // Send push notification helper
  const sendPushNotification = useCallback(async (notification: Notification) => {
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: profile?.id,
          title: notification.title,
          message: notification.message,
          url: '/',
          data: notification.data
        }
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;

    // Initial fetch
    fetchNotifications();

    // Set up polling for reliable updates (fallback for realtime issues)
    pollingRef.current = setInterval(() => {
      fetchNotifications(true);
    }, POLLING_INTERVAL);

    // Create realtime channel for instant updates
    const channelName = `notifications-realtime-${profile.id}`;
    console.log('[NOTIFICATIONS] Setting up realtime channel:', channelName);

    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: true },
          presence: { key: profile.id },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          console.log('[NOTIFICATIONS] 🔔 New notification received via realtime:', payload);
          const newNotification = payload.new as Notification;
          setNotifications((prev) => {
            if (prev.some(n => n.id === newNotification.id)) {
              return prev;
            }
            return [newNotification, ...prev];
          });
          setUnreadCount((prev) => prev + 1);
          sendPushNotification(newNotification);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          const updatedNotification = payload.new as Notification;
          setNotifications((prev) => {
            const updated = prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n));
            setUnreadCount(updated.filter((n) => !n.read).length);
            return updated;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          const deletedId = (payload.old as any).id;
          setNotifications((prev) => {
            const filtered = prev.filter((n) => n.id !== deletedId);
            setUnreadCount(filtered.filter((n) => !n.read).length);
            return filtered;
          });
        }
      );

    channel.subscribe((status, err) => {
      console.log('[NOTIFICATIONS] Channel subscription status:', status, err || '');
      if (status === 'SUBSCRIBED') {
        console.log('[NOTIFICATIONS] ✅ Realtime channel is now active!');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[NOTIFICATIONS] ❌ Channel error, polling will handle updates');
      }
    });

    // Listen for global notifications updates
    const handleNotificationsUpdated = () => {
      fetchNotifications();
    };

    window.addEventListener('notifications:updated', handleNotificationsUpdated);

    return () => {
      console.log('[NOTIFICATIONS] Cleaning up channel and polling');
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      supabase.removeChannel(channel);
      window.removeEventListener('notifications:updated', handleNotificationsUpdated);
    };
  }, [profile?.id, fetchNotifications, sendPushNotification]);

  const markAsRead = async (notificationId: string) => {
    try {
      // Optimistically update UI first
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Then update DB
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        // Rollback on error
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    if (!profile?.id) return;

    try {
      // Optimistically update UI first
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);

      // Then update DB
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', profile.id)
        .eq('read', false);

      if (error) {
        console.error('Error marking all as read:', error);
        // Rollback on error
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      fetchNotifications();
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      // Optimistically update UI first
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      const wasUnread = notifications.find(n => n.id === notificationId && !n.read);
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      // Then update DB
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        console.error('Error deleting notification:', error);
        // Rollback on error
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      fetchNotifications();
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: fetchNotifications,
  };
};
