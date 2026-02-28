import { useState, useEffect } from 'react';
import { MessageCircle, Send, ArrowLeft, Loader2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface ChatGroup {
  id: string;
  name: string;
  type: string;
  participants: Array<{
    id: string;
    handle: string;
    userName: string;
    profilePicture?: string;
  }>;
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
  };
  unreadCount: number;
}

interface Message {
  id: string;
  groupId: string;
  content: string;
  senderId: string;
  sender?: {
    id: string;
    handle: string;
    userName: string;
    profilePicture?: string;
  };
  createdAt: string;
}

const PAGE_SIZE = 25;

interface AgentChatTabProps {
  agentId: string;
  agentUserId: string;
  isVerified: boolean;
}

export const AgentChatTab = ({ agentId, agentUserId, isVerified }: AgentChatTabProps) => {
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchGroups();
  }, [agentId]);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'get_chat_groups', agentId }
      });

      if (error) throw error;
      const rawGroups = data?.groups || [];
      // Normalize: ensure participants is always an array
      const normalized = rawGroups.map((g: any) => ({
        ...g,
        participants: Array.isArray(g.participants) ? g.participants : [],
      }));
      setGroups(normalized);
      setPage(1);
    } catch (error) {
      console.error('Error fetching chat groups:', error);
      toast.error('Failed to load chats');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (groupId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'get_chat_messages', agentId, groupId }
      });

      if (error) throw error;
      setMessages(data?.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    }
  };

  const handleSelectGroup = async (group: ChatGroup) => {
    setSelectedGroup(group);
    await fetchMessages(group.id);
    if (group.unreadCount > 0) {
      try {
        await supabase.functions.invoke('arena-agent', {
          body: { action: 'mark_chat_read', agentId, groupId: group.id }
        });
        setGroups(prev => prev.map(g => g.id === group.id ? { ...g, unreadCount: 0 } : g));
      } catch {}
    }
  };

  const handleReactToMessage = async (messageId: string, reaction: string) => {
    if (!selectedGroup) return;
    try {
      await supabase.functions.invoke('arena-agent', {
        body: { action: 'chat_react', agentId, messageId, groupId: selectedGroup.id, reaction }
      });
    } catch {}
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedGroup || !isVerified) return;

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'send_chat_message', agentId, groupId: selectedGroup.id, content: newMessage }
      });

      if (error) throw error;
      
      // Check for non-2xx error in response body
      if (data && data.success === false) {
        toast.error(data.error || 'Failed to send message');
        setIsSending(false);
        return;
      }

      setNewMessage('');
      await fetchMessages(selectedGroup.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const paginatedGroups = groups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (selectedGroup) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800 h-[500px] flex flex-col">
        <CardHeader className="border-b border-zinc-800 flex-shrink-0 px-3 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedGroup(null)} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Avatar className="w-7 h-7 sm:w-8 sm:h-8">
              {selectedGroup.participants?.[0]?.profilePicture && (
                <AvatarImage src={selectedGroup.participants[0].profilePicture} />
              )}
              <AvatarFallback className="bg-cyan-500/20 text-cyan-400 text-xs">
                {selectedGroup.participants?.[0]?.userName?.charAt(0) || selectedGroup.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="text-white text-sm truncate">
                {selectedGroup.participants?.[0]?.userName || selectedGroup.name || 'Chat'}
              </CardTitle>
              <span className="text-xs text-zinc-500">@{selectedGroup.participants?.[0]?.handle || 'unknown'}</span>
            </div>
          </div>
        </CardHeader>

        <ScrollArea className="flex-1 p-3 sm:p-4">
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderId === agentUserId ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] sm:max-w-[70%] px-3 py-2 rounded-lg ${
                    msg.senderId === agentUserId
                      ? 'bg-cyan-500/20 text-cyan-100'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  <p className="text-sm break-words">{msg.content}</p>
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <span className="text-[10px] sm:text-xs text-zinc-500">
                      {(() => {
                        try {
                          const d = new Date(msg.createdAt);
                          if (!msg.createdAt || Number.isNaN(d.getTime())) return '';
                          return formatDistanceToNow(d, { addSuffix: true });
                        } catch { return ''; }
                      })()}
                    </span>
                    {isVerified && msg.senderId !== agentUserId && (
                      <div className="flex gap-1">
                        {['👍', '❤️', '😂'].map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => handleReactToMessage(msg.id, emoji)}
                            className="text-xs opacity-50 hover:opacity-100 transition-opacity p-0.5"
                            title={`React with ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {isVerified && (
          <div className="p-3 sm:p-4 border-t border-zinc-800 flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="bg-zinc-800/50 border-zinc-700 text-white text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <Button onClick={handleSendMessage} disabled={isSending || !newMessage.trim()} size="sm">
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold text-white">Messages</h3>
        <Button variant="ghost" size="sm" onClick={fetchGroups} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="py-8 text-center text-zinc-400">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No conversations yet</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {paginatedGroups.map((group) => (
              <Card
                key={group.id}
                className="bg-zinc-900/50 border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-colors active:bg-zinc-800/70"
                onClick={() => handleSelectGroup(group)}
              >
                <CardContent className="py-3 px-3 sm:px-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Avatar className="w-9 h-9 sm:w-10 sm:h-10 shrink-0">
                      {group.participants?.[0]?.profilePicture && (
                        <AvatarImage src={group.participants[0].profilePicture} />
                      )}
                      <AvatarFallback className="bg-cyan-500/20 text-cyan-400 text-xs">
                        {group.participants?.[0]?.userName?.charAt(0) || group.name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate text-sm">
                          {group.participants?.[0]?.userName || group.name || 'Unknown'}
                        </span>
                        {group.unreadCount > 0 && (
                          <Badge className="bg-pink-500/20 text-pink-400 text-xs shrink-0">
                            {group.unreadCount}
                          </Badge>
                        )}
                      </div>
                      {group.lastMessage && (
                        <p className="text-xs sm:text-sm text-zinc-500 truncate">
                          {group.lastMessage.content}
                        </p>
                      )}
                    </div>
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
