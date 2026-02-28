import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, History, BarChart3, Volume2, VolumeX, FileText, MessageCircle, Users, Map } from 'lucide-react';
import { useSoundContext } from '@/contexts/SoundContext';
import PublicChat from '@/pages/PublicChat';

export const FloatingMenu = () => {
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { soundEnabled, toggleSound } = useSoundContext();

  const isActive = (path: string) => location.pathname === path;

  // Hide FloatingMenu on connect page
  if (location.pathname === '/connect') {
    return null;
  }

  const menuItems = [
    {
      label: 'Posts',
      icon: FileText,
      path: '/posts',
    },
    {
      label: 'History',
      icon: History,
      path: '/history',
    },
    {
      label: 'Stats',
      icon: BarChart3,
      path: '/statistics',
    },
    {
      label: 'Active Users',
      icon: Users,
      path: '/active-users',
    },
    {
      label: 'Network Map',
      icon: Map,
      path: '/network-map',
    },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    setDesktopOpen(false);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Desktop - Right Side */}
      <div className="fixed bottom-6 right-6 z-50 hidden md:flex items-center gap-3">
        <Button
          size="lg"
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="rounded-full w-12 h-12 shadow-lg bg-orange-600 hover:bg-orange-700 text-white hover:scale-110 transition-transform"
        >
          <MessageCircle className="w-5 h-5" />
        </Button>

        <Popover open={desktopOpen} onOpenChange={setDesktopOpen}>
          <PopoverTrigger asChild>
            <Button
              size="lg"
              className="rounded-full w-12 h-12 shadow-lg bg-gradient-to-r from-primary to-secondary hover:scale-110 transition-transform"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            side="left" 
            align="end" 
            className="w-48 p-2 mr-2 z-[100]"
            sideOffset={8}
          >
            <div className="flex flex-col gap-1">
              {menuItems.map((item) => (
                <Button
                  key={item.path}
                  variant={isActive(item.path) ? 'secondary' : 'ghost'}
                  className="justify-start gap-2"
                  onClick={() => handleNavigation(item.path)}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          size="lg"
          onClick={toggleSound}
          className="rounded-full w-12 h-12 shadow-lg bg-gradient-to-r from-primary to-secondary hover:scale-110 transition-transform"
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile - Bottom Center */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden flex items-center gap-3">
        <Button
          size="lg"
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="rounded-full w-12 h-12 shadow-lg bg-orange-600 hover:bg-orange-700 text-white hover:scale-110 transition-transform"
        >
          <MessageCircle className="w-5 h-5" />
        </Button>

        <Popover open={mobileOpen} onOpenChange={setMobileOpen}>
          <PopoverTrigger asChild>
            <Button
              size="lg"
              className="rounded-full w-12 h-12 shadow-lg bg-gradient-to-r from-primary to-secondary hover:scale-110 transition-transform"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            side="top" 
            align="center" 
            className="w-48 p-2 mb-2 z-[100]"
            sideOffset={8}
          >
            <div className="flex flex-col gap-1">
              {menuItems.map((item) => (
                <Button
                  key={item.path}
                  variant={isActive(item.path) ? 'secondary' : 'ghost'}
                  className="justify-start gap-2"
                  onClick={() => handleNavigation(item.path)}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          size="lg"
          onClick={toggleSound}
          className="rounded-full w-12 h-12 shadow-lg bg-gradient-to-r from-primary to-secondary hover:scale-110 transition-transform"
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </Button>
      </div>

      {/* Chat Overlay */}
      {isChatOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-end md:items-center justify-center p-4"
          onClick={() => setIsChatOpen(false)}
        >
          <div 
            className="w-full max-w-2xl h-[80vh] md:h-[600px]"
            onClick={(e) => e.stopPropagation()}
          >
            <PublicChat onClose={() => setIsChatOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
};
