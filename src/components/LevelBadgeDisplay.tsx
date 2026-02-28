import * as LucideIcons from 'lucide-react';
import { useLevelBadge } from '@/hooks/useLevelBadge';
import { motion } from 'framer-motion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LevelBadgeDisplayProps {
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export const LevelBadgeDisplay = ({ size = 'md', showTooltip = true }: LevelBadgeDisplayProps) => {
  const { currentBadge, userLevel, loading } = useLevelBadge();

  if (loading || !userLevel || !currentBadge) return null;

  const IconComponent = (LucideIcons as any)[currentBadge.icon] || LucideIcons.Award;

  const tierConfig: Record<string, { gradient: string; glow: string; border: string; bg: string }> = {
    bronze: { 
      gradient: 'from-orange-500 to-amber-600', 
      glow: 'rgba(234,88,12,0.5)',
      border: 'border-orange-500/50',
      bg: 'from-orange-950 to-amber-950',
    },
    silver: { 
      gradient: 'from-slate-400 to-zinc-300', 
      glow: 'rgba(161,161,170,0.5)',
      border: 'border-zinc-400/50',
      bg: 'from-slate-900 to-zinc-900',
    },
    gold: { 
      gradient: 'from-yellow-400 to-amber-500', 
      glow: 'rgba(250,204,21,0.6)',
      border: 'border-yellow-500/50',
      bg: 'from-yellow-950 to-amber-950',
    },
    diamond: { 
      gradient: 'from-cyan-400 to-blue-400', 
      glow: 'rgba(34,211,238,0.7)',
      border: 'border-cyan-500/50',
      bg: 'from-cyan-950 to-blue-950',
    },
    legendary: { 
      gradient: 'from-violet-400 via-purple-400 to-fuchsia-400', 
      glow: 'rgba(168,85,247,0.8)',
      border: 'border-purple-500/50',
      bg: 'from-violet-950 to-purple-950',
    },
  };

  const config = tierConfig[currentBadge.tier] || tierConfig.bronze;

  const sizeClasses = {
    sm: { container: 'h-6 min-w-[70px]', icon: 'w-3 h-3', text: 'text-[8px]', level: 'text-[7px]' },
    md: { container: 'h-7 min-w-[90px]', icon: 'w-3.5 h-3.5', text: 'text-[9px]', level: 'text-[8px]' },
    lg: { container: 'h-8 min-w-[110px]', icon: 'w-4 h-4', text: 'text-[10px]', level: 'text-[9px]' },
  };

  const sizes = sizeClasses[size];

  const badge = (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05, y: -1 }}
      className="relative group cursor-pointer"
    >
      {/* Outer glow */}
      <div 
        className="absolute inset-0 rounded blur-md opacity-50 group-hover:opacity-80 transition-opacity"
        style={{ backgroundColor: config.glow }}
      />
      
      {/* Main container */}
      <div 
        className={`
          relative ${sizes.container} px-2.5
          flex items-center justify-center gap-1.5
          bg-gradient-to-br ${config.bg}
          ${config.border} border
          rounded
          overflow-hidden
          backdrop-blur-xl
        `}
        style={{
          clipPath: 'polygon(6px 0%, 100% 0%, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0% 100%, 0% 6px)',
        }}
      >
        {/* Top accent */}
        <div className={`absolute top-0 left-1.5 right-1.5 h-[1px] bg-gradient-to-r ${config.gradient} opacity-80`} />
        
        {/* Scan line for legendary */}
        {currentBadge.tier === 'legendary' && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/10 to-white/0"
            animate={{ y: ['-100%', '200%'] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          />
        )}
        
        {/* Icon */}
        <IconComponent 
          className={`${sizes.icon} drop-shadow-lg`} 
          style={{ color: config.glow.replace('0.', '1)').replace(')', '') }}
          strokeWidth={2}
        />
        
        {/* Badge name */}
        <span className={`
          ${sizes.text} font-bold uppercase tracking-[0.12em]
          bg-gradient-to-r ${config.gradient} bg-clip-text text-transparent
          whitespace-nowrap
        `}>
          {currentBadge.name}
        </span>
        
        {/* Level indicator */}
        <div className={`
          ${sizes.level} font-mono
          bg-white/10 px-1 rounded
          text-white/60
        `}>
          L{userLevel.level}
        </div>
        
        {/* Bottom accent */}
        <div className={`absolute bottom-0 left-1.5 right-1.5 h-[1px] bg-gradient-to-r ${config.gradient} opacity-40`} />
      </div>
    </motion.div>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent 
          className="bg-black/95 backdrop-blur-xl border-white/10 p-0 overflow-hidden"
          style={{
            clipPath: 'polygon(8px 0%, 100% 0%, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0% 100%, 0% 8px)',
          }}
        >
          {/* Top accent */}
          <div className={`h-[2px] bg-gradient-to-r ${config.gradient}`} />
          
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <IconComponent 
                className="w-5 h-5" 
                style={{ color: config.glow.replace('0.', '1)').replace(')', '') }}
              />
              <div>
                <p className={`font-bold uppercase tracking-wider text-sm bg-gradient-to-r ${config.gradient} bg-clip-text text-transparent`}>
                  {currentBadge.name}
                </p>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">
                  Level {userLevel.level}
                </p>
              </div>
            </div>
            
            <p className="text-xs text-white/60 border-l-2 border-white/10 pl-2">
              {currentBadge.description}
            </p>
            
            <div className="flex items-center justify-between pt-1 border-t border-white/10">
              <span className="text-[9px] text-white/30 uppercase tracking-wider">
                Range: {currentBadge.minLevel}-{currentBadge.maxLevel === 999 ? '∞' : currentBadge.maxLevel}
              </span>
              <div className="flex gap-0.5">
                {['bronze', 'silver', 'gold', 'diamond', 'legendary'].map((tier, i) => (
                  <div 
                    key={tier}
                    className={`w-1.5 h-1.5 rounded-sm ${
                      ['bronze', 'silver', 'gold', 'diamond', 'legendary'].indexOf(currentBadge.tier) >= i
                        ? `bg-gradient-to-r ${tierConfig[tier].gradient}`
                        : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
