import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Gamepad2, PlayCircle } from 'lucide-react';

interface RandomGame {
  id: string;
  title: string;
  thumbnail: string;
  category: string;
}

interface RandomVideo {
  id: string;
  title: string;
  embed_id: string;
  views_count: number | null;
}

export const RandomGameVideo = () => {
  const [game, setGame] = useState<RandomGame | null>(null);
  const [video, setVideo] = useState<RandomVideo | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRandomGameAndVideo();
  }, []);

  const fetchRandomGameAndVideo = async () => {
    try {
      // Fetch random game
      const { data: gamesData } = await supabase
        .from('online_games')
        .select('id, title, thumbnail, category');

      if (gamesData && gamesData.length > 0) {
        const randomGame = gamesData[Math.floor(Math.random() * gamesData.length)];
        setGame(randomGame);
      }

      // Fetch random video
      const { data: videosData } = await supabase
        .from('watch_videos')
        .select('id, title, embed_id, views_count');

      if (videosData && videosData.length > 0) {
        const randomVideo = videosData[Math.floor(Math.random() * videosData.length)];
        setVideo(randomVideo);
      }
    } catch (error) {
      console.error('Error fetching random game/video:', error);
    }
  };

  return (
    <div className="w-full space-y-3 mt-4">
      {/* Random Game */}
      {game && (
        <Card 
          onClick={() => navigate('/mini-games')}
          className="bg-zinc-900/50 border-zinc-700/50 p-3 cursor-pointer hover:bg-zinc-900/70 transition-colors"
        >
          <div className="flex items-center gap-3">
            <img 
              src={game.thumbnail} 
              alt={game.title}
              className="w-20 h-20 rounded-lg object-cover"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Gamepad2 className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold text-blue-400">Play to Earn</span>
              </div>
              <h4 className="text-sm font-semibold text-white truncate">{game.title}</h4>
              <p className="text-xs text-zinc-400">{game.category}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Random Video */}
      {video && (
        <Card 
          onClick={() => navigate('/watch-earn')}
          className="bg-zinc-900/50 border-zinc-700/50 p-3 cursor-pointer hover:bg-zinc-900/70 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-black">
              <img 
                src={`https://img.youtube.com/vi/${video.embed_id}/mqdefault.jpg`}
                alt={video.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <PlayCircle className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <PlayCircle className="w-4 h-4 text-red-500" />
                <span className="text-xs font-semibold text-red-400">Watch to Earn</span>
              </div>
              <h4 className="text-sm font-semibold text-white line-clamp-2">{video.title}</h4>
              <p className="text-xs text-zinc-400">{video.views_count || 0} views</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};