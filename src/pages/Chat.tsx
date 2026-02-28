import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Trash2, Smile, Image, Mic, Sparkles, CheckCheck, Check, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { TipDialog } from '@/components/TipDialog';
import { MediaUploader } from '@/components/MediaUploader';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { GifPicker } from '@/components/GifPicker';
import { useMilestones } from '@/hooks/useMilestones';
import { useE2EEncryption } from '@/hooks/useE2EEncryption';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useMessageReactions } from '@/hooks/useMessageReactions';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { MessageReactions, ReactionPicker } from '@/components/chat/MessageReactions';
import avloLogo from '@/assets/avlo-logo.jpg';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_voice: boolean;
  is_encrypted?: boolean;
  encrypted_content?: string;
  read_at?: string;
  delivered_at?: string;
}

interface MessageAttachment {
  id: string;
  message_id: string;
  url: string;
  type: string;
}

interface OtherUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  wallet_address: string | null;
  special_badge: boolean | null;
}

const Chat = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const { profile } = useWalletAuth();
  const { checkFirstMessage } = useMilestones();
  const navigate = useNavigate();
  
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Record<string, MessageAttachment[]>>({});
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showMediaUploader, setShowMediaUploader] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Pending media to send with message
  const [pendingMedia, setPendingMedia] = useState<{ url: string; type: 'image' | 'video' | 'gif' } | null>(null);

  // Hooks
  const { encrypt, formatEncryptedContent, isInitialized, keyFingerprint, hasEncryption } = useE2EEncryption(matchId);
  const { isOtherUserTyping, setTyping } = useTypingIndicator(matchId, profile?.id);
  const { reactions, toggleReaction } = useMessageReactions(matchId);

  // Fetch match and messages
  useEffect(() => {
    if (!matchId || !profile?.id) return;

    fetchMatchData();
    fetchMessages();

    // Heartbeat: mark this chat as actively open so backend won't create message notifications
    const heartbeat = async () => {
      try {
        await (supabase as any)
          .from('active_chat_views')
          .upsert(
            {
              user_id: profile.id,
              match_id: matchId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,match_id' }
          );
      } catch {
        // no-op
      }
    };

    heartbeat();
    const heartbeatInterval = window.setInterval(heartbeat, 10_000);

    // Subscribe to new messages with proper error handling
    let messagesChannel = supabase.channel(`messages:${matchId}`);
    let attachmentsChannel = supabase.channel(`attachments:${matchId}`);
    let retryCount = 0;
    const maxRetries = 5;

    const setupMessageSubscription = () => {
      messagesChannel = supabase
        .channel(`messages:${matchId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `match_id=eq.${matchId}`,
          },
          (payload) => {
            console.log('[CHAT] New message received:', payload.new);
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some(m => m.id === (payload.new as Message).id)) {
                return prev;
              }
              return [...prev, payload.new as Message];
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'messages',
            filter: `match_id=eq.${matchId}`,
          },
          (payload) => {
            setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
            setAttachments((prev) => {
              const newAttachments = { ...prev };
              delete newAttachments[payload.old.id];
              return newAttachments;
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `match_id=eq.${matchId}`,
          },
          (payload) => {
            setMessages((prev) =>
              prev.map((msg) => (msg.id === payload.new.id ? { ...msg, ...payload.new } : msg))
            );
          }
        )
        .subscribe((status, err) => {
          console.log('[CHAT] Messages subscription status:', status, err);
          if (status === 'SUBSCRIBED') {
            retryCount = 0;
          } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && retryCount < maxRetries) {
            retryCount++;
            const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
            console.log(`[CHAT] Retrying messages subscription in ${delay}ms`);
            setTimeout(() => {
              supabase.removeChannel(messagesChannel);
              setupMessageSubscription();
            }, delay);
          }
        });
    };

    const setupAttachmentsSubscription = () => {
      attachmentsChannel = supabase
        .channel(`attachments:${matchId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'message_attachments',
          },
          (payload) => {
            const newAttachment = payload.new as MessageAttachment;
            setAttachments((prev) => ({
              ...prev,
              [newAttachment.message_id]: [
                ...(prev[newAttachment.message_id] || []),
                newAttachment,
              ],
            }));
          }
        )
        .subscribe((status, err) => {
          console.log('[CHAT] Attachments subscription status:', status, err);
        });
    };

    setupMessageSubscription();
    setupAttachmentsSubscription();

    return () => {
      window.clearInterval(heartbeatInterval);
      try {
        (supabase as any)
          .from('active_chat_views')
          .delete()
          .eq('user_id', profile.id)
          .eq('match_id', matchId);
      } catch {
        // no-op
      }

      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(attachmentsChannel);
    };
  }, [matchId, profile?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mark messages as read
  useEffect(() => {
    if (!messages.length || !profile?.id || !matchId) return;

    const unreadMessages = messages.filter(
      m => m.sender_id !== profile.id && !m.read_at
    );

    if (unreadMessages.length > 0) {
      supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadMessages.map(m => m.id))
        .then(() => {});
    }
  }, [messages, profile?.id, matchId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMatchData = async () => {
    if (!matchId || !profile?.id) return;

    try {
      const { data: match, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (error) throw error;

      const otherUserId = match.user1_id === profile.id ? match.user2_id : match.user1_id;

      const { data: userData } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, wallet_address, special_badge')
        .eq('id', otherUserId)
        .single();

      if (userData) {
        setOtherUser(userData);
      }
    } catch (error) {
      console.error('Error fetching match data:', error);
      toast.error('Failed to load chat');
    }
  };

  const fetchMessages = async () => {
    if (!matchId) return;

    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      setMessages(messagesData || []);

      // Fetch attachments for all messages
      const messageIds = messagesData?.map(m => m.id) || [];
      if (messageIds.length > 0) {
        const { data: attachmentsData } = await supabase
          .from('message_attachments')
          .select('*')
          .in('message_id', messageIds);

        if (attachmentsData) {
          const attachmentsByMessage = attachmentsData.reduce((acc, attachment) => {
            if (!acc[attachment.message_id]) {
              acc[attachment.message_id] = [];
            }
            acc[attachment.message_id].push(attachment);
            return acc;
          }, {} as Record<string, MessageAttachment[]>);
          setAttachments(attachmentsByMessage);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    setTyping(true);
    
    // Clear typing after 3 seconds of no input
    setTimeout(() => {
      setTyping(false);
    }, 3000);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Allow sending if there's text OR pending media
    const hasContent = newMessage.trim() || pendingMedia;
    if (!hasContent || !profile?.id || !matchId || sending) return;

    setSending(true);
    setTyping(false);

    try {
      let messageContent = newMessage.trim() || (pendingMedia?.type === 'gif' ? '' : pendingMedia?.type === 'image' ? '' : '');
      let encryptedContent: string | null = null;
      let isEncrypted = false;

      // Encrypt message if encryption is available and there's text
      if (messageContent && hasEncryption && isInitialized) {
        const encrypted = await encrypt(messageContent);
        if (encrypted) {
          encryptedContent = formatEncryptedContent(encrypted.iv, encrypted.encrypted);
          isEncrypted = true;
        }
      }

      // Create message
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          match_id: matchId,
          sender_id: profile.id,
          content: messageContent || '',
          is_voice: false,
          is_encrypted: isEncrypted,
          encrypted_content: encryptedContent,
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // If there's pending media, attach it
      if (pendingMedia) {
        const { data: attachmentData, error: attachmentError } = await supabase
          .from('message_attachments')
          .insert({
            message_id: messageData.id,
            url: pendingMedia.url,
            type: pendingMedia.type,
          })
          .select()
          .single();

        if (attachmentError) throw attachmentError;

        setAttachments((prev) => ({
          ...prev,
          [messageData.id]: [attachmentData as MessageAttachment],
        }));
      }

      setNewMessage('');
      setPendingMedia(null);
      setShowMediaUploader(false);
      setShowGifPicker(false);
      await checkFirstMessage();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Set pending media instead of sending immediately - user will send with blue button
  const handleMediaSelected = (url: string, type: 'image' | 'video') => {
    setPendingMedia({ url, type });
    setShowMediaUploader(false);
    setShowGifPicker(false);
  };

  const handleVoiceMessageSent = async (url: string) => {
    if (!profile?.id || !matchId) return;

    try {
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          match_id: matchId,
          sender_id: profile.id,
          content: '🎤 Voice message',
          is_voice: true,
        })
        .select()
        .single();

      if (messageError) throw messageError;

      const { data: attachmentData, error: attachmentError } = await supabase
        .from('message_attachments')
        .insert({
          message_id: messageData.id,
          url: url,
          type: 'voice',
        })
        .select()
        .single();

      if (attachmentError) throw attachmentError;

      setAttachments((prev) => ({
        ...prev,
        [messageData.id]: [
          ...(prev[messageData.id] || []),
          attachmentData as MessageAttachment,
        ],
      }));
    } catch (error) {
      console.error('Error sending voice message:', error);
      toast.error('Failed to send voice message');
    }
  };

  // Set pending GIF instead of sending immediately
  const handleGifSelected = (gifUrl: string) => {
    setPendingMedia({ url: gifUrl, type: 'gif' });
    setShowGifPicker(false);
    setShowMediaUploader(false);
  };

  const handleDeleteMessage = async () => {
    if (!profile?.id || !messageToDelete) return;

    try {
      const { error: attachmentError } = await supabase
        .from('message_attachments')
        .delete()
        .eq('message_id', messageToDelete);

      if (attachmentError) throw attachmentError;

      const { error: messageError } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageToDelete);

      if (messageError) throw messageError;

      setMessages((prev) => prev.filter((msg) => msg.id !== messageToDelete));
      setAttachments((prev) => {
        const newAttachments = { ...prev };
        delete newAttachments[messageToDelete];
        return newAttachments;
      });

      toast.success('Message deleted');
      setMessageToDelete(null);
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
      setMessageToDelete(null);
    }
  };

  // Cancel match - this deletes the match and refunds both users' scores
  const handleCancelMatch = async () => {
    if (!profile?.id || !matchId) return;

    try {
      const { data, error } = await supabase.rpc('cancel_match_and_refund_scores', {
        p_match_id: matchId,
        p_user_id: profile.id
      });

      if (error) throw error;

      const result = data as { success?: boolean; error?: string } | null;
      
      if (result?.success) {
        toast.success('Match cancelled. Both users can swipe again and scores have been adjusted.');
        navigate('/matches');
      } else {
        throw new Error(result?.error || 'Failed to cancel match');
      }
    } catch (error) {
      console.error('Error cancelling match:', error);
      toast.error('Failed to cancel match');
    }
  };

  const getMessageStatus = (message: Message, isOwnMessage: boolean) => {
    if (!isOwnMessage) return null;
    
    if (message.read_at) {
      return <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />;
    } else if (message.delivered_at) {
      return <CheckCheck className="w-3.5 h-3.5 text-zinc-500" />;
    } else {
      return <Check className="w-3.5 h-3.5 text-zinc-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
        {/* Tech grid background */}
        <div className="absolute inset-0 opacity-20">
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          />
        </div>
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="w-8 h-8 text-white" />
          </motion.div>
          <p className="text-cyan-400 font-medium">Initializing secure chat...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24 pb-8 px-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
        <motion.div
          className="absolute top-1/4 right-0 w-96 h-96 rounded-full blur-[150px]"
          animate={{
            background: [
              "radial-gradient(circle, rgba(6, 182, 212, 0.15), transparent 70%)",
              "radial-gradient(circle, rgba(168, 85, 247, 0.15), transparent 70%)",
              "radial-gradient(circle, rgba(6, 182, 212, 0.15), transparent 70%)",
            ],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
      </div>

      <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col relative z-10">
        {/* Header */}
        <ChatHeader 
          otherUser={otherUser}
          keyFingerprint={keyFingerprint}
          isEncryptionInitialized={isInitialized}
          isOtherUserTyping={isOtherUserTyping}
        />

        {/* Messages */}
        <Card className="flex-1 p-6 bg-black border border-cyan-500/10 mb-4 overflow-y-auto backdrop-blur-xl relative">
          {/* Ambient corner glow effects */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-br-full pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-purple-500/10 to-transparent rounded-tl-full pointer-events-none" />
          <div className="space-y-4">
            {messages.length === 0 ? (
              <motion.div 
                className="text-center text-zinc-400 py-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center border border-cyan-500/20">
                  <Sparkles className="w-12 h-12 text-cyan-400" />
                </div>
                <p className="text-xl font-semibold text-white mb-2">Start Your Conversation</p>
                <p className="text-sm text-zinc-500">Your messages are end-to-end encrypted 🔐</p>
              </motion.div>
            ) : (
              messages.map((message, index) => {
                const isOwnMessage = message.sender_id === profile?.id;
                const messageAttachments = attachments[message.id] || [];
                const hasAttachments = messageAttachments.length > 0;
                const isTipMessage = message.content.includes('🎁') && message.content.toLowerCase().includes('avlo tip');
                const messageReactions = reactions[message.id] || [];
                
                return (
                  <motion.div
                    key={message.id}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} group`}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: index * 0.02 }}
                  >
                    <div className="flex items-end gap-2 max-w-[80%]">
                      {!isOwnMessage && (
                        <Avatar className="w-8 h-8 border border-zinc-700">
                          <AvatarImage src={otherUser?.avatar_url || ''} />
                          <AvatarFallback className="bg-gradient-to-br from-zinc-700 to-zinc-800 text-white text-xs">
                            {otherUser?.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      
                      <div className="flex flex-col gap-1 relative">
                        {/* Reaction picker */}
                        <AnimatePresence>
                          {activeReactionPicker === message.id && (
                            <ReactionPicker
                              onSelect={(reaction) => profile?.id && toggleReaction(message.id, profile.id, reaction)}
                              onClose={() => setActiveReactionPicker(null)}
                            />
                          )}
                        </AnimatePresence>

                        <motion.div
                          className={`px-4 py-3 rounded-2xl shadow-xl backdrop-blur-sm transition-all relative overflow-hidden ${
                            isOwnMessage
                              ? 'bg-gradient-to-br from-cyan-600 via-cyan-500 to-teal-500 text-white border border-cyan-400/40 rounded-br-sm shadow-cyan-500/20'
                              : 'bg-gradient-to-br from-zinc-800/95 to-zinc-900/95 text-white border border-zinc-700/60 rounded-bl-sm'
                          }`}
                          whileHover={{ scale: 1.01, boxShadow: isOwnMessage ? '0 8px 32px rgba(6, 182, 212, 0.25)' : '0 8px 32px rgba(0, 0, 0, 0.3)' }}
                        >
                          {/* Subtle inner glow for own messages */}
                          {isOwnMessage && (
                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
                          )}
                          {/* Encrypted indicator */}
                          {message.is_encrypted && (
                            <div className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-black">
                              <span className="text-[8px]">🔒</span>
                            </div>
                          )}

                          {isTipMessage && (
                            <div className="relative -mx-4 -mt-3 mb-3 px-4 py-3 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-purple-500/20 border-b border-emerald-500/30 overflow-hidden">
                              {/* Animated scan line */}
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                                animate={{ x: ['-100%', '200%'] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                              />
                              {/* Tech grid overlay */}
                              <div 
                                className="absolute inset-0 opacity-20 pointer-events-none"
                                style={{
                                  backgroundImage: `
                                    linear-gradient(rgba(16, 185, 129, 0.4) 1px, transparent 1px),
                                    linear-gradient(90deg, rgba(16, 185, 129, 0.4) 1px, transparent 1px)
                                  `,
                                  backgroundSize: '8px 8px',
                                }}
                              />
                              {/* Corner accents */}
                              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-emerald-400/60" />
                              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400/60" />
                              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-emerald-400/60" />
                              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400/60" />
                              
                              <div className="relative flex items-center gap-3">
                                <div className="relative">
                                  <motion.div
                                    className="absolute -inset-1 bg-gradient-to-r from-emerald-500/50 to-cyan-500/50 rounded-full blur-sm"
                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                  />
                                  <img src={avloLogo} alt="AVLO" className="relative w-8 h-8 rounded-full border-2 border-emerald-400/60 shadow-lg shadow-emerald-500/30" />
                                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-black flex items-center justify-center shadow-lg shadow-emerald-500/50">
                                    <span className="text-[7px] font-bold text-white">✓</span>
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-emerald-300">
                                      {isOwnMessage ? 'TIP SENT' : 'TIP RECEIVED'}
                                    </span>
                                    <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                      AVLO
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-emerald-400/60 font-mono flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    transfer.verified
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Attachments - render actual media */}
                          {messageAttachments.length > 0 && (
                            <div className="space-y-2 mb-2">
                              {messageAttachments.map((attachment) => (
                                <div key={attachment.id} className="rounded-xl overflow-hidden">
                                  {attachment.type === 'image' && (
                                    <img 
                                      src={attachment.url} 
                                      alt="Shared photo" 
                                      className="w-full max-h-80 object-cover rounded-xl"
                                      loading="lazy"
                                    />
                                  )}
                                  {attachment.type === 'video' && (
                                    <video 
                                      src={attachment.url} 
                                      controls 
                                      className="w-full max-h-[400px] rounded-xl bg-black"
                                      preload="metadata"
                                    />
                                  )}
                                  {attachment.type === 'voice' && (
                                    <div className="bg-zinc-800/50 rounded-xl p-3">
                                      <audio 
                                        src={attachment.url} 
                                        controls 
                                        className="w-full h-10"
                                        preload="metadata"
                                      />
                                    </div>
                                  )}
                                  {attachment.type === 'gif' && (
                                    <img 
                                      src={attachment.url} 
                                      alt="GIF" 
                                      className="w-full max-h-80 object-cover rounded-xl"
                                      loading="lazy"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Text content - show if there's actual text (not placeholder) */}
                          {message.content && !['📷 Photo', '🎥 Video', '🎬 GIF', '🎤 Voice message'].includes(message.content) && (
                            <p className={`break-words leading-relaxed whitespace-pre-wrap ${
                              isTipMessage ? 'font-semibold' : 'text-white'
                            }`}>
                              {isTipMessage ? (
                                <span className="flex items-center gap-2 text-white">
                                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 text-xs">✓</span>
                                  <span className="text-emerald-100">
                                    {message.content.replace('🎁 ', '').replace('Sent', 'Transferred').replace('AVLO tip', '')}
                                    <span className="ml-1 text-emerald-300 font-bold">AVLO</span>
                                  </span>
                                </span>
                              ) : (
                                message.content
                              )}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-end gap-1.5 mt-2">
                            <p className={`text-[10px] opacity-70 ${isOwnMessage ? 'text-white/70' : 'text-zinc-400'}`}>
                              {new Date(message.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                            {getMessageStatus(message, isOwnMessage)}
                          </div>
                        </motion.div>

                        {/* Reactions display */}
                        {messageReactions.length > 0 && (
                          <MessageReactions
                            reactions={messageReactions}
                            currentUserId={profile?.id || ''}
                            onToggleReaction={(reaction) => profile?.id && toggleReaction(message.id, profile.id, reaction)}
                            isOwnMessage={isOwnMessage}
                          />
                        )}

                        {/* Action buttons */}
                        <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-zinc-500 hover:text-cyan-400 hover:bg-zinc-800"
                            onClick={() => setActiveReactionPicker(activeReactionPicker === message.id ? null : message.id)}
                          >
                            <Smile className="h-3 w-3" />
                          </Button>
                          {isOwnMessage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10"
                              onClick={() => setMessageToDelete(message.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {isOwnMessage && (
                        <Avatar className="w-8 h-8 border border-cyan-500/30">
                          <AvatarImage src={profile?.avatar_url || ''} />
                          <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white text-xs">
                            {profile?.username?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}

            {/* Typing indicator */}
            <AnimatePresence>
              {isOtherUserTyping && otherUser && (
                <TypingIndicator 
                  username={otherUser.username}
                  avatarUrl={otherUser.avatar_url}
                />
              )}
            </AnimatePresence>
            
            <div ref={messagesEndRef} />
          </div>
        </Card>

        {/* Media Uploader */}
        <AnimatePresence>
          {showMediaUploader && matchId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="p-4 bg-zinc-900/90 border-cyan-500/30 mb-2 backdrop-blur-xl">
                <MediaUploader 
                  onMediaSelected={handleMediaSelected}
                  matchId={matchId}
                />
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* GIF Picker */}
        <AnimatePresence>
          {showGifPicker && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-2"
            >
              <GifPicker 
                onGifSelected={handleGifSelected}
                onClose={() => setShowGifPicker(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <Card className="p-4 bg-gradient-to-r from-zinc-900/95 via-zinc-900/90 to-zinc-900/95 border border-cyan-500/20 backdrop-blur-xl relative overflow-hidden">
          {/* Animated border effect */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
          </div>
          
          <div className="flex flex-col gap-3">
            {/* Pending media preview */}
            <AnimatePresence>
              {pendingMedia && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="relative"
                >
                  <div className="relative inline-block rounded-xl overflow-hidden border-2 border-cyan-500/40 bg-zinc-800/50">
                    {pendingMedia.type === 'gif' || pendingMedia.type === 'image' ? (
                      <img 
                        src={pendingMedia.url} 
                        alt="Selected media" 
                        className="max-h-32 max-w-48 object-cover rounded-lg"
                      />
                    ) : (
                      <video 
                        src={pendingMedia.url} 
                        className="max-h-32 max-w-48 object-cover rounded-lg"
                        muted
                      />
                    )}
                    {/* Remove button */}
                    <button
                      onClick={() => setPendingMedia(null)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors"
                    >
                      <span className="text-xs font-bold">✕</span>
                    </button>
                    {/* Type badge */}
                    <div className="absolute bottom-1 left-1 px-2 py-0.5 bg-black/70 rounded-full text-[10px] text-cyan-400 font-medium uppercase">
                      {pendingMedia.type}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">Add a message or press send</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowMediaUploader(!showMediaUploader);
                    setShowGifPicker(false);
                  }}
                  className={`text-white hover:bg-zinc-800 ${showMediaUploader ? 'bg-cyan-500/20 text-cyan-400' : ''}`}
                >
                  <Image className="w-4 h-4 mr-1" />
                  Media
                </Button>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowGifPicker(!showGifPicker);
                    setShowMediaUploader(false);
                  }}
                  className={`text-white hover:bg-zinc-800 px-3 ${showGifPicker ? 'bg-purple-500/20 text-purple-400' : ''}`}
                >
                  <span className="text-xs font-bold">GIF</span>
                </Button>
              </motion.div>
              
              {otherUser?.wallet_address && matchId && (
                <TipDialog
                  receiverId={otherUser.id}
                  receiverName={otherUser.display_name || otherUser.username}
                  receiverWallet={otherUser.wallet_address}
                  context="chat"
                  matchId={matchId}
                />
              )}
              
              {/* Encryption status indicator */}
              {hasEncryption && (
                <div className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400">
                  <span>🔒</span>
                  <span className="hidden sm:inline">Encrypted</span>
                </div>
              )}
            </div>
            
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <Input
                value={newMessage}
                onChange={handleInputChange}
                placeholder={pendingMedia ? "Add a message (optional)..." : "Type a message..."}
                className="flex-1 bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-cyan-500 focus:ring-cyan-500/20"
                disabled={sending}
              />
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  type="submit"
                  disabled={(!newMessage.trim() && !pendingMedia) || sending}
                  className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white px-6 shadow-lg shadow-cyan-500/30 disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </motion.div>
            </form>
          </div>
        </Card>
      </div>

      {/* Delete Confirmation Dialog - Now cancels the match */}
      <AlertDialog open={!!messageToDelete} onOpenChange={() => setMessageToDelete(null)}>
        <AlertDialogContent className="bg-zinc-900 border-red-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Cancel Match?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 space-y-2">
              <p>⚠️ <strong className="text-red-400">Warning:</strong> Deleting a message will cancel the entire match!</p>
              <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                <li>Both you and {otherUser?.username || 'the other user'} will lose the +20 score from this match</li>
                <li>All messages in this chat will be deleted</li>
                <li>You can both swipe on each other again to re-match</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
              Keep Match
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelMatch}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Cancel Match & Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Chat;
