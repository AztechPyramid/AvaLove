import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { getAvatarUrl } from '@/lib/defaultAvatars';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import arenaLogo from '@/assets/arena-logo.png';

interface FollowersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  initialTab?: 'followers' | 'following';
}

interface UserItem {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  arena_verified: boolean | null;
  arena_username: string | null;
}

export const FollowersDialog = ({ isOpen, onClose, userId, initialTab = 'followers' }: FollowersDialogProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
  const [followers, setFollowers] = useState<UserItem[]>([]);
  const [following, setFollowing] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      fetchData();
    }
  }, [isOpen, userId]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [followersRes, followingRes] = await Promise.all([
        supabase
          .from('followers')
          .select('follower_id, profiles!followers_follower_id_fkey(id, username, display_name, avatar_url, arena_verified, arena_username)')
          .eq('following_id', userId),
        supabase
          .from('followers')
          .select('following_id, profiles!followers_following_id_fkey(id, username, display_name, avatar_url, arena_verified, arena_username)')
          .eq('follower_id', userId),
      ]);

      if (followersRes.data) {
        setFollowers(followersRes.data.map((f: any) => f.profiles).filter(Boolean));
      }
      if (followingRes.data) {
        setFollowing(followingRes.data.map((f: any) => f.profiles).filter(Boolean));
      }
    } catch (error) {
      console.error('Error fetching followers/following:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (userId: string) => {
    onClose();
    navigate(`/profile/${userId}`);
  };

  const renderUserList = (users: UserItem[]) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      );
    }

    if (users.length === 0) {
      return (
        <div className="text-center py-8 text-zinc-500">
          No users found
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {users.map((user) => (
          <Button
            key={user.id}
            variant="ghost"
            className="w-full justify-start p-3 h-auto hover:bg-zinc-800"
            onClick={() => handleUserClick(user.id)}
          >
            <Avatar className="w-10 h-10 mr-3">
              <AvatarImage src={getAvatarUrl(user.avatar_url, user.id)} />
              <AvatarFallback>{user.username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="text-white font-medium">
                {user.display_name || user.username}
              </span>
              <div className="flex items-center gap-1.5">
                {user.arena_verified && user.arena_username ? (
                  <>
                    <img src={arenaLogo} alt="Arena" className="w-3 h-3 rounded-sm" />
                    <span className="text-orange-400 text-xs">@{user.arena_username}</span>
                  </>
                ) : (
                  <span className="text-zinc-500 text-xs">@{user.username}</span>
                )}
              </div>
            </div>
          </Button>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Connections</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'followers' | 'following')}>
          <TabsList className="w-full bg-zinc-800">
            <TabsTrigger value="followers" className="flex-1 data-[state=active]:bg-orange-500">
              Followers ({followers.length})
            </TabsTrigger>
            <TabsTrigger value="following" className="flex-1 data-[state=active]:bg-orange-500">
              Following ({following.length})
            </TabsTrigger>
          </TabsList>
          
          <ScrollArea className="h-[400px] mt-4">
            <TabsContent value="followers" className="mt-0">
              {renderUserList(followers)}
            </TabsContent>
            <TabsContent value="following" className="mt-0">
              {renderUserList(following)}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
