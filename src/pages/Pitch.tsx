import { motion } from "framer-motion";
import { 
  Heart, Gamepad2, Play, Palette, Coins, 
  Shield, Zap, Globe, Sparkles, Users, MessageSquare,
  Check, TrendingUp, Clock, Rocket, Target, Award
} from "lucide-react";
import discoverScreenshot from "@/assets/screenshots/discover.png";
import gamesScreenshot from "@/assets/screenshots/games.png";
import watchScreenshot from "@/assets/screenshots/watch.png";
import loveartScreenshot from "@/assets/screenshots/loveart.png";
import stakingScreenshot from "@/assets/screenshots/staking.png";
import { useState, useEffect } from "react";

const Pitch = () => {
  const [activeFeature, setActiveFeature] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'roadmap'>('overview');

  const features = [
    { icon: Heart, title: "Discover", desc: "Web3 Dating", color: "#ff6b6b", screenshot: discoverScreenshot, details: "Wallet-verified profiles, token-gated matching, on-chain reputation" },
    { icon: Gamepad2, title: "Games", desc: "Play-to-Earn", color: "#a855f7", screenshot: gamesScreenshot, details: "324+ embedded games with real AVLO token rewards per second" },
    { icon: Play, title: "Watch", desc: "Watch-to-Earn", color: "#ec4899", screenshot: watchScreenshot, details: "Curated video content, earn tokens while watching" },
    { icon: Palette, title: "LoveArt", desc: "NFT Canvas", color: "#f97316", screenshot: loveartScreenshot, details: "100x100 collaborative pixel canvas, NFT minting, trading cards" },
    { icon: Coins, title: "Staking", desc: "DeFi Rewards", color: "#eab308", screenshot: stakingScreenshot, details: "Multiple staking pools with competitive APY rates" },
  ];

  // Real platform statistics
  const liveStats = [
    { value: "324+", label: "Games", icon: Gamepad2 },
    { value: "81", label: "Users", icon: Users },
    { value: "77", label: "Posts", icon: MessageSquare },
    { value: "312", label: "Pixels", icon: Palette },
  ];

  const techStack = ["Avalanche C-Chain", "React + TypeScript", "Supabase", "Arena SDK", "Wagmi + Viem", "Framer Motion"];

  const roadmap = [
    { 
      phase: "Phase 1", 
      title: "Foundation", 
      status: "completed",
      items: ["Core platform architecture", "Wallet authentication", "Dating & matching system", "Basic token integration"] 
    },
    { 
      phase: "Phase 2", 
      title: "Expansion", 
      status: "completed",
      items: ["Watch-to-Earn module", "LoveArt pixel canvas", "Staking pools system", "Games integration"] 
    },
    { 
      phase: "Phase 3", 
      title: "Growth", 
      status: "current",
      items: ["Arena App Store integration", "NFT marketplace", "Mobile optimization", "Community governance"] 
    },
    { 
      phase: "Phase 4", 
      title: "Scale", 
      status: "upcoming",
      items: ["Multi-chain expansion", "Advanced DeFi features", "DAO governance", "Enterprise partnerships"] 
    }
  ];

  const tokenomics = [
    { title: "Platform Utility", desc: "All in-app transactions use AVLO" },
    { title: "Deflationary Burns", desc: "Token burns on every action" },
    { title: "Staking Rewards", desc: "Earn APY by staking tokens" },
    { title: "Earn Everywhere", desc: "Play, watch, create content" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-black text-white relative">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `
              linear-gradient(rgba(168, 85, 247, 0.15) 1px, transparent 1px),
              linear-gradient(90deg, rgba(168, 85, 247, 0.15) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
          }}
        />
        
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full blur-[120px] opacity-30"
          style={{
            background: `radial-gradient(circle, ${features[activeFeature].color}, transparent 70%)`,
            left: mousePosition.x - 250,
            top: mousePosition.y - 250,
          }}
        />
        
        <motion.div
          className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[100px]"
          animate={{
            background: [
              "radial-gradient(circle, rgba(236, 72, 153, 0.25), transparent 70%)",
              "radial-gradient(circle, rgba(168, 85, 247, 0.25), transparent 70%)",
              "radial-gradient(circle, rgba(236, 72, 153, 0.25), transparent 70%)",
            ],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        
        <motion.div
          className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full blur-[80px]"
          animate={{
            background: [
              "radial-gradient(circle, rgba(6, 182, 212, 0.25), transparent 70%)",
              "radial-gradient(circle, rgba(234, 179, 8, 0.25), transparent 70%)",
              "radial-gradient(circle, rgba(6, 182, 212, 0.25), transparent 70%)",
            ],
          }}
          transition={{ duration: 6, repeat: Infinity }}
        />
      </div>

      {/* Main Layout */}
      <div className="relative z-10 h-full flex">
        {/* Left Panel - 45% */}
        <div className="w-[45%] h-full flex flex-col p-6 lg:p-10">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-4"
          >
            <div className="flex items-center gap-3">
              <motion.div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: features[activeFeature].color }}
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Heart className="w-5 h-5 text-white" />
              </motion.div>
              <span className="text-xl font-bold tracking-tight">AVALOVE</span>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
              {(['overview', 'features', 'roadmap'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${
                    activeTab === tab ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col justify-center overflow-hidden">
            {activeTab === 'overview' && (
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                key="overview"
              >
                <div className="text-xs font-mono text-gray-400 mb-3 flex items-center gap-2">
                  <Sparkles className="w-3 h-3" />
                  AVALANCHE NATIVE • WEB3 SOCIAL
                </div>
                
                <h1 className="text-4xl lg:text-5xl font-black leading-[1.1] mb-4">
                  <span className="text-white">The All-in-One</span>
                  <br />
                  <span 
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: `linear-gradient(135deg, ${features[activeFeature].color}, #ec4899)` }}
                  >
                    Social Platform
                  </span>
                </h1>

                <p className="text-sm text-gray-400 max-w-md mb-5 leading-relaxed">
                  Dating • Gaming • Streaming • DeFi — A comprehensive Web3 ecosystem where every interaction earns real token rewards on Avalanche.
                </p>

                {/* Live Stats */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  {liveStats.map((stat, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="p-3 rounded-xl bg-white/5 border border-white/10"
                    >
                      <stat.icon className="w-4 h-4 text-gray-400 mb-1" />
                      <div className="text-lg font-bold">{stat.value}</div>
                      <div className="text-[10px] text-gray-500 uppercase">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Tokenomics Grid */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {tokenomics.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-white/5">
                      <Check className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-medium">{item.title}</div>
                        <div className="text-[10px] text-gray-500">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tech Stack */}
                <div className="flex flex-wrap gap-1.5">
                  {techStack.map((tech, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 text-[10px] font-mono bg-white/5 border border-white/10 rounded-full text-gray-400"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'features' && (
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                key="features"
                className="space-y-3"
              >
                <h2 className="text-2xl font-bold mb-4">Core Features</h2>
                {features.map((feature, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => setActiveFeature(i)}
                    className={`p-3 rounded-xl cursor-pointer transition-all ${
                      activeFeature === i 
                        ? 'bg-white/10 border border-white/20' 
                        : 'bg-white/5 border border-transparent hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${feature.color}30` }}
                      >
                        <feature.icon className="w-4 h-4" style={{ color: feature.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{feature.title}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
                            {feature.desc}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">{feature.details}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {activeTab === 'roadmap' && (
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                key="roadmap"
                className="space-y-3"
              >
                <h2 className="text-2xl font-bold mb-4">Development Roadmap</h2>
                {roadmap.map((phase, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`p-3 rounded-xl border ${
                      phase.status === 'current' 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : phase.status === 'completed'
                        ? 'bg-white/5 border-white/10 opacity-70'
                        : 'bg-white/5 border-white/10 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {phase.status === 'completed' ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : phase.status === 'current' ? (
                        <Rocket className="w-4 h-4 text-green-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="text-xs font-mono text-gray-400">{phase.phase}</span>
                      <span className="font-semibold text-sm">{phase.title}</span>
                      {phase.status === 'current' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                          In Progress
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1 pl-6">
                      {phase.items.map((item, j) => (
                        <div key={j} className="text-[11px] text-gray-400 flex items-center gap-1">
                          <div className="w-1 h-1 rounded-full bg-gray-500" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Bottom Security Badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-3 gap-2 mt-4"
          >
            <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-center">
              <Shield className="w-4 h-4 text-green-400 mx-auto mb-1" />
              <div className="text-[10px] font-medium">Non-Custodial</div>
            </div>
            <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-center">
              <Zap className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
              <div className="text-[10px] font-medium">Token Burns</div>
            </div>
            <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-center">
              <Globe className="w-4 h-4 text-red-400 mx-auto mb-1" />
              <div className="text-[10px] font-medium">Arena Native</div>
            </div>
          </motion.div>
        </div>

        {/* Right Panel - 55% Screenshot */}
        <div className="w-[55%] h-full flex flex-col p-6 lg:p-10">
          {/* Feature Selector */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex justify-end gap-2 mb-4"
          >
            {features.map((feature, i) => (
              <motion.button
                key={i}
                onClick={() => setActiveFeature(i)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  activeFeature === i ? '' : 'bg-white/5 hover:bg-white/10'
                }`}
                style={{
                  backgroundColor: activeFeature === i ? feature.color : undefined,
                  boxShadow: activeFeature === i ? `0 0 25px ${feature.color}40` : undefined,
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <feature.icon className="w-4 h-4" />
              </motion.button>
            ))}
          </motion.div>

          {/* Screenshot Display - Full Height */}
          <div className="flex-1 relative min-h-0">
            <motion.div
              key={activeFeature}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="relative h-full"
            >
              {/* Glow */}
              <div
                className="absolute -inset-3 rounded-3xl blur-xl opacity-30"
                style={{ backgroundColor: features[activeFeature].color }}
              />
              
              {/* Screenshot Container */}
              <div className="relative h-full rounded-2xl overflow-hidden border border-white/20 bg-black/50">
                <img
                  src={features[activeFeature].screenshot}
                  alt={features[activeFeature].title}
                  className="w-full h-full object-contain bg-gray-900"
                />
                
                {/* Bottom Overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div 
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-2"
                        style={{ backgroundColor: `${features[activeFeature].color}30`, color: features[activeFeature].color }}
                      >
                        {(() => {
                          const Icon = features[activeFeature].icon;
                          return <Icon className="w-3 h-3" />;
                        })()}
                        {features[activeFeature].desc}
                      </div>
                      <h3 className="text-2xl font-bold">{features[activeFeature].title}</h3>
                      <p className="text-xs text-gray-400 mt-1 max-w-md">{features[activeFeature].details}</p>
                    </div>
                    
                    {/* Feature Counter */}
                    <div className="text-right">
                      <div className="text-3xl font-bold" style={{ color: features[activeFeature].color }}>
                        {String(activeFeature + 1).padStart(2, '0')}
                      </div>
                      <div className="text-xs text-gray-500">/ {String(features.length).padStart(2, '0')}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Decorative Elements */}
              <motion.div
                className="absolute -top-2 -right-2 w-4 h-4 rounded-full"
                style={{ backgroundColor: features[activeFeature].color }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
          </div>

          {/* Progress Dots */}
          <div className="flex justify-center gap-2 mt-4">
            {features.map((_, i) => (
              <motion.button
                key={i}
                onClick={() => setActiveFeature(i)}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: activeFeature === i ? 28 : 8,
                  backgroundColor: activeFeature === i ? features[activeFeature].color : 'rgba(255,255,255,0.2)',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Corner Decorations */}
      <div className="absolute top-0 left-0 w-24 h-24 border-l-2 border-t-2 border-white/10 rounded-br-3xl" />
      <div className="absolute bottom-0 right-0 w-24 h-24 border-r-2 border-b-2 border-white/10 rounded-tl-3xl" />

      {/* Animated Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10">
        <motion.line
          x1="45%"
          y1="0"
          x2="45%"
          y2="100%"
          stroke={features[activeFeature].color}
          strokeWidth="1"
        />
      </svg>
    </div>
  );
};

export default Pitch;
