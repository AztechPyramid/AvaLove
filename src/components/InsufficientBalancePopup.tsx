import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InsufficientBalancePopupProps {
  isOpen: boolean;
  onClose: () => void;
  tokenSymbol: string;
  requiredAmount: number;
  tokenLogo?: string;
}

export const InsufficientBalancePopup = ({
  isOpen,
  onClose,
  tokenSymbol,
  requiredAmount,
  tokenLogo,
}: InsufficientBalancePopupProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <motion.div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          
          {/* Popup */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
            
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center"
              >
                <AlertTriangle className="w-8 h-8 text-amber-400" />
              </motion.div>
            </div>
            
            {/* Title */}
            <h3 className="text-xl font-bold text-white text-center mb-2">
              Insufficient Balance
            </h3>
            
            {/* Message */}
            <p className="text-white/70 text-center text-sm mb-4">
              {tokenSymbol === '$0.10 USD worth' ? (
                <>
                  You need at least <span className="text-amber-400 font-semibold">$0.10 USD</span> worth of any supported token with a DexScreener price to swipe.
                </>
              ) : (
                <>
                  You need at least{' '}
                  <span className="text-amber-400 font-semibold">
                    {requiredAmount.toLocaleString()} {tokenSymbol}
                  </span>{' '}
                  to complete this action.
                </>
              )}
            </p>
            
            {/* Divider */}
            <div className="h-px bg-white/10 my-4" />
            
            {/* Get token section */}
            <div className="text-center">
              <div className="flex flex-col items-center gap-3">
                {tokenLogo && (
                  <motion.img
                    src={tokenLogo}
                    alt={tokenSymbol}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white/20"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.15, type: "spring", stiffness: 400 }}
                  />
                )}
                <p className="text-white/80 text-sm flex items-center gap-1.5">
                  <ExternalLink className="w-4 h-4 text-amber-400" />
                  Get <span className="text-amber-400 font-semibold">{tokenSymbol}</span> to continue
                </p>
              </div>
            </div>
            
            {/* Action button */}
            <Button
              onClick={onClose}
              className="w-full mt-5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium"
            >
              Got it
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
