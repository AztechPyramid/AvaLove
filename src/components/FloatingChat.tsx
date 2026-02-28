import { useState, createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import PublicChat from '@/pages/PublicChat';
import { useIsMobile } from '@/hooks/use-mobile';

// Context for staking pages to override the chat room
interface StakingChatContextType {
  stakingRoomId: string | null;
  stakingRoomTitle: string | null;
  setStakingRoom: (roomId: string | null, roomTitle: string | null) => void;
}

const StakingChatContext = createContext<StakingChatContextType | null>(null);

export function useStakingChat() {
  return useContext(StakingChatContext);
}

export function StakingChatProvider({ children }: { children: React.ReactNode }) {
  const [stakingRoomId, setStakingRoomId] = useState<string | null>(null);
  const [stakingRoomTitle, setStakingRoomTitle] = useState<string | null>(null);

  const setStakingRoom = (roomId: string | null, roomTitle: string | null) => {
    setStakingRoomId(roomId);
    setStakingRoomTitle(roomTitle);
  };

  return (
    <StakingChatContext.Provider value={{ stakingRoomId, stakingRoomTitle, setStakingRoom }}>
      {children}
    </StakingChatContext.Provider>
  );
}

interface FloatingChatProps {
  /** If true, shows chat in sidebar instead of floating button (for specific pages) */
  showSidebar?: boolean;
  /** Adds a top spacer (e.g. for fullscreen HUD bars) so the chat header/tabs stay clickable */
  topSpacer?: boolean;
  /** Optional callback when chat is closed */
  onChatClose?: () => void;
  /** Optional room ID for specific chat room */
  roomId?: string;
  /** Optional room title */
  roomTitle?: string;
  /** If true, this is the global chat (not page-specific) */
  isGlobal?: boolean;
}

export default function FloatingChat({ showSidebar = false, topSpacer = false, onChatClose, roomId, roomTitle, isGlobal = false }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();
  const stakingChat = useStakingChat();

  // Use staking room override if on staking page and staking room is set
  const isStakingPage = location.pathname === '/staking';
  const effectiveRoomId = isStakingPage && stakingChat?.stakingRoomId ? stakingChat.stakingRoomId : roomId;
  const effectiveRoomTitle = isStakingPage && stakingChat?.stakingRoomTitle ? stakingChat.stakingRoomTitle : roomTitle;

  // Hide global chat on pages that have their own chat or fullscreen modes
  const pagesWithOwnChat = ['/loveart'];
  const fullscreenMobilePages = ['/mini-games', '/watch-earn'];

  const matchesAnyPath = (paths: string[]) =>
    paths.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));

  if (isGlobal && matchesAnyPath(pagesWithOwnChat)) {
    return null;
  }

  // Hide mobile global chat on fullscreen pages (games, videos)
  if (isGlobal && isMobile && matchesAnyPath(fullscreenMobilePages)) {
    return null;
  }

  const handleClose = () => {
    setIsOpen(false);
    onChatClose?.();
  };

  // Page-specific sidebar mode (games, videos)
  if (showSidebar && !isMobile) {
    return (
      <div className="h-screen w-80 flex-shrink-0 border-l border-zinc-800 bg-black relative z-30 flex flex-col">
        {topSpacer && <div className="h-16 flex-shrink-0" />}
        <div className="flex-1 w-full overflow-hidden">
          <PublicChat onClose={onChatClose} initialRoomId={effectiveRoomId} initialRoomTitle={effectiveRoomTitle} />
        </div>
      </div>
    );
  }

  // Global chat - Desktop: Always visible right sidebar
  if (isGlobal && !isMobile) {
    return (
      <div className="hidden md:flex h-screen w-80 flex-shrink-0 border-l border-zinc-800 bg-black">
        <div className="w-full h-full overflow-hidden pt-16">
          <PublicChat onClose={onChatClose} initialRoomId={effectiveRoomId} initialRoomTitle={effectiveRoomTitle} />
        </div>
      </div>
    );
  }

  // Global chat - Mobile: Floating button with right-side drawer
  if (isGlobal && isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 border-2 border-orange-400/20"
            size="icon"
          >
            <MessageCircle className="h-6 w-6 text-white" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500 items-center justify-center text-[10px] text-white font-bold">💬</span>
            </span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[85vw] max-w-[350px] p-0 bg-black border-zinc-800">
          <div className="h-full overflow-hidden">
            <PublicChat onClose={handleClose} initialRoomId={effectiveRoomId} initialRoomTitle={effectiveRoomTitle} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Non-global, non-sidebar: return null (handled by page-specific implementations)
  return null;
}
