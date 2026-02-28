import { motion } from 'framer-motion';

interface ArenaArchLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  className?: string;
}

export const ArenaArchLogo = ({ size = 'md', animated = true, className = '' }: ArenaArchLogoProps) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-32 h-32',
    xl: 'w-48 h-48',
  };

  const strokeWidths = {
    sm: 2,
    md: 3,
    lg: 4,
    xl: 5,
  };

  const arches = [
    { rx: 45, ry: 50, delay: 0 },
    { rx: 38, ry: 42, delay: 0.1 },
    { rx: 31, ry: 34, delay: 0.2 },
    { rx: 24, ry: 26, delay: 0.3 },
    { rx: 17, ry: 18, delay: 0.4 },
    { rx: 10, ry: 10, delay: 0.5 },
  ];

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {arches.map((arch, index) => (
          <motion.path
            key={index}
            d={`M ${50 - arch.rx} 95 
                A ${arch.rx} ${arch.ry} 0 0 1 ${50 + arch.rx} 95`}
            stroke="url(#arenaGradient)"
            strokeWidth={strokeWidths[size]}
            strokeLinecap="round"
            fill="none"
            initial={animated ? { pathLength: 0, opacity: 0 } : { pathLength: 1, opacity: 1 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
              pathLength: { 
                duration: 0.8, 
                delay: arch.delay,
                ease: "easeOut" 
              },
              opacity: { 
                duration: 0.3, 
                delay: arch.delay 
              }
            }}
          />
        ))}
        
        {/* Center dot/entrance */}
        <motion.circle
          cx="50"
          cy="85"
          r="3"
          fill="url(#arenaGradient)"
          initial={animated ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.3 }}
        />
        
        <defs>
          <linearGradient id="arenaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

// Animated version with glow effect for Connect page
export const ArenaArchLogoAnimated = ({ className = '' }: { className?: string }) => {
  return (
    <div className={`relative ${className}`}>
      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-orange-500/30 to-pink-500/30 rounded-full blur-2xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      <div className="relative">
        <ArenaArchLogo size="xl" animated={true} />
        
        {/* "On The Arena" text */}
        <motion.div
          className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          <span className="text-xl font-bold bg-gradient-to-r from-orange-400 via-pink-500 to-orange-400 bg-clip-text text-transparent">
            On The Arena
          </span>
        </motion.div>
      </div>
    </div>
  );
};
