import { AlertTriangle, ExternalLink, Fuel, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface InsufficientGasPopupProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: string;
  requiredBalance: string;
}

export const InsufficientGasPopup = ({
  isOpen,
  onClose,
  currentBalance,
  requiredBalance,
}: InsufficientGasPopupProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10060]"
          />
          
          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[10070] mx-auto max-w-sm"
          >
            <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-black border-2 border-red-500/40 rounded-2xl p-6 shadow-2xl shadow-red-500/10">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-zinc-800/80 hover:bg-zinc-700 transition-colors"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>

              <div className="flex flex-col items-center text-center space-y-4">
                {/* Warning Icon */}
                <div className="relative">
                  <div className="absolute inset-0 bg-red-500/30 rounded-full blur-xl animate-pulse" />
                  <div className="relative bg-red-500/20 rounded-full p-4 border-2 border-red-500/40">
                    <Fuel className="w-10 h-10 text-red-400" />
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    Insufficient AVAX Gas
                  </h3>
                  <p className="text-sm text-zinc-400">
                    You need AVAX to pay for transaction fees
                  </p>
                </div>

                {/* Balance Info */}
                <div className="w-full bg-zinc-800/60 rounded-xl p-4 border border-zinc-700/50 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Your Balance:</span>
                    <span className="text-red-400 font-mono font-semibold">
                      {parseFloat(currentBalance).toFixed(4)} AVAX
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Required:</span>
                    <span className="text-green-400 font-mono font-semibold">
                      ≥ {requiredBalance} AVAX
                    </span>
                  </div>
                  <div className="border-t border-zinc-700 pt-3">
                    <p className="text-xs text-amber-400/90">
                      💡 Please deposit at least {requiredBalance} AVAX to your wallet to cover gas fees for transactions.
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="w-full space-y-2">
                  <a
                    href="https://core.app/bridge/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:scale-[1.02]"
                  >
                    Bridge AVAX
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  
                  <Button
                    onClick={onClose}
                    variant="outline"
                    className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  >
                    Close
                  </Button>
                </div>

                {/* Avalanche Logo */}
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <img 
                    src="https://cryptologos.cc/logos/avalanche-avax-logo.svg" 
                    alt="AVAX" 
                    className="w-4 h-4"
                  />
                  <span>Avalanche C-Chain</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
