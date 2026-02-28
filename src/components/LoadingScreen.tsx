import { motion } from 'framer-motion';
import avloLogo from '@/assets/avlo-logo.jpg';

export const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 bg-black z-[9999] flex items-center justify-center overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Cyber grid */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(rgba(249, 115, 22, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(249, 115, 22, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
        
        {/* Floating orbs */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-br from-orange-500/30 to-pink-500/20 rounded-full blur-[100px]"
        />
      </div>

      {/* Logo with halo effect */}
      <div className="relative">
        {/* Multiple glow layers */}
        <motion.div
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full blur-3xl scale-150"
        />
        <div className="absolute inset-0 bg-orange-500/30 rounded-full blur-2xl scale-125" />
        
        {/* Rotating rings */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-[-12px] rounded-full border-2 border-dashed border-orange-500/40"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          className="absolute inset-[-24px] rounded-full border border-dashed border-pink-500/30"
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute inset-[-36px] rounded-full border border-dotted border-orange-500/20"
        />
        
        {/* Pulsing ring */}
        <motion.div
          animate={{ 
            scale: [1, 1.5, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
          className="absolute inset-[-4px] rounded-full border-2 border-orange-500"
        />
        
        {/* Logo */}
        <motion.img
          src={avloLogo}
          alt="AvaLove"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative w-24 h-24 md:w-32 md:h-32 rounded-full shadow-2xl border-4 border-orange-500/50"
        />
      </div>

      {/* Loading text */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="absolute bottom-[30%] text-center"
      >
        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="text-lg md:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500"
        >
          Loading AvaLove...
        </motion.p>
      </motion.div>
    </div>
  );
};
