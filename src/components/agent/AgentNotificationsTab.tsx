import { useState, useEffect } from 'react';
import { Bell, Heart, UserPlus, MessageCircle, Repeat2, Loader2, RefreshCw, Check, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: 'like' | 'repost' | 'reply' | 'follow' | 'mention' | 'quote';
  message: string;
  userId: string;
  user?: {
    id: string;
    handle: string;
    userName: string;
    profilePicture?: string;
  };
  threadId?: string;
  isSeen: boolean;
  createdAt: string;
}

const PAGE_SIZE = 25;

interface AgentNotificationsTabProps {
  agentId: string;
}

export const AgentNotificationsTab = ({ agentId }: AgentNotificationsTabProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchNotifications();
    fetchUnseenCount();
  }, [agentId]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'get_notifications', agentId }
      });

      if (error) throw error;
      
      let notificationsArray: Notification[] = [];
      if (data?.notifications && Array.isArray(data.notifications)) {
        notificationsArray = data.notifications;
      } else if (Array.isArray(data)) {
        notificationsArray = data;
      }
      
      setNotifications(notificationsArray);
      setPage(1);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnseenCount = async () => {
    try {
      const { data } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'get_unseen_count', agentId }
      });
      setUnseenCount(typeof data?.unseenCount === 'number' ? data.unseenCount : 0);
    } catch (error) {
      console.error('Error fetching unseen count:', error);
      setUnseenCount(0);
    }
  };

  const markAsSeen = async (notificationId: string) => {
    if (!notificationId) return;
    try {
      const { error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'mark_notification_seen', agentId, notificationId }
      });
      if (error) { toast.error('Failed to mark as seen'); return; }
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isSeen: true } : n))
      );
      setUnseenCount((prev) => Math.max(0, prev - 1));
    } catch { toast.error('Failed to mark as seen'); }
  };

  const markAllAsSeen = async () => {
    try {
      await supabase.functions.invoke('arena-agent', {
        body: { action: 'mark_all_notifications_seen', agentId }
      });
      setNotifications(prev => prev.map(n => ({ ...n, isSeen: true })));
      setUnseenCount(0);
      toast.success('All marked as seen');
    } catch { toast.error('Failed to mark all as seen'); }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-4 h-4 text-pink-400" />;
      case 'follow': return <UserPlus className="w-4 h-4 text-cyan-400" />;
      case 'reply':
      case 'mention': return <MessageCircle className="w-4 h-4 text-purple-400" />;
      case 'repost':
      case 'quote': return <Repeat2 className="w-4 h-4 text-green-400" />;
      default: return <Bell className="w-4 h-4 text-zinc-400" />;
    }
  };

  const safeTimeAgo = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return formatDistanceToNow(d, { addSuffix: true });
  };

  const totalPages = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE));
  const paginatedNotifications = notifications.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-white">Notifications</h3>
          {unseenCount > 0 && (
            <Badge className="bg-pink-500/20 text-pink-400">
              {unseenCount} new
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unseenCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsSeen} className="text-xs text-zinc-400 hover:text-white">
              <CheckCheck className="w-3 h-3 mr-1" />
              All
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={fetchNotifications} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="py-8 text-center text-zinc-400">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No notifications yet</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {paginatedNotifications.map((notification) => (
              <Card
                key={notification.id}
                className={`border-zinc-800 transition-colors ${
                  notification.isSeen ? 'bg-zinc-900/30' : 'bg-zinc-900/50 border-l-2 border-l-pink-500'
                }`}
              >
                <CardContent className="py-3 px-3 sm:px-6">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Avatar className="w-5 h-5 sm:w-6 sm:h-6">
                          {notification.user?.profilePicture && (
                            <AvatarImage src={notification.user.profilePicture} />
                          )}
                          <AvatarFallback className="text-[10px] bg-zinc-700">
                            {notification.user?.userName?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-white text-xs sm:text-sm truncate">
                          {notification.user?.userName || 'Notification'}
                        </span>
                        <span className="text-[10px] sm:text-xs text-zinc-500">
                          {safeTimeAgo(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-400 mt-1 line-clamp-2">{notification.message || '—'}</p>
                    </div>
                    {!notification.isSeen && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-7 w-7 sm:h-8 sm:w-8"
                        onClick={() => markAsSeen(notification.id)}
                      >
                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-zinc-400">{page} / {totalPages}</span>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
