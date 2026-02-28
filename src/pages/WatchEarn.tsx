import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useWalletAuth } from "@/contexts/WalletAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Youtube, Search, Play, Plus, Clock, Heart, Check, Loader2, Link,
  Sparkles, TrendingUp, Eye, Zap, Video, Film
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import EmbeddedGamePlayer from "@/components/games/EmbeddedGamePlayer";
import { useFavoriteVideos } from "@/hooks/useFavoriteVideos";
import { AddVideoDialog } from "@/components/watch/AddVideoDialog";

interface WatchVideo {
  id: string;
  user_id: string;
  youtube_url: string;
  title: string;
  description: string | null;
  embed_id: string;
  views_count: number;
  cost: number;
  tx_hash: string | null;
  created_at: string;
  category: string;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

const VIDEOS_PER_PAGE = 12;

export default function WatchEarn() {
  const navigate = useNavigate();
  const { profile, isConnected } = useWalletAuth();
  const { isFavorite: isVideoFavorite, toggleFavorite: toggleVideoFavorite } = useFavoriteVideos();
  
  const [videos, setVideos] = useState<WatchVideo[]>([]);
  const [playingVideo, setPlayingVideo] = useState<WatchVideo | null>(null);
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState('');
  const [youtubeSearchResults, setYoutubeSearchResults] = useState<any[]>([]);
  const [isSearchingYoutube, setIsSearchingYoutube] = useState(false);
  const [watchSearchQuery, setWatchSearchQuery] = useState("");
  const [totalVideosCount, setTotalVideosCount] = useState(0);
  const [showFavorites, setShowFavorites] = useState(false);
  const [addedVideoIds, setAddedVideoIds] = useState<Set<string>>(new Set());
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const loaderRef = useRef<HTMLDivElement>(null);
  
  // State for AddVideoDialog from search results
  const [addVideoDialogOpen, setAddVideoDialogOpen] = useState(false);
  const [selectedVideoForAdd, setSelectedVideoForAdd] = useState<any>(null);

  useEffect(() => {
    if (!isConnected || !profile) {
      navigate('/connect');
      return;
    }
    fetchVideos(true);
  }, [isConnected, profile, navigate]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const existingEmbedIds = new Set(videos.map(v => v.embed_id));
    setAddedVideoIds(existingEmbedIds);
  }, [videos]);

  const fetchVideos = async (reset = false) => {
    if (isLoadingMore && !reset) return;
    
    try {
      setIsLoadingMore(true);
      const offset = reset ? 0 : videos.length;
      
      const { data, error, count } = await supabase
        .from('watch_videos')
        .select(`
          *,
          user:profiles!watch_videos_user_id_fkey(id, username, display_name, avatar_url)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + VIDEOS_PER_PAGE - 1);

      if (error) throw error;
      
      if (reset) {
        setVideos(data || []);
      } else {
        setVideos(prev => [...prev, ...(data || [])]);
      }
      
      setTotalVideosCount(count || 0);
      setHasMore((data?.length || 0) === VIDEOS_PER_PAGE);
    } catch (error) {
      console.error('Error fetching videos:', error);
      toast.error('Failed to load videos');
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !watchSearchQuery && !showFavorites) {
          fetchVideos(false);
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, watchSearchQuery, showFavorites]);

  const filteredVideos = videos.filter(video => {
    const matchesSearch = video.title.toLowerCase().includes(watchSearchQuery.toLowerCase()) ||
                        video.description?.toLowerCase().includes(watchSearchQuery.toLowerCase());
    const matchesFavorites = !showFavorites || isVideoFavorite(video.id);
    return matchesSearch && matchesFavorites;
  });

  const handleYoutubeSearch = async () => {
    if (!youtubeSearchQuery.trim()) {
      toast.error('Please enter a search term');
      return;
    }

    setIsSearchingYoutube(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-youtube', {
        body: { 
          query: youtubeSearchQuery,
          maxResults: 5
        }
      });

      if (error) throw error;
      setYoutubeSearchResults(data.videos || []);
      
      if (!data.videos || data.videos.length === 0) {
        toast.info('No videos found for your search');
      }
    } catch (error) {
      console.error('Error searching YouTube:', error);
      toast.error('Failed to search YouTube');
    } finally {
      setIsSearchingYoutube(false);
    }
  };

  const handlePlayYoutubeVideo = async (video: any) => {
    // Just play the video without auto-adding to platform
    // User must explicitly use Add button to pay and add video
    const tempVideo: WatchVideo = {
      id: 'temp-' + video.id,
      user_id: profile?.id || '',
      youtube_url: `https://www.youtube.com/watch?v=${video.id}`,
      title: video.title,
      description: video.description || null,
      embed_id: video.id,
      views_count: 0,
      cost: 0,
      tx_hash: null,
      created_at: new Date().toISOString(),
      category: 'Entertainment',
      user: {
        id: profile?.id || '',
        username: profile?.username || '',
        display_name: profile?.display_name || null,
        avatar_url: profile?.avatar_url || null
      }
    };
    setPlayingVideo(tempVideo);
  };

  const handleOpenAddDialog = (video: any, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!profile?.id) {
      toast.error('Please connect your wallet');
      return;
    }

    if (addedVideoIds.has(video.id)) {
      toast.info('This video is already on the platform');
      return;
    }

    // Set video info and open dialog
    setSelectedVideoForAdd({
      id: video.id,
      title: video.title,
      description: video.description || '',
      thumbnail: video.thumbnail,
      channelTitle: video.channelTitle
    });
    setAddVideoDialogOpen(true);
  };

