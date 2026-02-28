import { Award } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { motion } from 'framer-motion';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
}

interface BadgeDisplayProps {
  badge: Badge;
  size?: 'sm' | 'md' | 'lg';
  showDescription?: boolean;
}

export const BadgeDisplay = ({ badge, size = 'md', showDescription = true }: BadgeDisplayProps) => {
  const IconComponent = (LucideIcons as any)[badge.icon] || Award;
  
  const rarityConfig = {
    common: {
      gradient: 'from-slate-500 via-slate-400 to-slate-500',
      borderGradient: 'from-slate-400 via-slate-300 to-slate-400',
      glowColor: 'rgba(148,163,184,0.5)',
      iconColor: 'text-slate-200',
      bgColor: 'from-slate-900 via-slate-800 to-slate-900',
      label: 'COMMON',
      accentLine: 'bg-slate-400',
    },
    rare: {
      gradient: 'from-cyan-500 via-blue-400 to-cyan-500',
      borderGradient: 'from-cyan-400 via-blue-300 to-cyan-400',
      glowColor: 'rgba(34,211,238,0.6)',
      iconColor: 'text-cyan-300',
      bgColor: 'from-cyan-950 via-blue-950 to-cyan-950',
      label: 'RARE',
      accentLine: 'bg-cyan-400',
    },
    epic: {
      gradient: 'from-violet-500 via-purple-400 to-fuchsia-500',
      borderGradient: 'from-violet-400 via-purple-300 to-fuchsia-400',
      glowColor: 'rgba(168,85,247,0.7)',
      iconColor: 'text-purple-300',
      bgColor: 'from-violet-950 via-purple-950 to-fuchsia-950',
      label: 'EPIC',
      accentLine: 'bg-purple-400',
    },
    legendary: {
      gradient: 'from-amber-500 via-yellow-400 to-orange-500',
      borderGradient: 'from-amber-300 via-yellow-200 to-orange-300',
      glowColor: 'rgba(251,191,36,0.8)',
      iconColor: 'text-yellow-200',
      bgColor: 'from-amber-950 via-yellow-950 to-orange-950',
      label: 'LEGENDARY',
      accentLine: 'bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400',
    },
  };
  
  const config = rarityConfig[badge.rarity as keyof typeof rarityConfig] || rarityConfig.common;
  
  const sizeConfig = {
    sm: { 
      container: 'h-6 min-w-[80px]', 
      icon: 'w-3 h-3', 
      text: 'text-[8px]', 
      padding: 'px-2 py-0.5',
      corner: 'w-1 h-1',
    },
    md: { 
      container: 'h-7 min-w-[100px]', 
      icon: 'w-3.5 h-3.5', 
      text: 'text-[9px]', 
      padding: 'px-2.5 py-1',
      corner: 'w-1.5 h-1.5',
    },
    lg: { 
      container: 'h-8 min-w-[120px]', 
      icon: 'w-4 h-4', 
      text: 'text-[10px]', 
      padding: 'px-3 py-1.5',
      corner: 'w-2 h-2',
    },
  };
  
  const sizes = sizeConfig[size];
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05, y: -1 }}
      className="relative group"
      title={badge.description}
    >
      {/* Outer glow effect */}
      <div 
        className="absolute inset-0 rounded opacity-60 blur-md transition-opacity group-hover:opacity-100"
        style={{ backgroundColor: config.glowColor }}
      />
      
      {/* Main container - hextech inspired */}
      <div 
        className={`
          relative ${sizes.container} ${sizes.padding}
          flex items-center justify-center gap-1.5
          bg-gradient-to-br ${config.bgColor}
          border border-white/10
          rounded
          overflow-hidden
          backdrop-blur-xl
          cursor-pointer
        `}
        style={{
          clipPath: 'polygon(8px 0%, 100% 0%, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0% 100%, 0% 8px)',
        }}
      >
        {/* Top accent line */}
        <div className={`absolute top-0 left-2 right-2 h-[1px] ${config.accentLine} opacity-80`} />
        
        {/* Animated scan line */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/10 to-white/0 h-full"
          animate={{
            y: ['-100%', '200%'],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            repeatDelay: 4,
            ease: 'linear',
          }}
        />
        
        {/* Corner accents */}
        <div className={`absolute top-0 left-0 ${sizes.corner} border-t border-l ${config.borderGradient.includes('amber') ? 'border-amber-400' : config.borderGradient.includes('cyan') ? 'border-cyan-400' : config.borderGradient.includes('violet') ? 'border-violet-400' : 'border-slate-400'}`} />
        <div className={`absolute bottom-0 right-0 ${sizes.corner} border-b border-r ${config.borderGradient.includes('amber') ? 'border-amber-400' : config.borderGradient.includes('cyan') ? 'border-cyan-400' : config.borderGradient.includes('violet') ? 'border-violet-400' : 'border-slate-400'}`} />
        
        {/* Icon with glow */}
        <div className="relative">
          <IconComponent className={`${sizes.icon} ${config.iconColor} drop-shadow-lg relative z-10`} strokeWidth={2} />
          <div 
            className="absolute inset-0 blur-sm"
            style={{ backgroundColor: config.glowColor, opacity: 0.5 }}
          />
        </div>
        
        {/* Badge name with tech font styling */}
        <span className={`
          ${sizes.text} font-bold uppercase tracking-[0.15em]
          bg-gradient-to-r ${config.gradient} bg-clip-text text-transparent
          relative z-10 whitespace-nowrap
        `}>
          {badge.name}
        </span>
        
        {/* Legendary shimmer effect */}
        {badge.rarity === 'legendary' && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/20 to-transparent"
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              repeatDelay: 2,
            }}
          />
        )}
        
        {/* Bottom data line */}
        <div className={`absolute bottom-0 left-2 right-2 h-[1px] ${config.accentLine} opacity-40`} />
      </div>
    </motion.div>
  );
};

