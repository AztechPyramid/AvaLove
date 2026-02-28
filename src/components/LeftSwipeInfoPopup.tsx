import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LeftSwipeInfoPopupProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'cost' | 'insufficient';
  currentScore?: number;
}

export const LeftSwipeInfoPopup = ({
  isOpen,
  onClose,
  type = 'cost',
  currentScore = 0,
}: LeftSwipeInfoPopupProps) => {
  const isCost = type === 'cost';
  
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
          {/* Backdrop - more transparent */}
          <motion.div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          
          {/* Popup - semi-transparent */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl"
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
                className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  isCost 
                    ? 'bg-gradient-to-br from-orange-500/20 to-red-500/20' 
                    : 'bg-gradient-to-br from-red-500/20 to-pink-500/20'
                }`}
              >
                {isCost ? (
                  <Coins className="w-8 h-8 text-orange-400" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                )}
              </motion.div>
            </div>
            
            {/* Title */}
            <h3 className="text-xl font-bold text-white text-center mb-2">
              {isCost ? 'Left Swipe Cost' : 'Insufficient Score'}
            </h3>
            
            {/* Message */}
            <p className="text-white/70 text-center text-sm mb-4">
              {isCost ? (
                <>
                  Left swipes cost{' '}
                  <span className="text-orange-400 font-bold">10 Score</span> points.
                  <br />
                  <span className="text-white/50 text-xs mt-1 block">
                    Your Score will never drop below <span className="text-white">10</span>.
                  </span>
                </>
              ) : (
              <>
                  You need at least{' '}
                  <span className="text-red-400 font-bold">20 Score</span> to swipe left.
                  <br />
                  <span className="text-white/50 text-xs mt-1 block">
                    Your current score: <span className="text-white">{currentScore}</span>
                    <br />
                    Swipe right to earn Score points.
                  </span>
                </>
              )}
            </p>
            
            {/* Divider */}
            <div className="h-px bg-white/10 my-4" />
            
            {/* Tip section */}
            <div className="text-center">
              <p className="text-white/60 text-xs">
                {isCost 
                  ? '💡 Right swipes earn you +10 Score points!'
                  : '💡 Swipe right to earn +10 Score points!'
                }
              </p>
            </div>
            
            {/* Action button */}
            <Button
              onClick={onClose}
              className={`w-full mt-5 ${
                isCost 
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                  : 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600'
              } text-white font-medium`}
            >
              {isCost ? 'Got it!' : 'Understood'}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
