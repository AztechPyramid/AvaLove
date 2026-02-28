import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Search, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface GifPickerProps {
  onGifSelected: (gifUrl: string) => void;
  onClose: () => void;
}

export const GifPicker = ({ onGifSelected, onClose }: GifPickerProps) => {
  const [searchQuery, setSearchQuery] = useState('arena');
  const [gifs, setGifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Auto-search for "arena" on mount
  useEffect(() => {
    searchGifs('arena');
  }, []);

  const searchGifs = async (query: string) => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      // Using Tenor API v2 with anonymous key
      const apiKey = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ';
      const limit = 20;
      const response = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${apiKey}&limit=${limit}&media_filter=gif`
      );

      if (!response.ok) throw new Error('Failed to fetch GIFs');

      const data = await response.json();
      setGifs(data.results || []);
    } catch (error) {
      console.error('Error fetching GIFs:', error);
      toast.error('Failed to load GIFs');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchGifs(searchQuery);
  };

  return (
    <Card className="p-4 bg-black border-orange-500/30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Search GIFs</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-zinc-800">
          <X size={18} />
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for GIFs..."
          className="flex-1 bg-zinc-900 border-zinc-800 text-white"
        />
        <Button type="submit" disabled={loading || !searchQuery.trim()} className="bg-orange-500 hover:bg-orange-600">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
        </Button>
      </form>

      <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto scrollbar-hide">
        {gifs.length === 0 && !loading && (
          <div className="col-span-2 text-center py-8 text-zinc-400">
            Search for GIFs to get started
          </div>
        )}
        {gifs.map((gif) => {
          const gifUrl = gif.media_formats?.gif?.url;
          const previewUrl = gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url;
          
          if (!gifUrl || !previewUrl) return null;
          
          return (
            <button
              key={gif.id}
              onClick={() => {
                onGifSelected(gifUrl);
                onClose();
              }}
              className="relative aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity hover:ring-2 hover:ring-orange-500"
            >
              <img
                src={previewUrl}
                alt={gif.content_description || 'GIF'}
                className="w-full h-full object-cover"
              />
            </button>
          );
        })}
      </div>

      <div className="mt-4 text-xs text-zinc-500 text-center">
        Powered by Tenor
      </div>
    </Card>
  );
};