// Compact version for inline display (posts, cards, etc.) - Tech hexagon style
export const BadgeDisplayCompact = ({ badge }: { badge: Badge }) => {
  const IconComponent = (LucideIcons as any)[badge.icon] || Award;
  
  const rarityColors = {
    common: { 
      glow: 'rgba(148,163,184,0.5)', 
      border: 'border-slate-500/60',
      bg: 'from-slate-800 to-slate-900',
      icon: 'text-slate-300',
    },
    rare: { 
      glow: 'rgba(34,211,238,0.6)', 
      border: 'border-cyan-500/60',
      bg: 'from-cyan-900 to-blue-900',
      icon: 'text-cyan-300',
    },
    epic: { 
      glow: 'rgba(168,85,247,0.7)', 
      border: 'border-purple-500/60',
      bg: 'from-violet-900 to-purple-900',
      icon: 'text-purple-300',
    },
    legendary: { 
      glow: 'rgba(251,191,36,0.8)', 
      border: 'border-yellow-500/60',
      bg: 'from-amber-900 to-orange-900',
      icon: 'text-yellow-300',
    },
  };
  
  const colors = rarityColors[badge.rarity as keyof typeof rarityColors] || rarityColors.common;
  
  return (
    <motion.div
      whileHover={{ scale: 1.15, rotate: 5 }}
      className="relative group"
      title={`${badge.name} - ${badge.description}`}
    >
      {/* Glow effect */}
      <div 
        className="absolute inset-0 rounded blur-md opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: colors.glow }}
      />
      
      {/* Hexagon-ish container */}
      <div 
        className={`
          relative w-7 h-7
          flex items-center justify-center
          bg-gradient-to-br ${colors.bg}
          ${colors.border} border
          rounded
          cursor-pointer
          overflow-hidden
        `}
        style={{
          clipPath: 'polygon(15% 0%, 85% 0%, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0% 85%, 0% 15%)',
        }}
      >
        {/* Inner glow ring */}
        <div className="absolute inset-0.5 border border-white/10 rounded-sm" />
        
        <IconComponent className={`w-3.5 h-3.5 ${colors.icon} drop-shadow-lg relative z-10`} strokeWidth={2} />
        
        {/* Pulse for legendary */}
        {badge.rarity === 'legendary' && (
          <motion.div
            className="absolute inset-0 border border-yellow-400/50 rounded"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          />
        )}
      </div>
    </motion.div>
  );
};
