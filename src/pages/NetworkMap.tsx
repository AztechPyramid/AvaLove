import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BubbleMapNetwork from '@/components/statistics/BubbleMapNetwork';

const NetworkMap = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-sm border-b border-zinc-800">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              {/* Network Map icon (subtle, non-glowy) */}
              <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-5 h-5 text-foreground"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="2" fill="currentColor" />
                  <circle cx="6" cy="6" r="1.5" fill="currentColor" />
                  <circle cx="18" cy="6" r="1.5" fill="currentColor" />
                  <circle cx="6" cy="18" r="1.5" fill="currentColor" />
                  <circle cx="18" cy="18" r="1.5" fill="currentColor" />
                  <line x1="12" y1="10" x2="7" y2="7" />
                  <line x1="12" y1="10" x2="17" y2="7" />
                  <line x1="12" y1="14" x2="7" y2="17" />
                  <line x1="12" y1="14" x2="17" y2="17" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Network Map</h1>
                <p className="text-xs text-zinc-500">Real-time user connections</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Map - extends for scrolling on desktop */}
      <div className="min-h-[calc(100vh-64px)] h-auto">
        <div className="h-[calc(100vh-64px)] lg:h-[calc(100vh-64px)] xl:min-h-[900px]">
          <BubbleMapNetwork />
        </div>
      </div>
    </div>
  );
};

export default NetworkMap;
