import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RoomList from '@/components/chat/RoomList';
import ChatRoom from '@/components/chat/ChatRoom';
import { LiveActivityPanel } from '@/components/chat/LiveActivityPanel';
import avloLogo from '@/assets/avlo-logo.jpg';

interface ChatRoomData {
  id: string;
  room_type: 'global' | 'game' | 'video' | 'staking';
  reference_id: string | null;
  reference_title: string | null;
}

interface PublicChatProps {
  onClose?: () => void;
  initialRoomId?: string;
  initialRoomTitle?: string;
}

const PublicChat = ({ onClose, initialRoomId, initialRoomTitle }: PublicChatProps) => {
  const { profile } = useWalletAuth();
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [currentRoomTitle, setCurrentRoomTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeRoom();
  }, [initialRoomId]);

  const initializeRoom = async () => {
    setLoading(true);
    try {
      if (initialRoomId) {
        // Use provided room
        setCurrentRoomId(initialRoomId);
        setCurrentRoomTitle(initialRoomTitle || 'Chat Room');
      } else {
        // Get or create global room
        const { data: globalRoom } = await supabase
          .from('chat_rooms')
          .select('*')
          .eq('room_type', 'global')
          .single();

        if (globalRoom) {
          setCurrentRoomId(globalRoom.id);
          setCurrentRoomTitle('Global Chat');
        }
      }
    } catch (error) {
      console.error('Error initializing room:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRoom = async (roomId: string) => {
    try {
      const { data: room } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (room) {
        setCurrentRoomId(room.id);
        
        if (room.room_type === 'global') {
          setCurrentRoomTitle('Global Chat');
        } else {
          setCurrentRoomTitle(room.reference_title || `${room.room_type} Chat`);
        }
      }
    } catch (error) {
      console.error('Error selecting room:', error);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <div className="text-xl text-white font-semibold">Loading chat...</div>
      </div>
    );
  }

  return (
    <Card className="h-full flex flex-col bg-black border-zinc-800 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 landscape:p-1.5 landscape:py-1 border-b border-zinc-800 bg-black/60 backdrop-blur-sm flex items-center justify-between landscape:min-h-[40px]">
        <div className="landscape:flex landscape:items-center landscape:gap-2">
          <h2 className="text-xl landscape:text-sm font-bold text-white flex items-center gap-2 landscape:gap-1.5">
            <img src={avloLogo} alt="AVLO" className="w-6 h-6 landscape:w-4 landscape:h-4 rounded-full" />
            <span className="landscape:hidden">Avlo Chat</span>
            <span className="hidden landscape:inline">Chat</span>
          </h2>
          <p className="text-xs text-zinc-500 landscape:hidden">Multi-room chat system</p>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full hover:bg-zinc-800 bg-zinc-900 text-white landscape:h-6 landscape:w-6"
          >
            <X className="w-5 h-5 landscape:w-3.5 landscape:h-3.5" />
          </Button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative">
        <Tabs defaultValue="chat" className="h-full flex flex-col relative z-10">
          <TabsList className="w-full bg-zinc-900 border-b border-zinc-800 landscape:h-7 landscape:p-0 relative z-20">
            <TabsTrigger value="chat" className="flex-1 data-[state=active]:bg-zinc-800 text-white landscape:text-xs landscape:py-0.5 landscape:h-7 cursor-pointer">
              Chat
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-1 data-[state=active]:bg-zinc-800 text-white landscape:text-xs landscape:py-0.5 landscape:h-7 cursor-pointer">
              Activity
            </TabsTrigger>
            <TabsTrigger value="rooms" className="flex-1 data-[state=active]:bg-zinc-800 text-white landscape:text-xs landscape:py-0.5 landscape:h-7 cursor-pointer">
              Rooms
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 m-0 overflow-hidden">
            {currentRoomId ? (
              <ChatRoom roomId={currentRoomId} roomTitle={currentRoomTitle} />
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-500">
                <p>Select a room to start chatting</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="flex-1 m-0 overflow-hidden">
            <LiveActivityPanel />
          </TabsContent>

          <TabsContent value="rooms" className="flex-1 m-0 overflow-hidden">
            <RoomList 
              currentRoomId={currentRoomId} 
              onSelectRoom={handleSelectRoom} 
            />
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
};

export default PublicChat;
