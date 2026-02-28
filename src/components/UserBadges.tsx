import { useBadges } from '@/hooks/useBadges';
import { BadgeDisplay, BadgeDisplayCompact } from '@/components/BadgeDisplay';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import * as LucideIcons from 'lucide-react';
import { motion } from 'framer-motion';

interface UserBadgesProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  maxBadges?: number;
  showNames?: boolean;
}

export const UserBadges = ({ userId, size = 'sm', maxBadges = 3, showNames = true }: UserBadgesProps) => {
  const { userBadges, loading } = useBadges(userId);

  if (loading || userBadges.length === 0) return null;

  const displayBadges = userBadges.slice(0, maxBadges);

  // Rarity config for tech styling
  const getRarityConfig = (rarity: string) => {
    const configs: Record<string, { gradient: string; glow: string; border: string; bg: string }> = {
      common: { 
        gradient: 'from-slate-400 to-slate-500', 
        glow: 'rgba(148,163,184,0.5)',
        border: 'border-slate-500/50',
        bg: 'from-slate-900 to-slate-800',
      },
      rare: { 
        gradient: 'from-cyan-400 to-blue-400', 
        glow: 'rgba(34,211,238,0.6)',
        border: 'border-cyan-500/50',
        bg: 'from-cyan-950 to-blue-950',
      },
      epic: { 
        gradient: 'from-violet-400 to-purple-400', 
        glow: 'rgba(168,85,247,0.7)',
        border: 'border-purple-500/50',
        bg: 'from-violet-950 to-purple-950',
      },
      legendary: { 
        gradient: 'from-amber-400 via-yellow-300 to-orange-400', 
        glow: 'rgba(251,191,36,0.8)',
        border: 'border-yellow-500/50',
        bg: 'from-amber-950 to-orange-950',
      },
    };
    return configs[rarity] || configs.common;
  };

  // If showNames is false, render compact tech badges with popover
  if (!showNames) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {displayBadges.map((userBadge, index) => {
          const IconComponent = (LucideIcons as any)[userBadge.badges.icon] || LucideIcons.Award;
          const config = getRarityConfig(userBadge.badges.rarity);

          return (
            <Popover key={userBadge.badge_id}>
              <PopoverTrigger asChild>
                <motion.button 
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.15, y: -2 }}
                  className="relative group focus:outline-none"
                  aria-label={`View ${userBadge.badges.name} badge details`}
                >
                  {/* Glow effect */}
                  <div 
                    className="absolute inset-0 rounded blur-md opacity-60 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: config.glow }}
                  />
                  
                  {/* Badge container - hextech style */}
                  <div 
                    className={`
                      relative w-7 h-7
                      flex items-center justify-center
                      bg-gradient-to-br ${config.bg}
                      ${config.border} border
                      rounded
                      cursor-pointer
                      overflow-hidden
                      backdrop-blur-sm
                    `}
                    style={{
                      clipPath: 'polygon(15% 0%, 85% 0%, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0% 85%, 0% 15%)',
                    }}
                  >
                    {/* Corner accent */}
                    <div className="absolute top-0 right-0 w-1 h-1 bg-white/30" />
                    <div className="absolute bottom-0 left-0 w-1 h-1 bg-white/30" />
                    
                    <IconComponent 
                      className={`w-3.5 h-3.5 bg-gradient-to-br ${config.gradient} bg-clip-text drop-shadow-lg relative z-10`} 
                      style={{ color: config.glow.replace('0.', '1)').replace(')', '')}}
                      strokeWidth={2} 
                    />
                    
                    {/* Legendary pulse */}
                    {userBadge.badges.rarity === 'legendary' && (
                      <motion.div
                        className="absolute inset-0 border border-yellow-400/50"
                        animate={{
                          scale: [1, 1.3, 1],
                          opacity: [0.5, 0, 0.5],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                        }}
                      />
                    )}
                  </div>
                </motion.button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-72 bg-black/95 backdrop-blur-xl border-white/10 p-0 overflow-hidden"
                style={{
                  clipPath: 'polygon(12px 0%, 100% 0%, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0% 100%, 0% 12px)',
                }}
              >
                {/* Top accent line */}
                <div className={`h-[2px] bg-gradient-to-r ${config.gradient}`} />
                
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    {/* Large badge icon */}
                    <div 
                      className={`
                        relative w-12 h-12
                        flex items-center justify-center
                        bg-gradient-to-br ${config.bg}
                        ${config.border} border
                        rounded
                      `}
                      style={{
                        clipPath: 'polygon(15% 0%, 85% 0%, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0% 85%, 0% 15%)',
                        boxShadow: `0 0 20px ${config.glow}`,
                      }}
                    >
                      <IconComponent 
                        className="w-6 h-6 drop-shadow-lg" 
                        style={{ color: config.glow.replace('0.', '1)').replace(')', '')}}
                        strokeWidth={2} 
                      />
                    </div>
                    
                    <div className="flex-1">
                      <h4 className={`font-bold uppercase tracking-wider text-sm bg-gradient-to-r ${config.gradient} bg-clip-text text-transparent`}>
                        {userBadge.badges.name}
                      </h4>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">
                        {userBadge.badges.rarity} BADGE
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-xs text-white/70 leading-relaxed border-l-2 border-white/10 pl-3">
                    {userBadge.badges.description}
                  </p>
                  
                  {/* Tech data footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className="text-[9px] uppercase tracking-[0.15em] text-white/30">
                      ACHIEVEMENT UNLOCKED
                    </span>
                    <div className="flex gap-1">
                      {[...Array(4)].map((_, i) => (
                        <div 
                          key={i} 
                          className={`w-1.5 h-1.5 rounded-sm ${
                            i < (['common', 'rare', 'epic', 'legendary'].indexOf(userBadge.badges.rarity) + 1) 
                              ? `bg-gradient-to-r ${config.gradient}` 
                              : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
        
        {/* Show remaining count if more badges */}
        {userBadges.length > maxBadges && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            <div className="w-7 h-7 flex items-center justify-center bg-white/5 border border-white/20 rounded text-[10px] font-bold text-white/60 backdrop-blur-sm"
              style={{
                clipPath: 'polygon(15% 0%, 85% 0%, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0% 85%, 0% 15%)',
              }}
            >
              +{userBadges.length - maxBadges}
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {displayBadges.map((userBadge, index) => (
        <motion.div
          key={userBadge.badge_id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <BadgeDisplay
            badge={userBadge.badges}
            size={size}
            showDescription={false}
          />
        </motion.div>
      ))}
    </div>
  );
};
