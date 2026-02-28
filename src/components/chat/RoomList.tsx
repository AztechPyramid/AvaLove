import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Globe, Gamepad2, Video, Loader2, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatRoom {
  id: string;
  room_type: 'global' | 'game' | 'video' | 'staking';
  reference_id: string | null;
  reference_title: string | null;
  participant_count: number;
}

interface RoomListProps {
  currentRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
}

export default function RoomList({ currentRoomId, onSelectRoom }: RoomListProps) {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = useCallback(async () => {
    try {
      // Single optimized query - get last 50 rooms
      const { data: allRooms, error: roomsError } = await supabase
        .from('chat_rooms')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (roomsError) throw roomsError;
      if (!allRooms || allRooms.length === 0) {
        setRooms([]);
        return;
      }

      // Get global rooms immediately (no message check needed)
      const globalRooms = allRooms.filter(r => r.room_type === 'global');
      const otherRooms = allRooms.filter(r => r.room_type !== 'global');

      // Show global rooms immediately
      if (globalRooms.length > 0) {
        setRooms(globalRooms as ChatRoom[]);
        setLoading(false);
      }

      // If there are other rooms, check which ones have messages in a single query
      if (otherRooms.length > 0) {
        const otherRoomIds = otherRooms.map(r => r.id);
        
        // Single query to get distinct room_ids that have messages
        const { data: roomsWithMsgs } = await supabase
          .from('public_chat_messages')
          .select('room_id')
          .in('room_id', otherRoomIds);

        // Get unique room IDs with messages
        const roomIdsWithMessages = new Set(roomsWithMsgs?.map(m => m.room_id) || []);
        
        // Filter other rooms to only those with messages
        const validOtherRooms = otherRooms.filter(room => roomIdsWithMessages.has(room.id));

        // Combine and sort
        const allValidRooms = [...globalRooms, ...validOtherRooms];
        const roomTypePriority: Record<string, number> = { global: 0, staking: 1, game: 2, video: 3 };
        const sortedRooms = allValidRooms.sort((a, b) => {
          const priorityA = roomTypePriority[a.room_type] ?? 99;
          const priorityB = roomTypePriority[b.room_type] ?? 99;
          return priorityA - priorityB;
        });

        setRooms(sortedRooms as ChatRoom[]);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();

    // Subscribe to room changes with debounce
    const channel = supabase
      .channel('chat_rooms_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_rooms'
        },
        () => {
          fetchRooms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRooms]);

  const getRoomIcon = useMemo(() => (type: string) => {
    switch (type) {
      case 'global':
        return <Globe className="h-4 w-4 text-orange-500" />;
      case 'game':
        return <Gamepad2 className="h-4 w-4 text-green-500" />;
      case 'video':
        return <Video className="h-4 w-4 text-purple-500" />;
      case 'staking':
        return <Coins className="h-4 w-4 text-yellow-500" />;
      default:
        return <Globe className="h-4 w-4 text-orange-500" />;
    }
  }, []);

  const getRoomLabel = useCallback((room: ChatRoom) => {
    if (room.room_type === 'global') {
      return 'Global Chat';
    }
    return room.reference_title || `${room.room_type} Room`;
  }, []);

  if (loading && rooms.length === 0) {
    return (
      <div className="p-4 flex items-center justify-center gap-2 text-white/50">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {rooms.map((room) => (
          <Button
            key={room.id}
            variant="ghost"
            className={cn(
              "w-full justify-start gap-2 text-left hover:bg-zinc-800",
              currentRoomId === room.id && "bg-zinc-800 text-white"
            )}
            onClick={() => onSelectRoom(room.id)}
          >
            {getRoomIcon(room.room_type)}
            <span className="flex-1 truncate text-white">
              {getRoomLabel(room)}
            </span>
            {room.participant_count > 0 && (
              <Badge variant="secondary" className="bg-orange-500/20 text-orange-300 text-xs">
                {room.participant_count}
              </Badge>
            )}
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}
