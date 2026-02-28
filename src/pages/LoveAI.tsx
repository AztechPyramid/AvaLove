import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Sparkles, Heart, Zap, MessageCircle, Users, Gamepad2, Play, Music, Palette, HelpCircle, Bot, Cpu, CircuitBoard, Coins, ExternalLink, ChevronRight, Trophy, Vote, Gift, Wallet, BarChart3, Lock, Flame, Shield, UserCircle, DollarSign, TrendingUp, Clock, Target, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { useWalletAuth } from "@/contexts/WalletAuthContext";
import { useAvloBalance } from "@/hooks/useAvloBalance";
import { useUnifiedCost } from "@/hooks/useUnifiedCost";
import { supabase } from "@/integrations/supabase/client";

interface UserInfo {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface PostData {
  id: string;
  content: string;
  likes_count: number;
  author: UserInfo;
  created_at: string;
}

interface MatchData {
  user1: UserInfo;
  user2: UserInfo;
  created_at: string;
}

interface GameData {
  player: UserInfo;
  game_title: string;
  play_time_seconds: number;
}

interface LeaderboardData {
  player: UserInfo;
  rank: number;
  play_time_minutes: number;
}

interface PixelData {
  artist: UserInfo;
  x: number;
  y: number;
  color: string;
}

interface StatsData {
  label: string;
  value: number;
  icon: string;
}

interface OnlineUserData {
  user: UserInfo;
  last_active: string;
}

interface StakingPoolData {
  id: string;
  name: string;
  apy: number;
  total_staked: number;
  participants: number;
}

interface CostData {
  message_cost: number;
  reward_per_second: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  responseType?: string;
  links?: { label: string; url: string }[];
  users?: UserInfo[];
  posts?: PostData[];
  matches?: MatchData[];
  games?: GameData[];
  leaderboard?: LeaderboardData[];
  pixels?: PixelData[];
  stats?: StatsData[];
  onlineUsers?: OnlineUserData[];
  stakingPools?: StakingPoolData[];
  costData?: CostData;
}

const LoveAI = () => {
  const navigate = useNavigate();
  const { profile } = useWalletAuth();
  const { balance, refresh: refreshBalance } = useAvloBalance();
  const { baseCost, rewardPerSecond, loading: costLoading } = useUnifiedCost();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Dynamic cost from unified system
  const AI_COST_PER_MESSAGE = baseCost;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Expanded suggested questions organized by category
  const suggestedQuestions = [
    // Getting Started
    { text: "What is AVLO? 💰", icon: Coins, category: "basics" },
    { text: "How to earn? 🎯", icon: Gift, category: "basics" },
    { text: "What's the cost? 💸", icon: DollarSign, category: "basics" },
    { text: "Help 🚀", icon: HelpCircle, category: "basics" },
    
    // Live Data
    { text: "Recent matches 💕", icon: Heart, category: "live" },
    { text: "Recent posts 📝", icon: MessageCircle, category: "live" },
    { text: "Who's playing? 🎮", icon: Gamepad2, category: "live" },
    { text: "Top players 🏆", icon: Trophy, category: "live" },
    
    // Features
    { text: "What is Discover? 💕", icon: Heart, category: "features" },
    { text: "What is Watch? 📺", icon: Play, category: "features" },
    { text: "What is LoveArt? 🎨", icon: Palette, category: "features" },
    { text: "What is Staking? 🔒", icon: Lock, category: "features" },
    
    // Advanced
    { text: "What is DAO? 🗳️", icon: Vote, category: "advanced" },
    { text: "Token burning 🔥", icon: Flame, category: "advanced" },
    { text: "Platform stats 📊", icon: BarChart3, category: "advanced" },
    { text: "Security 🔐", icon: Shield, category: "advanced" },
  ];

  const askLove = useCallback(async (message: string): Promise<Partial<Message>> => {
    const BOT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/love-bot`;
    
    try {
      const response = await fetch(BOT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        return { content: "Something went wrong, please try again! 💜" };
      }

      const data = await response.json();
      
      // Extract links based on keywords
      const links: { label: string; url: string }[] = [];
      const lowerMessage = message.toLowerCase();
      
      if (lowerMessage.includes("match") || lowerMessage.includes("discover")) {
        links.push({ label: "Matches", url: "/matches" });
        links.push({ label: "Discover", url: "/" });
      }
      if (lowerMessage.includes("game") || lowerMessage.includes("play")) {
        links.push({ label: "Games", url: "/mini-games" });
      }
      if (lowerMessage.includes("watch") || lowerMessage.includes("video")) {
        links.push({ label: "Watch", url: "/watch-earn" });
      }
      if (lowerMessage.includes("pixel") || lowerMessage.includes("art") || lowerMessage.includes("loveart") || lowerMessage.includes("nft") || lowerMessage.includes("card")) {
        links.push({ label: "LoveArt", url: "/loveart" });
      }
      if (lowerMessage.includes("stake") || lowerMessage.includes("staking") || lowerMessage.includes("apy")) {
        links.push({ label: "Staking", url: "/staking" });
      }
      if (lowerMessage.includes("post") || lowerMessage.includes("share")) {
        links.push({ label: "Posts", url: "/posts" });
      }
      if (lowerMessage.includes("dao") || lowerMessage.includes("vote") || lowerMessage.includes("proposal")) {
        links.push({ label: "DAO", url: "/dao" });
      }
      if (lowerMessage.includes("reward") || lowerMessage.includes("earn")) {
        links.push({ label: "Rewards", url: "/reward-tracker" });
      }
      if (lowerMessage.includes("stat") || lowerMessage.includes("platform")) {
        links.push({ label: "Statistics", url: "/statistics" });
      }
      if (lowerMessage.includes("leader") || lowerMessage.includes("top") || lowerMessage.includes("airdrop")) {
        links.push({ label: "Leaderboard", url: "/airdrop" });
      }
      if (lowerMessage.includes("profile")) {
        links.push({ label: "Profile", url: "/profile" });
      }
      if (lowerMessage.includes("referral") || lowerMessage.includes("invite")) {
        links.push({ label: "Referral", url: "/referral" });
      }
      if (lowerMessage.includes("faq") || lowerMessage.includes("help") || lowerMessage.includes("question")) {
        links.push({ label: "FAQ", url: "/faq" });
      }
      
      return { 
        content: data.response || "Hmm, something went wrong! 💜", 
        responseType: data.responseType || "default",
        links, 
        users: data.users || [],
        posts: data.posts || [],
        matches: data.matches || [],
        games: data.games || [],
        leaderboard: data.leaderboard || [],
        pixels: data.pixels || [],
        stats: data.stats || [],
        onlineUsers: data.onlineUsers || [],
        stakingPools: data.stakingPools || [],
        costData: data.costData || null
      };
    } catch (error) {
      console.error("Love bot error:", error);
      return { content: "Connection error, please try again! 💜" };
    }
  }, []);

  const deductCredits = async () => {
    if (!profile?.id) return false;
    
    try {
      const { error } = await supabase.from('token_burns').insert({
        user_id: profile.id,
        amount: AI_COST_PER_MESSAGE,
        burn_type: 'ai_chat',
        tx_hash: `ai_chat_${Date.now()}`
      });
      
      if (error) throw error;
      await refreshBalance();
      return true;
    } catch (error) {
      console.error('Error deducting credits:', error);
      return false;
    }
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    if (!profile) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (balance < AI_COST_PER_MESSAGE) {
      toast({
        title: "Insufficient Balance",
        description: `You need ${AI_COST_PER_MESSAGE} AVLO Credits to send a message`,
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Deduct credits first
    const deducted = await deductCredits();
    if (!deducted) {
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to deduct credits",
        variant: "destructive",
      });
      return;
    }

    // Add loading message
    setMessages((prev) => [...prev, { role: "assistant", content: "..." }]);

    try {
      const botResponse = await askLove(text);
      
      // Update loading message with actual response
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage?.role === "assistant") {
          lastMessage.content = botResponse.content || "";
          lastMessage.responseType = botResponse.responseType;
          lastMessage.links = botResponse.links;
          lastMessage.users = botResponse.users;
          lastMessage.posts = botResponse.posts;
          lastMessage.matches = botResponse.matches;
          lastMessage.games = botResponse.games;
          lastMessage.leaderboard = botResponse.leaderboard;
          lastMessage.pixels = botResponse.pixels;
          lastMessage.stats = botResponse.stats;
          lastMessage.onlineUsers = botResponse.onlineUsers;
          lastMessage.stakingPools = botResponse.stakingPools;
          lastMessage.costData = botResponse.costData;
        }
        return newMessages;
      });
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage?.role === "assistant") {
          lastMessage.content = "Something went wrong, please try again! 💜";
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const features = [
    { icon: Heart, label: "Matches", color: "#ff6b6b", url: "/matches" },
    { icon: Gamepad2, label: "Games", color: "#a855f7", url: "/mini-games" },
    { icon: Play, label: "Watch", color: "#ec4899", url: "/watch-earn" },
    { icon: Palette, label: "LoveArt", color: "#f97316", url: "/loveart" },
    { icon: Users, label: "Users", url: "/airdrop", color: "#22c55e" },
    { icon: Lock, label: "Staking", color: "#06b6d4", url: "/staking" },
  ];

  // Get response type icon and color
  const getResponseTypeStyle = (responseType?: string) => {
    const styles: { [key: string]: { icon: React.ReactNode; gradient: string; border: string } } = {
      greeting: { icon: <Sparkles className="w-4 h-4" />, gradient: "from-purple-500/20 to-pink-500/20", border: "border-purple-500/30" },
      help: { icon: <HelpCircle className="w-4 h-4" />, gradient: "from-cyan-500/20 to-blue-500/20", border: "border-cyan-500/30" },
      cost: { icon: <DollarSign className="w-4 h-4" />, gradient: "from-green-500/20 to-emerald-500/20", border: "border-green-500/30" },
      avlo: { icon: <Coins className="w-4 h-4" />, gradient: "from-yellow-500/20 to-orange-500/20", border: "border-yellow-500/30" },
      earn: { icon: <TrendingUp className="w-4 h-4" />, gradient: "from-green-500/20 to-cyan-500/20", border: "border-green-500/30" },
      platform: { icon: <Layers className="w-4 h-4" />, gradient: "from-purple-500/20 to-cyan-500/20", border: "border-purple-500/30" },
      watch: { icon: <Play className="w-4 h-4" />, gradient: "from-pink-500/20 to-red-500/20", border: "border-pink-500/30" },
      listen: { icon: <Music className="w-4 h-4" />, gradient: "from-green-500/20 to-teal-500/20", border: "border-green-500/30" },
      staking: { icon: <Lock className="w-4 h-4" />, gradient: "from-cyan-500/20 to-blue-500/20", border: "border-cyan-500/30" },
      discover: { icon: <Heart className="w-4 h-4" />, gradient: "from-red-500/20 to-pink-500/20", border: "border-red-500/30" },
      chat: { icon: <MessageCircle className="w-4 h-4" />, gradient: "from-blue-500/20 to-purple-500/20", border: "border-blue-500/30" },
      dao: { icon: <Vote className="w-4 h-4" />, gradient: "from-indigo-500/20 to-purple-500/20", border: "border-indigo-500/30" },
      referral: { icon: <Users className="w-4 h-4" />, gradient: "from-orange-500/20 to-red-500/20", border: "border-orange-500/30" },
      nft: { icon: <Palette className="w-4 h-4" />, gradient: "from-orange-500/20 to-pink-500/20", border: "border-orange-500/30" },
      arena: { icon: <Shield className="w-4 h-4" />, gradient: "from-blue-500/20 to-cyan-500/20", border: "border-blue-500/30" },
      burn: { icon: <Flame className="w-4 h-4" />, gradient: "from-red-500/20 to-orange-500/20", border: "border-red-500/30" },
      wallet: { icon: <Wallet className="w-4 h-4" />, gradient: "from-purple-500/20 to-blue-500/20", border: "border-purple-500/30" },
      security: { icon: <Shield className="w-4 h-4" />, gradient: "from-green-500/20 to-blue-500/20", border: "border-green-500/30" },
      matches: { icon: <Heart className="w-4 h-4" />, gradient: "from-red-500/20 to-pink-500/20", border: "border-red-500/30" },
      posts: { icon: <MessageCircle className="w-4 h-4" />, gradient: "from-pink-500/20 to-purple-500/20", border: "border-pink-500/30" },
      games: { icon: <Gamepad2 className="w-4 h-4" />, gradient: "from-purple-500/20 to-cyan-500/20", border: "border-purple-500/30" },
      leaderboard: { icon: <Trophy className="w-4 h-4" />, gradient: "from-yellow-500/20 to-orange-500/20", border: "border-yellow-500/30" },
      pixels: { icon: <Palette className="w-4 h-4" />, gradient: "from-orange-500/20 to-pink-500/20", border: "border-orange-500/30" },
      online: { icon: <Users className="w-4 h-4" />, gradient: "from-green-500/20 to-cyan-500/20", border: "border-green-500/30" },
      stats: { icon: <BarChart3 className="w-4 h-4" />, gradient: "from-cyan-500/20 to-purple-500/20", border: "border-cyan-500/30" },
      airdrop: { icon: <Gift className="w-4 h-4" />, gradient: "from-purple-500/20 to-pink-500/20", border: "border-purple-500/30" },
      profile: { icon: <UserCircle className="w-4 h-4" />, gradient: "from-blue-500/20 to-purple-500/20", border: "border-blue-500/30" },
      support: { icon: <HelpCircle className="w-4 h-4" />, gradient: "from-cyan-500/20 to-blue-500/20", border: "border-cyan-500/30" },
      default: { icon: <Bot className="w-4 h-4" />, gradient: "from-cyan-500/20 to-purple-500/20", border: "border-cyan-500/30" },
      error: { icon: <Shield className="w-4 h-4" />, gradient: "from-red-500/20 to-orange-500/20", border: "border-red-500/30" },
    };
    return styles[responseType || "default"] || styles.default;
  };

  // Parse markdown-like formatting
  const formatMessage = (content: string) => {
    return content.split('\n').map((line, i) => {
      // Bold text
      let formattedLine = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={j} className="font-bold text-cyan-400">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      // Check if line is a separator
      if (line.trim() === '━━━━━━━━━━━━━━━━━━━━') {
        return (
          <div key={i} className="my-2 flex items-center gap-2">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          </div>
        );
      }

      // Check if line starts with box characters
      if (line.startsWith('┌') || line.startsWith('│') || line.startsWith('└')) {
        return (
          <div key={i} className="font-mono text-sm text-gray-300 pl-2 border-l-2 border-cyan-500/30">
            {formattedLine}
          </div>
        );
      }

      return (
        <span key={i}>
          {formattedLine}
          {i < content.split('\n').length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <div className="h-[calc(100vh-64px)] bg-black flex flex-col relative overflow-hidden">
      {/* Tech Grid Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
        
        {/* Animated circuit lines */}
        <svg className="absolute inset-0 w-full h-full opacity-10">
          <defs>
            <linearGradient id="circuitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          {[...Array(8)].map((_, i) => (
            <motion.line
              key={i}
              x1={`${i * 15}%`}
              y1="0"
              x2={`${i * 15 + 10}%`}
              y2="100%"
              stroke="url(#circuitGrad)"
              strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: [0, 0.5, 0] }}
              transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </svg>
        
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full blur-[150px] opacity-15"
          style={{
            background: "radial-gradient(circle, #06b6d4, transparent 70%)",
            left: mousePosition.x - 250,
            top: mousePosition.y - 250,
          }}
        />
        
        <motion.div
          className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px]"
          animate={{
            background: [
              "radial-gradient(circle, rgba(6, 182, 212, 0.25), transparent 70%)",
              "radial-gradient(circle, rgba(168, 85, 247, 0.25), transparent 70%)",
              "radial-gradient(circle, rgba(6, 182, 212, 0.25), transparent 70%)",
            ],
          }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        
        <motion.div
          className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full blur-[100px]"
          animate={{
            background: [
              "radial-gradient(circle, rgba(236, 72, 153, 0.2), transparent 70%)",
              "radial-gradient(circle, rgba(6, 182, 212, 0.2), transparent 70%)",
              "radial-gradient(circle, rgba(236, 72, 153, 0.2), transparent 70%)",
            ],
          }}
          transition={{ duration: 5, repeat: Infinity }}
        />

        {/* Tech particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-cyan-500/40 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -40, 0],
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="relative z-10 border-b border-cyan-500/20 p-4 md:p-6 backdrop-blur-md bg-black/40">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* AI Logo */}
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-cyan-500/30 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMCAyMEg0ME0yMCAwVjQwIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+')] opacity-30" />
                  <Bot className="w-7 h-7 text-white relative z-10" />
                </div>
                <motion.div
                  className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 opacity-40 blur-lg -z-10"
                  animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                {/* Orbiting dot */}
                <motion.div
                  className="absolute w-2 h-2 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400"
                  animate={{
                    rotate: [0, 360],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  style={{ transformOrigin: "28px 28px", left: "0", top: "0" }}
                />
              </div>
              
              <div>
                <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
                    Love
                  </span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                    Bot
                  </span>
                  <CircuitBoard className="w-5 h-5 text-cyan-500" />
                </h1>
                <p className="text-sm text-cyan-300/70 flex items-center gap-2">
                  <Cpu className="w-3 h-3" />
                  Neural Platform Assistant • <span className="text-green-400">{rewardPerSecond} AVLO/sn</span>
                </p>
              </div>
            </div>

            {/* AVLO Credit Balance */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30"
            >
              <Coins className="w-4 h-4 text-cyan-400" />
              <span className="text-cyan-400 font-bold">{balance.toLocaleString()}</span>
              <span className="text-xs text-gray-400">AVLO</span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <ScrollArea className="flex-1 relative z-10" ref={scrollRef}>
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4 pb-4">
          <AnimatePresence>
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center py-8 md:py-12"
              >
                {/* Hero Icon */}
                <motion.div
                  className="relative w-20 h-20 mx-auto mb-6"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 opacity-30 blur-xl" />
                  <div className="relative w-full h-full rounded-3xl bg-gradient-to-br from-cyan-600 via-purple-600 to-pink-600 flex items-center justify-center border border-cyan-500/30">
                    <Bot className="w-10 h-10 text-white" />
                  </div>
                  <motion.div
                    className="absolute inset-0 rounded-3xl border border-cyan-500/50"
                    animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </motion.div>

                <h2 className="text-2xl font-bold text-white mb-2">
                  Hello! I'm <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">LoveBot</span> 🤖
                </h2>
                <p className="text-gray-400 max-w-md mx-auto mb-2 text-sm">
                  I'm AvaLove's smart assistant. Ask me anything about the platform!
                </p>
                <div className="flex items-center justify-center gap-3 text-xs mb-6">
                  <span className="flex items-center gap-1 text-cyan-400">
                    <Coins className="w-3 h-3" />
                    {costLoading ? "..." : AI_COST_PER_MESSAGE} AVLO / msg
                  </span>
                  <span className="text-gray-600">•</span>
                  <span className="flex items-center gap-1 text-green-400">
                    <Clock className="w-3 h-3" />
                    {rewardPerSecond} AVLO/sec reward
                  </span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-400">🌍 All languages</span>
                </div>

                {/* Categorized Suggested Questions */}
                <div className="space-y-4 max-w-2xl mx-auto">
                  {/* Getting Started */}
                  <div>
                    <p className="text-xs text-cyan-400/70 mb-2 font-medium">🚀 Getting Started</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {suggestedQuestions.filter(q => q.category === "basics").map((q, i) => (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 + i * 0.05 }}
                          onClick={() => sendMessage(q.text)}
                          className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500/5 to-purple-500/5 border border-cyan-500/20 hover:border-cyan-500/50 hover:from-cyan-500/10 hover:to-purple-500/10 transition-all text-left group"
                        >
                          <div className="flex items-center gap-2">
                            <q.icon className="w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-300 flex-shrink-0" />
                            <span className="text-xs text-gray-300 group-hover:text-white truncate">{q.text}</span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Live Data */}
                  <div>
                    <p className="text-xs text-pink-400/70 mb-2 font-medium">📊 Live Data</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {suggestedQuestions.filter(q => q.category === "live").map((q, i) => (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 + i * 0.05 }}
                          onClick={() => sendMessage(q.text)}
                          className="p-2.5 rounded-xl bg-gradient-to-r from-pink-500/5 to-purple-500/5 border border-pink-500/20 hover:border-pink-500/50 hover:from-pink-500/10 hover:to-purple-500/10 transition-all text-left group"
                        >
                          <div className="flex items-center gap-2">
                            <q.icon className="w-3.5 h-3.5 text-pink-400 group-hover:text-pink-300 flex-shrink-0" />
                            <span className="text-xs text-gray-300 group-hover:text-white truncate">{q.text}</span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <p className="text-xs text-purple-400/70 mb-2 font-medium">✨ Features</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {suggestedQuestions.filter(q => q.category === "features").map((q, i) => (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 + i * 0.05 }}
                          onClick={() => sendMessage(q.text)}
                          className="p-2.5 rounded-xl bg-gradient-to-r from-purple-500/5 to-cyan-500/5 border border-purple-500/20 hover:border-purple-500/50 hover:from-purple-500/10 hover:to-cyan-500/10 transition-all text-left group"
                        >
                          <div className="flex items-center gap-2">
                            <q.icon className="w-3.5 h-3.5 text-purple-400 group-hover:text-purple-300 flex-shrink-0" />
                            <span className="text-xs text-gray-300 group-hover:text-white truncate">{q.text}</span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Advanced */}
                  <div>
                    <p className="text-xs text-orange-400/70 mb-2 font-medium">⚡ Advanced</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {suggestedQuestions.filter(q => q.category === "advanced").map((q, i) => (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 + i * 0.05 }}
                          onClick={() => sendMessage(q.text)}
                          className="p-2.5 rounded-xl bg-gradient-to-r from-orange-500/5 to-pink-500/5 border border-orange-500/20 hover:border-orange-500/50 hover:from-orange-500/10 hover:to-pink-500/10 transition-all text-left group"
                        >
                          <div className="flex items-center gap-2">
                            <q.icon className="w-3.5 h-3.5 text-orange-400 group-hover:text-orange-300 flex-shrink-0" />
                            <span className="text-xs text-gray-300 group-hover:text-white truncate">{q.text}</span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick Feature Access */}
                <div className="mt-6 grid grid-cols-3 md:grid-cols-6 gap-2 max-w-xl mx-auto">
                  {features.map((feature, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + i * 0.05 }}
                      onClick={() => navigate(feature.url)}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all group"
                    >
                      <feature.icon className="w-4 h-4 transition-transform group-hover:scale-110" style={{ color: feature.color }} />
                      <span className="text-[9px] text-gray-500 group-hover:text-gray-300">{feature.label}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {messages.map((message, index) => {
            const responseStyle = getResponseTypeStyle(message.responseType);
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <motion.div 
                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/20 border border-cyan-500/30"
                    animate={{ boxShadow: ["0 0 20px rgba(6,182,212,0.2)", "0 0 30px rgba(168,85,247,0.3)", "0 0 20px rgba(6,182,212,0.2)"] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Bot className="w-5 h-5 text-white" />
                  </motion.div>
                )}
                <div className="flex flex-col gap-2 max-w-[85%]">
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-gradient-to-r from-cyan-600 to-purple-600 text-white"
                        : `bg-gradient-to-r ${responseStyle.gradient} border ${responseStyle.border} text-white backdrop-blur-sm`
                    }`}
                  >
                    {/* Response type indicator for assistant */}
                    {message.role === "assistant" && message.responseType && message.responseType !== "default" && (
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                        <div className="p-1 rounded bg-white/10">
                          {responseStyle.icon}
                        </div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider">
                          {message.responseType}
                        </span>
                      </div>
                    )}
                    
                    <div className="whitespace-pre-wrap">
                      {message.content === "..." ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                          <span className="text-cyan-300">Thinking...</span>
                        </div>
                      ) : (
                        formatMessage(message.content)
                      )}
                    </div>
                  </div>

                  {/* Cost Data Card */}
                  {message.role === "assistant" && message.costData && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-cyan-500/10 border border-green-500/30"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-green-500/20">
                          <DollarSign className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <p className="text-white font-bold">Cost System</p>
                          <p className="text-xs text-gray-400">Unified Cost Engine</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-black/30">
                          <p className="text-xs text-gray-400">Reward/sec</p>
                          <p className="text-lg font-bold text-cyan-400">{message.costData.reward_per_second}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-black/30">
                          <p className="text-xs text-gray-400">Unit Cost</p>
                          <p className="text-lg font-bold text-green-400">{message.costData.message_cost}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Staking Pools Card */}
                  {message.role === "assistant" && message.stakingPools && message.stakingPools.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {message.stakingPools.map((pool, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 hover:border-cyan-500/40 transition-all cursor-pointer"
                          onClick={() => navigate('/staking')}
                        >
                          <div className="p-2 rounded-lg bg-cyan-500/20">
                            <Lock className="w-5 h-5 text-cyan-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{pool.name}</p>
                            <p className="text-xs text-gray-400">{pool.participants} participants</p>
                          </div>
                          <div className="text-right">
                            <p className="text-green-400 text-sm font-bold">{pool.apy}% APY</p>
                            <p className="text-[10px] text-gray-500">{pool.total_staked.toLocaleString()} TVL</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Rich Post Cards */}
                  {message.role === "assistant" && message.posts && message.posts.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {message.posts.map((post, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex gap-3 p-3 rounded-xl bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 hover:border-pink-500/40 transition-all cursor-pointer"
                          onClick={() => navigate('/posts')}
                        >
                          <Avatar className="w-10 h-10 border-2 border-pink-500/30">
                            {post.author.avatar_url ? (
                              <AvatarImage src={post.author.avatar_url} />
                            ) : (
                              <AvatarFallback className="bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm">
                                {(post.author.display_name || post.author.username)?.charAt(0).toUpperCase() || 'U'}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white text-sm truncate">{post.author.display_name || post.author.username}</span>
                              <Heart className="w-3 h-3 text-pink-400" fill="currentColor" />
                            </div>
                            <p className="text-gray-300 text-sm line-clamp-2 mt-0.5">{post.content}</p>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Heart className="w-3 h-3 text-pink-400" />
                                {post.likes_count}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Rich Match Cards */}
                  {message.role === "assistant" && message.matches && message.matches.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {message.matches.map((match, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/20 hover:border-red-500/40 transition-all cursor-pointer"
                          onClick={() => navigate('/matches')}
                        >
                          <Avatar className="w-10 h-10 border-2 border-red-500/30">
                            {match.user1.avatar_url ? (
                              <AvatarImage src={match.user1.avatar_url} />
                            ) : (
                              <AvatarFallback className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm">
                                {(match.user1.display_name || match.user1.username)?.charAt(0).toUpperCase() || 'U'}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <Heart className="w-5 h-5 text-red-500 animate-pulse" fill="currentColor" />
                          <Avatar className="w-10 h-10 border-2 border-pink-500/30">
                            {match.user2.avatar_url ? (
                              <AvatarImage src={match.user2.avatar_url} />
                            ) : (
                              <AvatarFallback className="bg-gradient-to-r from-pink-500 to-red-500 text-white text-sm">
                                {(match.user2.display_name || match.user2.username)?.charAt(0).toUpperCase() || 'U'}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">
                              {match.user1.display_name || match.user1.username} 💕 {match.user2.display_name || match.user2.username}
                            </p>
                            <p className="text-xs text-gray-500">Yeni eşleşme!</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Rich Game Cards */}
                  {message.role === "assistant" && message.games && message.games.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {message.games.map((game, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all cursor-pointer"
                          onClick={() => navigate('/mini-games')}
                        >
                          <Avatar className="w-10 h-10 border-2 border-purple-500/30">
                            {game.player.avatar_url ? (
                              <AvatarImage src={game.player.avatar_url} />
                            ) : (
                              <AvatarFallback className="bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-sm">
                                {(game.player.display_name || game.player.username)?.charAt(0).toUpperCase() || 'U'}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{game.player.display_name || game.player.username}</p>
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Gamepad2 className="w-3 h-3 text-purple-400" />
                              {game.game_title}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-cyan-400 text-sm font-bold">{Math.floor(game.play_time_seconds / 60)} dk</p>
                            <p className="text-[10px] text-gray-500">oynuyor</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Rich Leaderboard Cards */}
                  {message.role === "assistant" && message.leaderboard && message.leaderboard.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {message.leaderboard.map((entry, i) => {
                        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 hover:border-yellow-500/40 transition-all cursor-pointer"
                            onClick={() => navigate('/airdrop')}
                          >
                            <span className="text-2xl">{medals[i] || `${entry.rank}️⃣`}</span>
                            <Avatar className="w-10 h-10 border-2 border-yellow-500/30">
                              {entry.player.avatar_url ? (
                                <AvatarImage src={entry.player.avatar_url} />
                              ) : (
                                <AvatarFallback className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm">
                                  {(entry.player.display_name || entry.player.username)?.charAt(0).toUpperCase() || 'U'}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{entry.player.display_name || entry.player.username}</p>
                              <p className="text-xs text-gray-400">Sıra #{entry.rank}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-yellow-400 text-sm font-bold">{entry.play_time_minutes} dk</p>
                              <p className="text-[10px] text-gray-500">oyun süresi</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {/* Rich Pixel Art Cards */}
                  {message.role === "assistant" && message.pixels && message.pixels.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {message.pixels.map((pixel, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-orange-500/10 to-pink-500/10 border border-orange-500/20 hover:border-orange-500/40 transition-all cursor-pointer"
                          onClick={() => navigate('/loveart')}
                        >
                          <Avatar className="w-10 h-10 border-2 border-orange-500/30">
                            {pixel.artist.avatar_url ? (
                              <AvatarImage src={pixel.artist.avatar_url} />
                            ) : (
                              <AvatarFallback className="bg-gradient-to-r from-orange-500 to-pink-500 text-white text-sm">
                                {(pixel.artist.display_name || pixel.artist.username)?.charAt(0).toUpperCase() || 'A'}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{pixel.artist.display_name || pixel.artist.username}</p>
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Palette className="w-3 h-3 text-orange-400" />
                              Konum ({pixel.x}, {pixel.y})
                            </p>
                          </div>
                          <div 
                            className="w-8 h-8 rounded-lg border-2 border-white/20 shadow-lg"
                            style={{ backgroundColor: pixel.color }}
                          />
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Rich Stats Cards */}
                  {message.role === "assistant" && message.stats && message.stats.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                      {message.stats.map((stat, i) => {
                        const iconMap: { [key: string]: React.ReactNode } = {
                          users: <Users className="w-5 h-5 text-green-400" />,
                          heart: <Heart className="w-5 h-5 text-pink-400" />,
                          post: <MessageCircle className="w-5 h-5 text-blue-400" />,
                          game: <Gamepad2 className="w-5 h-5 text-purple-400" />,
                          pixel: <Palette className="w-5 h-5 text-orange-400" />,
                        };
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex flex-col items-center gap-1 p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/20"
                          >
                            {iconMap[stat.icon] || <BarChart3 className="w-5 h-5 text-cyan-400" />}
                            <p className="text-lg font-bold text-white">{stat.value.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-400">{stat.label}</p>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {/* Rich Online Users Cards */}
                  {message.role === "assistant" && message.onlineUsers && message.onlineUsers.length > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center flex-wrap gap-2">
                        {message.onlineUsers.map((entry, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-center gap-2 p-2 rounded-xl bg-gradient-to-r from-green-500/10 to-cyan-500/10 border border-green-500/20 hover:border-green-500/40 transition-all"
                          >
                            <div className="relative">
                              <Avatar className="w-8 h-8 border-2 border-green-500/30">
                                {entry.user.avatar_url ? (
                                  <AvatarImage src={entry.user.avatar_url} />
                                ) : (
                                  <AvatarFallback className="bg-gradient-to-r from-green-500 to-cyan-500 text-white text-xs">
                                    {(entry.user.display_name || entry.user.username)?.charAt(0).toUpperCase() || 'U'}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
                            </div>
                            <span className="text-xs text-white font-medium truncate max-w-[80px]">
                              {entry.user.display_name || entry.user.username}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Navigation Links */}
                  {message.role === "assistant" && message.links && message.links.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {message.links.map((link, i) => (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.1 }}
                          onClick={() => navigate(link.url)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs hover:bg-cyan-500/30 transition-all group"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {link.label}
                          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
                {message.role === "user" && (
                  <Avatar className="w-10 h-10 rounded-xl border-2 border-cyan-500/30 flex-shrink-0">
                    {profile?.avatar_url ? (
                      profile.avatar_url.match(/\.(mp4|webm)$/i) ? (
                        <video 
                          src={profile.avatar_url} 
                          autoPlay 
                          loop 
                          muted 
                          playsInline
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <AvatarImage src={profile.avatar_url} className="rounded-xl" />
                      )
                    ) : (
                      <AvatarFallback className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl">
                        {profile?.username?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    )}
                  </Avatar>
                )}
              </motion.div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="relative z-10 border-t border-cyan-500/20 p-4 md:p-6 backdrop-blur-md bg-black/50">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask LoveBot anything... (works in all languages)"
              className="flex-1 bg-zinc-900/80 border-purple-500/30 text-white placeholder:text-gray-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 rounded-xl h-12"
              disabled={isLoading || costLoading}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading || balance < AI_COST_PER_MESSAGE || costLoading}
              className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white border-0 h-12 px-6 rounded-xl disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
          <div className="flex items-center justify-center gap-4 mt-3">
            <p className="text-xs text-cyan-400 flex items-center gap-1">
              <Coins className="w-3 h-3" />
              {costLoading ? "..." : AI_COST_PER_MESSAGE} AVLO / msg
            </p>
            <span className="text-gray-600">•</span>
            <p className="text-xs text-green-400 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {rewardPerSecond} AVLO/sec reward
            </p>
            <span className="text-gray-600">•</span>
            <p className="text-xs text-gray-500">
              🌍 Multilingual • Type "Hey Love" in Global Chat
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoveAI;
