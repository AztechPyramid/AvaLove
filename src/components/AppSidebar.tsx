import { useNavigate, useLocation } from "react-router-dom";
import { Heart, FileText, User, History, BarChart3, Coins, Gift, HelpCircle, LogOut, Bell, Flame, Star, MessageCircle, Mail, VolumeX, Users, Award, Sparkles, Gamepad2, Youtube, Play, Trophy, Wallet, Crown, Shield, Package, ChevronDown, ChevronUp, Scan, Search, PanelLeft, Menu, Bot, Vote, BookOpen, ArrowUpDown, Radio, TrendingUp, MoreHorizontal, Map, Hammer } from "lucide-react";
import { ArenaArchLogo } from "@/components/ArenaArchLogo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import logo from '@/assets/avalove-logo.jpg';
import { useWalletAuth } from "@/contexts/WalletAuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useNotifications } from "@/hooks/useNotifications";
import { useStreak } from "@/hooks/useStreak";
import { useUserLevel } from "@/hooks/useUserLevel";
import { useSoundContext } from "@/contexts/SoundContext";
import { useBadges } from "@/hooks/useBadges";
import { useAvloBalance } from "@/hooks/useAvloBalance";
import { useState, useEffect } from "react";
import PublicChat from "@/pages/PublicChat";
import { NotificationCenter } from "@/components/NotificationCenter";
import { LevelBadgeDisplay } from "@/components/LevelBadgeDisplay";
import * as LucideIcons from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { usePendingMatchesCount } from "@/hooks/usePendingMatchesCount";
import { BlackJackIcon } from "@/components/icons/BlackJackIcon";
import { AvloAIIconCompact } from "@/components/icons/AvloAIIcon";

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const { disconnectWallet, walletAddress, profile } = useWalletAuth();
  const { notifications: allNotifications, markAllAsRead } = useNotifications();
  const { streak } = useStreak();
  const { userLevel, xpProgress } = useUserLevel();
  const { soundEnabled, toggleSound } = useSoundContext();
  const { userBadges, loading: badgesLoading } = useBadges(profile?.id);
  const { balance: unpaidBalance } = useAvloBalance();
  const { totalCount: pendingMatchesTotal } = usePendingMatchesCount();
  
  const [isPublicChatOpen, setIsPublicChatOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [matchesCount, setMatchesCount] = useState(0);
  const [selectedBadge, setSelectedBadge] = useState<any>(null);
  const [airdropScore, setAirdropScore] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isCollapsed = state === "collapsed";
  const unreadCount = allNotifications?.filter(n => !n.read).length || 0;
  const unreadMessages = allNotifications?.filter(n => !n.read && n.type === 'message').length || 0;

  useEffect(() => {
    if (profile?.id) {
      fetchMatchesCount();
      fetchAirdropScore();
      checkAdminRole();
    }
  }, [profile?.id, location.pathname]);

  // Poll score every 60s instead of realtime
  useEffect(() => {
    if (!profile?.id) return;
    const interval = setInterval(fetchAirdropScore, 60000);
    return () => clearInterval(interval);
  }, [profile?.id]);

  const checkAdminRole = async () => {
    if (!profile?.id) return;
    
    try {
      const { data: hasAdminRole } = await supabase.rpc('has_role', {
        _user_id: profile.id,
        _role: 'admin'
      });
      setIsAdmin(hasAdminRole === true);
    } catch (error) {
      console.error('Error checking admin role:', error);
      setIsAdmin(false);
    }
  };

  const fetchMatchesCount = async () => {
    if (!profile?.id) return;
    
    try {
      const { count, error } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`);

      if (error) throw error;
      setMatchesCount(count || 0);
    } catch (error) {
      console.error('Error fetching matches count:', error);
    }
  };

  const fetchAirdropScore = async () => {
    if (!profile?.id) return;
    
    try {
      const { getAvloTokenId } = await import('@/lib/avloTokenCache');
      const avloTokenId = await getAvloTokenId();
      if (!avloTokenId) return;

      const { data: userScoreData } = await supabase
        .from('user_scores')
        .select('total_score')
        .eq('user_id', profile.id)
        .eq('token_id', avloTokenId)
        .maybeSingle();

      setAirdropScore(userScoreData?.total_score || 0);
    } catch (error) {
      console.error('Error fetching airdrop score:', error);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    navigate('/connect');
  };

  const handleMatchesClick = () => {
    navigate('/matches');
  };
  
  const handlePublicChatClick = () => {
    setIsPublicChatOpen(true);
  };

  const handleNotificationsClick = () => {
    setIsNotificationsOpen(true);
  };

  const [moreExpanded, setMoreExpanded] = useState(false);

  // Main menu items - Wallet removed (integrated into profile panel)
  const mainMenuItems = [
    { title: "Discover", url: "/", icon: Heart, color: "text-orange-500" },
    { title: "Swap", url: "/swap", icon: ArrowUpDown, color: "text-green-500", greenBadge: "Earn", glowing: true, glowColor: 'emerald' },
    { title: "Create AI", url: "/ava-ai", icon: Bot, color: "text-cyan-500", greenBadge: "Beta", customIcon: true, customIconType: 'avloai', glowing: true, glowColor: 'cyan' },
    { title: "Your Agents", url: "/your-agents", icon: Bot, color: "text-purple-500", greenBadge: "New", customIcon: true, customIconType: 'youragents', glowing: true, glowColor: 'cyan' },
    { title: "Stake & Create", url: "/staking", icon: Coins, color: "text-orange-500", glowing: true },
    { title: "Games", url: "/mini-games", icon: Gamepad2, color: "text-orange-500", greenBadge: "Earn" },
    { title: "Watch", url: "/watch-earn", icon: Play, color: "text-pink-500", greenBadge: "Earn" },
    { title: "Rewards", url: "/reward-tracker", icon: Gift, color: "text-purple-500", rightText: `${unpaidBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
    { title: "Posts", url: "/posts", icon: FileText, color: "text-pink-500" },
    { title: "LoveArt", url: "/loveart", icon: Sparkles, color: "text-orange-500" },
    { title: "BlackJack", url: "/blackjack", icon: Sparkles, color: "text-emerald-500", greenBadge: "21", customIcon: true },
    { title: "LoveFi", url: "/lovefi", icon: TrendingUp, color: "text-emerald-500", greenBadge: "DeFi" },
    { title: "Leaderboard", url: "/airdrop", icon: Trophy, color: "text-pink-500", rightText: airdropScore.toLocaleString() },
    { title: "Network Map", url: "/network-map", icon: Map, color: "text-emerald-500" },
  ];

  // More section items - DAO and LoveBot moved here
  const moreMenuItems = [
    { title: "DAO", url: "/dao", icon: Vote, color: "text-cyan-500" },
    { title: "LoveBot", url: "/love-ai", icon: Bot, color: "text-cyan-500" },
    { title: "Statistics", url: "/statistics", icon: BarChart3, color: "text-orange-500" },
    { title: "Referrals", url: "/referral", icon: Users, color: "text-cyan-500" },
    { title: "AvaScan", url: "/avascan", icon: Scan, color: "text-orange-500" },
    { title: "Docs", url: "/docs", icon: BookOpen, color: "text-emerald-500" },
  ];

  const NavButton = ({ item, compact = false }: { item: typeof mainMenuItems[0], compact?: boolean }) => {
    const isGlowing = 'glowing' in item && item.glowing;
    const button = (
      <button
        onClick={() => navigate(item.url)}
        className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
          isActive(item.url) 
            ? 'bg-zinc-800/80 text-white' 
            : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
        } ${isCollapsed ? 'justify-center !px-0' : ''} ${isGlowing ? 'group/stake' : ''}`}
      >
        {/* Glowing border animation */}
        {isGlowing && (
          <>
            {item.glowColor === 'emerald' ? (
              <>
                <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/0 via-emerald-500/25 to-emerald-500/0 bg-[length:200%_100%] animate-[shimmer_2.5s_linear_infinite] pointer-events-none" />
                <span className="absolute inset-[1px] rounded-[7px] bg-black pointer-events-none" />
                <span className="absolute -inset-[1px] rounded-lg opacity-60 blur-sm bg-gradient-to-r from-emerald-500/0 via-emerald-400/35 to-emerald-500/0 bg-[length:200%_100%] animate-[shimmer_2.5s_linear_infinite] pointer-events-none" />
              </>
            ) : item.glowColor === 'cyan' ? (
              <>
                <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/0 via-cyan-500/25 to-purple-500/0 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite] pointer-events-none" />
                <span className="absolute inset-[1px] rounded-[7px] bg-black pointer-events-none" />
                <span className="absolute -inset-[1px] rounded-lg opacity-60 blur-sm bg-gradient-to-r from-cyan-500/0 via-cyan-400/30 to-purple-400/0 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite] pointer-events-none" />
              </>
            ) : (
              <>
                <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-500/0 via-orange-500/20 to-amber-500/0 bg-[length:200%_100%] animate-[shimmer_3s_linear_infinite] pointer-events-none" />
                <span className="absolute inset-[1px] rounded-[7px] bg-black pointer-events-none" />
                <span className="absolute -inset-[1px] rounded-lg opacity-60 blur-sm bg-gradient-to-r from-orange-500/0 via-orange-400/30 to-amber-500/0 bg-[length:200%_100%] animate-[shimmer_3s_linear_infinite] pointer-events-none" />
              </>
            )}
          </>
        )}
        <div className="relative z-10">
          {item.customIcon && item.title === "BlackJack" ? (
            <BlackJackIcon className="w-6 h-6 shrink-0 text-emerald-400" />
          ) : item.customIcon && item.customIconType === 'youragents' ? (
            <span className="w-6 h-6 shrink-0 flex items-center justify-center relative select-none">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
                {/* Neural network brain */}
                <circle cx="12" cy="8" r="5" stroke="#a855f7" strokeWidth="1.2" fill="none">
                  <animate attributeName="stroke" values="#a855f7;#22d3ee;#a855f7" dur="3s" repeatCount="indefinite"/>
                </circle>
                {/* Brain inner pattern */}
                <path d="M10 6.5q2 1.5 4 0" stroke="#22d3ee" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
                <path d="M10 8.5q2 1.5 4 0" stroke="#a855f7" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
                {/* Connection lines going down */}
                <line x1="9" y1="13" x2="7" y2="17" stroke="#a855f7" strokeWidth="0.8" strokeLinecap="round">
                  <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/>
                </line>
                <line x1="12" y1="13" x2="12" y2="18" stroke="#22d3ee" strokeWidth="0.8" strokeLinecap="round">
                  <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite"/>
                </line>
                <line x1="15" y1="13" x2="17" y2="17" stroke="#a855f7" strokeWidth="0.8" strokeLinecap="round">
                  <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/>
                </line>
                {/* Agent nodes */}
                <circle cx="7" cy="18" r="2" stroke="#a855f7" strokeWidth="0.8" fill="none"/>
                <circle cx="12" cy="19" r="2" stroke="#22d3ee" strokeWidth="0.8" fill="none"/>
                <circle cx="17" cy="18" r="2" stroke="#a855f7" strokeWidth="0.8" fill="none"/>
                {/* Pulsing dots inside nodes */}
                <circle cx="7" cy="18" r="0.8" fill="#a855f7">
                  <animate attributeName="r" values="0.8;0.4;0.8" dur="1.5s" repeatCount="indefinite"/>
                </circle>
                <circle cx="12" cy="19" r="0.8" fill="#22d3ee">
                  <animate attributeName="r" values="0.4;0.8;0.4" dur="1.5s" repeatCount="indefinite"/>
                </circle>
                <circle cx="17" cy="18" r="0.8" fill="#a855f7">
                  <animate attributeName="r" values="0.8;0.4;0.8" dur="1.5s" repeatCount="indefinite"/>
                </circle>
              </svg>
            </span>
          ) : item.customIcon && item.customIconType === 'avloai' ? (
            <span className="w-6 h-6 shrink-0 flex items-center justify-center relative select-none">
              {/* AI text + mini animated robot */}
              <span className="flex items-center gap-0.5">
                <span className="text-[11px] font-black bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent leading-none">AI</span>
                <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none">
                  {/* Antenna */}
                  <line x1="8" y1="1" x2="8" y2="3.5" stroke="#22d3ee" strokeWidth="1" strokeLinecap="round">
                    <animateTransform attributeName="transform" type="rotate" values="-12 8 3.5;12 8 3.5;-12 8 3.5" dur="1.2s" repeatCount="indefinite"/>
                  </line>
                  <circle cx="8" cy="1" r="1" fill="#22d3ee">
                    <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite"/>
                  </circle>
                  {/* Head */}
                  <rect x="4" y="3.5" width="8" height="6.5" rx="2" fill="none" stroke="#22d3ee" strokeWidth="1"/>
                  {/* Eyes */}
                  <circle cx="6.5" cy="6.5" r="1" fill="#a855f7">
                    <animate attributeName="r" values="1;0.5;1" dur="2.5s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx="9.5" cy="6.5" r="1" fill="#a855f7">
                    <animate attributeName="r" values="0.5;1;0.5" dur="2.5s" repeatCount="indefinite"/>
                  </circle>
                  {/* Mouth */}
                  <path d="M6.5 8.5q1.5 1 3 0" stroke="#22d3ee" strokeWidth="0.7" fill="none" strokeLinecap="round"/>
                  {/* Body bounce */}
                  <rect x="5.5" y="10.5" width="5" height="3" rx="1" fill="none" stroke="#22d3ee" strokeWidth="0.8">
                    <animateTransform attributeName="transform" type="translate" values="0 0;0 -0.3;0 0" dur="1.5s" repeatCount="indefinite"/>
                  </rect>
                </svg>
              </span>
            </span>
          ) : (
            <item.icon className={`w-5 h-5 shrink-0 ${item.color} ${isGlowing && item.glowColor !== 'emerald' ? 'drop-shadow-[0_0_6px_rgba(249,115,22,0.6)]' : ''}`} />
          )}
        </div>
        {!isCollapsed && (
          <span className="relative z-10 flex items-center gap-2 flex-1">
            <span className={`font-medium text-sm flex-1 text-left ${isGlowing && item.glowColor === 'emerald' ? 'text-emerald-300' : isGlowing && item.glowColor === 'cyan' ? 'text-cyan-300' : isGlowing ? 'text-orange-300' : ''}`}>{item.title}</span>
            {item.greenBadge && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                {item.greenBadge}
              </span>
            )}
            {item.rightText && (
              <span className="text-xs font-medium text-orange-400">{item.rightText}</span>
            )}
          </span>
        )}
      </button>
    );

    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-zinc-900 border-zinc-700 text-white">
            <p>{item.title}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return button;
  };

  return (
    <Sidebar 
      collapsible="icon"
      className="border-r border-zinc-800 bg-black"
      style={{ 
        backgroundColor: '#000000',
        boxShadow: 'none'
      }}
    >
      <SidebarHeader className={`border-b border-zinc-800 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        {isCollapsed ? (
          // Collapsed: Show only the sidebar trigger (hamburger)
          <div className="flex items-center justify-center">
            <SidebarTrigger className="text-white hover:bg-zinc-800 rounded-lg p-2" />
          </div>
        ) : (
          // Expanded: Show hamburger + logo
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-white hover:bg-zinc-800 rounded-lg p-2 flex-shrink-0" />
            <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => navigate('/')}>
              <img src={logo} alt="AvaLove" className="rounded-full shadow-glow w-10 h-10" />
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span className="text-xl font-black text-transparent bg-gradient-love bg-clip-text tracking-tight">
                    AvaLove
                  </span>
                  <ArenaArchLogo size="sm" animated={false} className="w-5 h-5" />
                </div>
                <span className="text-[10px] text-orange-400 font-medium">On The Arena</span>
              </div>
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="scrollbar-hide overflow-x-hidden">
        {/* Main Navigation */}
        <div className={`py-3 space-y-1 ${isCollapsed ? 'px-0.5' : 'px-3'}`}>
          {/* Menu items */}
          {mainMenuItems.map((item) => (
            <NavButton key={item.url} item={item} />
          ))}

          {/* More Section - Collapsible */}
          {isCollapsed ? (
            // When collapsed, clicking More opens the sidebar and expands More section
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    // Open sidebar first, then expand More
                    toggleSidebar();
                    setMoreExpanded(true);
                  }}
                  className="w-full flex items-center justify-center px-2 py-2.5 rounded-lg transition-all text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
                >
                  <MoreHorizontal className="w-5 h-5 text-zinc-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-900 border-zinc-700 text-white">
                <p>More</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            // When expanded, show as collapsible
            <div>
              <button
                onClick={() => setMoreExpanded(!moreExpanded)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-zinc-400 hover:bg-zinc-800/50 hover:text-white active:bg-zinc-800/70"
              >
                <MoreHorizontal className="w-5 h-5 text-zinc-400" />
                <span className="font-medium text-sm flex-1 text-left">More</span>
                {moreExpanded ? (
                  <ChevronUp className="w-4 h-4 text-zinc-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                )}
              </button>
              {moreExpanded && (
                <div className="pl-4 mt-1 space-y-1">
                  {moreMenuItems.map((item) => (
                    <NavButton key={item.url} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Admin Panel */}
          {isAdmin && (
            isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate('/admin')}
                    className={`w-full flex items-center justify-center px-2 py-2.5 rounded-lg transition-all ${
                      isActive('/admin') 
                        ? 'bg-red-500/20 text-red-400' 
                        : 'text-zinc-400 hover:bg-red-500/10 hover:text-red-400'
                    }`}
                  >
                    <Shield className="w-5 h-5 text-red-500" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-zinc-900 border-zinc-700 text-white">
                  <p>Admin Panel</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={() => navigate('/admin')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isActive('/admin') 
                    ? 'bg-red-500/20 text-red-400' 
                    : 'text-zinc-400 hover:bg-red-500/10 hover:text-red-400'
                }`}
              >
                <Shield className="w-5 h-5 text-red-500" />
                <span className="font-medium text-sm">Admin Panel</span>
              </button>
            )
          )}
        </div>

      </SidebarContent>


      {/* Public Chat Overlay */}
      {isPublicChatOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-end md:items-center justify-center p-4"
          onClick={() => setIsPublicChatOpen(false)}
        >
          <div 
            className="w-full max-w-2xl h-[80vh] md:h-[600px]"
            onClick={(e) => e.stopPropagation()}
          >
            <PublicChat onClose={() => setIsPublicChatOpen(false)} />
          </div>
        </div>
      )}

      {/* Notifications Overlay */}
      {isNotificationsOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[210] flex items-center justify-center p-4"
          onClick={() => setIsNotificationsOpen(false)}
        >
          <div 
            className="w-full max-w-md max-h-[80vh] bg-black border border-zinc-800 rounded-2xl shadow-[0_0_40px_rgba(249,115,22,0.6)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-orange-500" />
                <span className="text-sm font-semibold text-white">Notifications</span>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="bg-orange-500 text-white text-xs px-2 py-0.5">
                    {unreadCount}
                  </Badge>
                )}
              </div>
              <button
                onClick={async () => {
                  await markAllAsRead();
                  window.dispatchEvent(new Event('notifications:updated'));
                  setIsNotificationsOpen(false);
                }}
                className="text-xs text-orange-500 hover:text-orange-400 underline"
              >
                Mark all read
              </button>
            </div>
            <div className="max-h-[calc(80vh-60px)] overflow-y-auto scrollbar-hide">
              <NotificationCenter isPostsPage={false} isOverlay={true} />
            </div>
          </div>
        </div>
      )}

      {/* Badge Info Dialog */}
      <Dialog open={!!selectedBadge} onOpenChange={(open) => !open && setSelectedBadge(null)}>
        <DialogContent className="bg-black border-2 border-orange-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              {selectedBadge && (() => {
                const IconComponent = (LucideIcons as any)[selectedBadge.badges.icon] || Award;
                const rarityColors = {
                  common: 'from-gray-500 to-gray-600',
                  rare: 'from-blue-500 to-blue-600',
                  epic: 'from-purple-500 to-purple-600',
                  legendary: 'from-yellow-500 to-orange-600',
                };
                const gradient = rarityColors[selectedBadge.badges.rarity as keyof typeof rarityColors] || rarityColors.common;
                
                return (
                  <>
                    <div className={`p-3 rounded-lg bg-gradient-to-br ${gradient} shadow-lg`}>
                      <IconComponent className="w-8 h-8 text-white" />
                    </div>
                    <span>{selectedBadge.badges.name}</span>
                  </>
                );
              })()}
            </DialogTitle>
            <DialogDescription className="text-zinc-400 mt-4 space-y-4">
              {selectedBadge && (
                <>
                  <div>
                    <p className="text-base">{selectedBadge.badges.description}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Rarity:</span>
                    <span className={`text-sm font-bold capitalize ${
                      selectedBadge.badges.rarity === 'legendary' ? 'text-yellow-500' :
                      selectedBadge.badges.rarity === 'epic' ? 'text-purple-500' :
                      selectedBadge.badges.rarity === 'rare' ? 'text-blue-500' :
                      'text-gray-500'
                    }`}>
                      {selectedBadge.badges.rarity}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Requirement:</span>
                    <span className="text-sm text-zinc-300">
                      {selectedBadge.badges.requirement_type === 'matches' && `${selectedBadge.badges.requirement_value} matches`}
                      {selectedBadge.badges.requirement_type === 'swipes' && `${selectedBadge.badges.requirement_value} swipes`}
                      {selectedBadge.badges.requirement_type === 'tokens' && `${selectedBadge.badges.requirement_value} tokens`}
                      {selectedBadge.badges.requirement_type === 'days_since_creation' && `Account age: ${selectedBadge.badges.requirement_value} days`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                    <span className="text-xs text-zinc-500">Earned on:</span>
                    <span className="text-sm text-zinc-300">
                      {new Date(selectedBadge.earned_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