  const handleVideoAdded = () => {
    // Mark video as added
    if (selectedVideoForAdd) {
      setAddedVideoIds(prev => new Set([...prev, selectedVideoForAdd.id]));
    }
    setAddVideoDialogOpen(false);
    setSelectedVideoForAdd(null);
    fetchVideos(true);
  };

  const stats = [
    { value: totalVideosCount.toString(), label: "Videos", icon: Video, color: "#ec4899" },
    { value: "∞", label: "Rewards", icon: Zap, color: "#eab308" },
    { value: "HD", label: "Quality", icon: Film, color: "#a855f7" },
    { value: "24/7", label: "Streaming", icon: Clock, color: "#06b6d4" },
  ];

  if (playingVideo) {
    return (
      <EmbeddedGamePlayer
        gameId={playingVideo.id}
        gameTitle={playingVideo.title}
        gameIframe={`https://www.youtube.com/embed/${playingVideo.embed_id}?autoplay=1&rel=0&modestbranding=1`}
        onClose={() => {
          setPlayingVideo(null);
          fetchVideos(true);
        }}
        onGameEnd={() => {
          fetchVideos(true);
        }}
        isWatchMode
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(236, 72, 153, 0.15) 1px, transparent 1px),
              linear-gradient(90deg, rgba(236, 72, 153, 0.15) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
        
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full blur-[100px] opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(236, 72, 153, 0.4), transparent 70%)",
            left: mousePosition.x - 200,
            top: mousePosition.y - 200,
          }}
        />
        
        <motion.div
          className="absolute top-20 right-20 w-[300px] h-[300px] rounded-full blur-[80px]"
          animate={{
            background: [
              "radial-gradient(circle, rgba(236, 72, 153, 0.2), transparent 70%)",
              "radial-gradient(circle, rgba(249, 115, 22, 0.2), transparent 70%)",
              "radial-gradient(circle, rgba(236, 72, 153, 0.2), transparent 70%)",
            ],
          }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        
        <motion.div
          className="absolute bottom-20 left-20 w-[250px] h-[250px] rounded-full blur-[60px]"
          animate={{
            background: [
              "radial-gradient(circle, rgba(168, 85, 247, 0.2), transparent 70%)",
              "radial-gradient(circle, rgba(6, 182, 212, 0.2), transparent 70%)",
              "radial-gradient(circle, rgba(168, 85, 247, 0.2), transparent 70%)",
            ],
          }}
          transition={{ duration: 5, repeat: Infinity }}
        />
      </div>

      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <motion.div
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <Play className="w-7 h-7 text-white" />
            </motion.div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-black">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-orange-500 to-pink-600">
                  Watch & Earn
                </span>
              </h1>
              <p className="text-white/60 text-sm flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                Earn AVLO tokens while watching videos
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i }}
                className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all group"
              >
                <stat.icon className="w-5 h-5 mb-2 transition-colors" style={{ color: stat.color }} />
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-white/50 uppercase tracking-wide">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Add Video with AVLO Credits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <Card className="bg-white/5 border-white/10 overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center">
                    <Video className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Add Video to Platform</h3>
                    <p className="text-xs text-white/50">Spend AVLO credits to add videos for everyone</p>
                  </div>
                </div>
                <AddVideoDialog onVideoAdded={() => fetchVideos(true)} />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* YouTube Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <Card className="bg-white/5 border-white/10 overflow-hidden">
            <CardContent className="p-5">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                  <Search className="h-4 w-4 text-white" />
                </div>
                Search YouTube & Add to Platform
              </h3>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    placeholder="Search for videos (e.g., 'music', 'news', 'gaming')"
                    value={youtubeSearchQuery}
                    onChange={(e) => setYoutubeSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleYoutubeSearch()}
                    className="pl-11 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl h-12 focus:border-red-500/50"
                  />
                </div>
                <Button 
                  onClick={handleYoutubeSearch}
                  disabled={isSearchingYoutube}
                  className="h-12 px-6 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-xl"
                >
                  {isSearchingYoutube ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {youtubeSearchResults.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
                  {youtubeSearchResults.map((video, index) => {
                    const isAdded = addedVideoIds.has(video.id);
                    
                    return (
                      <motion.div
                        key={video.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card 
                          className="overflow-hidden cursor-pointer bg-white/5 border-white/10 hover:border-pink-500/50 transition-all group"
                          onClick={() => handlePlayYoutubeVideo(video)}
                        >
                          <div className="relative">
                            <img 
                              src={video.thumbnail} 
                              alt={video.title}
                              className="w-full h-28 object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {video.viewCount && parseInt(video.viewCount) > 0 && (
                              <div className="absolute top-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {parseInt(video.viewCount).toLocaleString()}
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <Play className="h-6 w-6 text-white ml-1" />
                              </div>
                            </div>
                          </div>
                          <div className="p-3">
                            <h4 className="font-semibold line-clamp-2 mb-1 text-white text-sm group-hover:text-pink-400 transition-colors">{video.title}</h4>
                            <p className="text-xs text-white/50 mb-3">{video.channelTitle}</p>
                            
                            <Button
                              size="sm"
                              className={`w-full rounded-lg ${
                                isAdded 
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30' 
                                  : 'bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white'
                              }`}
                              onClick={(e) => handleOpenAddDialog(video, e)}
                              disabled={isAdded}
                            >
                              {isAdded ? (
                                <Check className="h-3 w-3 mr-1" />
                              ) : (
                                <Plus className="h-3 w-3 mr-1" />
                              )}
                              {isAdded ? 'Added' : 'Add'}
                            </Button>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Platform Videos Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-pink-400" />
              Community Videos
            </h2>
            <div className="flex gap-2">
              <Button
                variant={showFavorites ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFavorites(!showFavorites)}
                className={`rounded-full ${
                  showFavorites 
                    ? "bg-gradient-to-r from-red-500 to-pink-500 border-0" 
                    : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                }`}
              >
                <Heart className={`w-4 h-4 mr-1 ${showFavorites ? 'fill-white' : ''}`} />
                Favorites
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              placeholder="Search community videos..."
              value={watchSearchQuery}
              onChange={(e) => setWatchSearchQuery(e.target.value)}
              className="pl-11 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl h-12 focus:border-pink-500/50"
            />
          </div>

          {/* Videos Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredVideos.map((video, index) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
              >
                <Card
                  className="bg-white/5 border-white/10 overflow-hidden hover:border-pink-500/50 transition-all cursor-pointer group relative"
                  onClick={() => setPlayingVideo(video)}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-black/80 rounded-full w-8 h-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVideoFavorite(video.id);
                    }}
                  >
                    <Heart 
                      className={`w-4 h-4 ${isVideoFavorite(video.id) ? 'fill-red-500 text-red-500' : 'text-white/60'}`}
                    />
                  </Button>
                  <div className="aspect-video bg-gradient-to-br from-pink-900/20 to-orange-900/20 flex items-center justify-center overflow-hidden relative">
                    <img 
                      src={`https://img.youtube.com/vi/${video.embed_id}/hqdefault.jpg`}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Play className="h-7 w-7 text-white ml-1" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-1">
                      <Eye className="w-3 h-3 text-white/60" />
                      <span className="text-xs text-white/80">{video.views_count}</span>
                    </div>
                  </div>
                  <CardContent className="p-3 bg-black/50">
                    <h3 className="text-sm font-semibold text-white group-hover:text-pink-400 transition-colors line-clamp-2 mb-2">
                      {video.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-5 h-5">
                        <AvatarImage src={video.user?.avatar_url || ''} />
                        <AvatarFallback className="bg-pink-500/20 text-pink-400 text-[10px]">
                          {video.user?.username?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-white/50 truncate">
                        {video.user?.display_name || video.user?.username || 'Anonymous'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Loader */}
          {hasMore && !showFavorites && !watchSearchQuery && (
            <div ref={loaderRef} className="flex justify-center py-8">
              {isLoadingMore && (
                <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* AddVideoDialog for search results */}
      <AddVideoDialog
        initialVideoInfo={selectedVideoForAdd}
        externalOpen={addVideoDialogOpen}
        onExternalOpenChange={setAddVideoDialogOpen}
        onVideoAdded={handleVideoAdded}
      />
    </div>
  );
}
