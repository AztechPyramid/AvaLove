import { useState, useEffect } from 'react';
import { Users, UserPlus, UserMinus, Search, Loader2, RefreshCw, Crown, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  handle: string;
  userName: string;
  profilePicture?: string;
  followerCount?: number;
}

const PAGE_SIZE = 25;

interface AgentSocialTabProps {
  agentId: string;
  isVerified: boolean;
}

export const AgentSocialTab = ({ agentId, isVerified }: AgentSocialTabProps) => {
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [topUsers, setTopUsers] = useState<User[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('followers');
  const [communityId, setCommunityId] = useState('');
  const [followerPage, setFollowerPage] = useState(1);
  const [followingPage, setFollowingPage] = useState(1);
  const [topPage, setTopPage] = useState(1);
  const [communityPage, setCommunityPage] = useState(1);

  useEffect(() => {
    fetchSocialData();
  }, [agentId]);

  const fetchSocialData = async () => {
    setIsLoading(true);
    try {
      const [followersRes, followingRes, topRes, communitiesRes] = await Promise.all([
        supabase.functions.invoke('arena-agent', { body: { action: 'get_followers', agentId } }),
        supabase.functions.invoke('arena-agent', { body: { action: 'get_following', agentId } }),
        supabase.functions.invoke('arena-agent', { body: { action: 'get_top_users', agentId } }),
        supabase.functions.invoke('arena-agent', { body: { action: 'get_communities', agentId } })
      ]);

      setFollowers((followersRes.data?.followers || []).map((f: any) => f.follower || f));
      setFollowing((followingRes.data?.following || []).map((f: any) => f.following || f));
      setTopUsers(topRes.data?.users || []);
      setCommunities(communitiesRes.data?.communities || []);
      setFollowerPage(1);
      setFollowingPage(1);
      setTopPage(1);
      setCommunityPage(1);
    } catch (error) {
      console.error('Error fetching social data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'search_users', agentId, query: searchQuery }
      });
      if (error) throw error;
      setSearchResults(data?.users || []);
    } catch { toast.error('Search failed'); }
    finally { setIsSearching(false); }
  };

  const handleFollow = async (userId: string) => {
    if (!isVerified) return;
    try {
      await supabase.functions.invoke('arena-agent', { body: { action: 'follow', agentId, targetUserId: userId } });
      toast.success('Followed!');
      fetchSocialData();
    } catch { toast.error('Failed to follow'); }
  };

  const handleUnfollow = async (userId: string) => {
    if (!isVerified) return;
    try {
      await supabase.functions.invoke('arena-agent', { body: { action: 'unfollow', agentId, targetUserId: userId } });
      toast.success('Unfollowed!');
      fetchSocialData();
    } catch { toast.error('Failed to unfollow'); }
  };

  const handleFollowCommunity = async () => {
    if (!communityId.trim() || !isVerified) return;
    try {
      await supabase.functions.invoke('arena-agent', { body: { action: 'follow_community', agentId, communityId: communityId.trim() } });
      toast.success('Community followed!');
      setCommunityId('');
    } catch { toast.error('Failed to follow community'); }
  };

  const handleUnfollowCommunity = async () => {
    if (!communityId.trim() || !isVerified) return;
    try {
      await supabase.functions.invoke('arena-agent', { body: { action: 'unfollow_community', agentId, communityId: communityId.trim() } });
      toast.success('Community unfollowed!');
      setCommunityId('');
    } catch { toast.error('Failed to unfollow community'); }
  };

  const isFollowingUser = (userId: string) => following.some((u) => u.id === userId);

  const handleJoinCommunity = async (commId: string) => {
    if (!isVerified) return;
    try {
      await supabase.functions.invoke('arena-agent', { body: { action: 'join_community', agentId, communityId: commId } });
      toast.success('Joined community!');
    } catch { toast.error('Failed to join'); }
  };

  const PaginationControls = ({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (p: number) => void }) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 pt-3">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs text-zinc-400">{page} / {totalPages}</span>
        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  const UserCard = ({ user, showFollowButton = true }: { user: User; showFollowButton?: boolean }) => (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardContent className="py-3 px-3 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Avatar className="w-9 h-9 sm:w-10 sm:h-10 shrink-0">
              {user.profilePicture && <AvatarImage src={user.profilePicture} />}
              <AvatarFallback className="bg-cyan-500/20 text-cyan-400 text-xs">
                {user.userName?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-white text-sm truncate">{user.userName}</p>
              <p className="text-xs text-zinc-500 truncate">@{user.handle}</p>
            </div>
          </div>
          {showFollowButton && isVerified && (
            isFollowingUser(user.id) ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUnfollow(user.id)}
                className="border-zinc-700 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 shrink-0 text-xs h-8"
              >
                <UserMinus className="w-3.5 h-3.5 mr-1" />
                <span className="hidden sm:inline">Unfollow</span>
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => handleFollow(user.id)}
                className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 shrink-0 text-xs h-8"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1" />
                <span className="hidden sm:inline">Follow</span>
              </Button>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );

  const paginatedFollowers = followers.slice((followerPage - 1) * PAGE_SIZE, followerPage * PAGE_SIZE);
  const paginatedFollowing = following.slice((followingPage - 1) * PAGE_SIZE, followingPage * PAGE_SIZE);
  const paginatedTop = topUsers.slice((topPage - 1) * PAGE_SIZE, topPage * PAGE_SIZE);
  const paginatedCommunities = communities.slice((communityPage - 1) * PAGE_SIZE, communityPage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Search */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="py-3 px-3 sm:px-6">
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="bg-zinc-800/50 border-zinc-700 text-white text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isSearching} size="sm">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Community Follow */}
      {isVerified && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="py-3 px-3 sm:px-6">
            <p className="text-xs text-zinc-400 mb-2 flex items-center gap-1"><Globe className="w-3 h-3" /> Community Follow</p>
            <div className="flex gap-2">
              <Input
                value={communityId}
                onChange={(e) => setCommunityId(e.target.value)}
                placeholder="Community ID..."
                className="bg-zinc-800/50 border-zinc-700 text-white text-xs sm:text-sm"
              />
              <Button size="sm" onClick={handleFollowCommunity} className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 shrink-0 text-xs h-8">
                Follow
              </Button>
              <Button size="sm" variant="outline" onClick={handleUnfollowCommunity} className="border-zinc-700 text-zinc-400 shrink-0 text-xs h-8">
                Unfollow
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-400">Search Results</h3>
          {searchResults.map((user) => <UserCard key={user.id} user={user} />)}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList className="bg-zinc-900/50 border border-zinc-800">
            <TabsTrigger value="followers" className="text-white data-[state=active]:bg-cyan-500/20 text-xs sm:text-sm">
              <Users className="w-4 h-4 mr-1" />
              ({followers.length})
            </TabsTrigger>
            <TabsTrigger value="following" className="text-white data-[state=active]:bg-cyan-500/20 text-xs sm:text-sm">
              <span className="hidden sm:inline">Following</span> ({following.length})
            </TabsTrigger>
            <TabsTrigger value="top" className="text-white data-[state=active]:bg-yellow-500/20 text-xs sm:text-sm">
              <Crown className="w-4 h-4 mr-1" />
              Top
            </TabsTrigger>
            <TabsTrigger value="communities" className="text-white data-[state=active]:bg-purple-500/20 text-xs sm:text-sm">
              <Globe className="w-4 h-4 mr-1" />
              Communities
            </TabsTrigger>
          </TabsList>
          <Button variant="ghost" size="sm" onClick={fetchSocialData} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <TabsContent value="followers" className="mt-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-cyan-500 animate-spin" /></div>
          ) : followers.length === 0 ? (
            <Card className="bg-zinc-900/50 border-zinc-800"><CardContent className="py-8 text-center text-zinc-400">No followers yet</CardContent></Card>
          ) : (
            <>
              {paginatedFollowers.map((user) => <UserCard key={user.id} user={user} />)}
              <PaginationControls page={followerPage} totalPages={Math.ceil(followers.length / PAGE_SIZE)} setPage={setFollowerPage} />
            </>
          )}
        </TabsContent>

        <TabsContent value="following" className="mt-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-cyan-500 animate-spin" /></div>
          ) : following.length === 0 ? (
            <Card className="bg-zinc-900/50 border-zinc-800"><CardContent className="py-8 text-center text-zinc-400">Not following anyone</CardContent></Card>
          ) : (
            <>
              {paginatedFollowing.map((user) => <UserCard key={user.id} user={user} showFollowButton={false} />)}
              <PaginationControls page={followingPage} totalPages={Math.ceil(following.length / PAGE_SIZE)} setPage={setFollowingPage} />
            </>
          )}
        </TabsContent>

        <TabsContent value="top" className="mt-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-yellow-500 animate-spin" /></div>
          ) : topUsers.length === 0 ? (
            <Card className="bg-zinc-900/50 border-zinc-800"><CardContent className="py-8 text-center text-zinc-400">No top users found</CardContent></Card>
          ) : (
            <>
              {paginatedTop.map((user, i) => (
                <Card key={user.id} className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="py-3 px-3 sm:px-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <span className="text-xs text-yellow-400 font-bold w-5 shrink-0">#{(topPage - 1) * PAGE_SIZE + i + 1}</span>
                        <Avatar className="w-9 h-9 sm:w-10 sm:h-10 shrink-0">
                          {user.profilePicture && <AvatarImage src={user.profilePicture} />}
                          <AvatarFallback className="bg-yellow-500/20 text-yellow-400 text-xs">
                            {user.userName?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-white text-sm truncate">{user.userName}</p>
                          <p className="text-xs text-zinc-500 truncate">@{user.handle} · {user.followerCount || 0}</p>
                        </div>
                      </div>
                      {isVerified && !isFollowingUser(user.id) && (
                        <Button size="sm" onClick={() => handleFollow(user.id)} className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 shrink-0 text-xs h-8">
                          <UserPlus className="w-3.5 h-3.5 mr-1" />
                          <span className="hidden sm:inline">Follow</span>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              <PaginationControls page={topPage} totalPages={Math.ceil(topUsers.length / PAGE_SIZE)} setPage={setTopPage} />
            </>
          )}
        </TabsContent>

        <TabsContent value="communities" className="mt-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-purple-500 animate-spin" /></div>
          ) : communities.length === 0 ? (
            <Card className="bg-zinc-900/50 border-zinc-800"><CardContent className="py-8 text-center text-zinc-400">No communities found</CardContent></Card>
          ) : (
            <>
              {paginatedCommunities.map((comm) => (
                <Card key={comm.id} className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="py-3 px-3 sm:px-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <Avatar className="w-9 h-9 sm:w-10 sm:h-10 shrink-0">
                          {comm.picture && <AvatarImage src={comm.picture} />}
                          <AvatarFallback className="bg-purple-500/20 text-purple-400 text-xs">
                            {comm.name?.charAt(0) || 'C'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-white text-sm truncate">{comm.name}</p>
                          <p className="text-xs text-zinc-500 truncate">{comm.memberCount || 0} members</p>
                        </div>
                      </div>
                      {isVerified && (
                        <Button size="sm" onClick={() => handleJoinCommunity(comm.id)} className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 shrink-0 text-xs h-8">
                          Join
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              <PaginationControls page={communityPage} totalPages={Math.ceil(communities.length / PAGE_SIZE)} setPage={setCommunityPage} />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
