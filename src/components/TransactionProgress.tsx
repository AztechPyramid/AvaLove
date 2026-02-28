import { Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import avloLogo from '@/assets/avlo-logo.jpg';

interface TransactionProgressProps {
  isOpen: boolean;
  status: "waiting" | "processing" | "success" | "error";
  message: string;
  txHash?: string | null;
  onClose?: () => void;
  tokenLogo?: string | null;
  tokenSymbol?: string;
  successTitle?: string;
}

export const TransactionProgress = ({ 
  isOpen, 
  status, 
  message,
  txHash,
  onClose,
  tokenLogo,
  tokenSymbol = 'AVLO',
  successTitle = 'Gift Sent! 🎁'
}: TransactionProgressProps) => {
  const logoSrc = tokenLogo || avloLogo;
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10040]"
          />
          
          {/* Progress Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-x-4 bottom-24 z-[10050] mx-auto w-[calc(100vw-2rem)] max-w-[420px] sm:bottom-auto sm:inset-x-auto sm:top-1/2 sm:left-1/2 sm:w-[90vw] sm:max-w-[420px] sm:-translate-x-1/2 sm:-translate-y-1/2"
          >
            <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-black border-2 border-orange-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl">
              <div className="flex flex-col items-center text-center space-y-4">
                {/* Icon with Token Logo */}
                <div className="relative">
                  {status === "waiting" && (
                    <div className="relative">
                      <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-xl animate-pulse" />
                      <div className="relative bg-orange-500/10 rounded-full p-3 border-2 border-orange-500/30">
                        {/* Token logo with spinning ring */}
                        <div className="relative w-16 h-16">
                          <motion.div
                            className="absolute inset-0 rounded-full border-4 border-transparent border-t-orange-500 border-r-orange-500/50"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                          />
                          <img 
                            src={logoSrc} 
                            alt={tokenSymbol}
                            className="w-full h-full rounded-full object-cover ring-2 ring-orange-500/30"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {status === "processing" && (
                    <div className="relative">
                      <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
                      <div className="relative bg-blue-500/10 rounded-full p-3 border-2 border-blue-500/30">
                        <div className="relative w-16 h-16">
                          <motion.div
                            className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 border-r-blue-500/50"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          />
                          <img 
                            src={logoSrc} 
                            alt={tokenSymbol}
                            className="w-full h-full rounded-full object-cover ring-2 ring-blue-500/30"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {status === "success" && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", duration: 0.5 }}
                      className="relative"
                    >
                      <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
                      <div className="relative bg-green-500/10 rounded-full p-3 border-2 border-green-500/30">
                        <div className="relative w-16 h-16">
                          <img 
                            src={logoSrc} 
                            alt={tokenSymbol}
                            className="w-full h-full rounded-full object-cover ring-2 ring-green-500/50"
                          />
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring" }}
                            className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1"
                          >
                            <CheckCircle2 className="w-5 h-5 text-white" />
                          </motion.div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  
                  {status === "error" && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", duration: 0.5 }}
                      className="relative"
                    >
                      <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl animate-pulse" />
                      <div className="relative bg-red-500/10 rounded-full p-3 border-2 border-red-500/30">
                        <div className="relative w-16 h-16">
                          <img 
                            src={logoSrc} 
                            alt={tokenSymbol}
                            className="w-full h-full rounded-full object-cover ring-2 ring-red-500/50 opacity-50"
                          />
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring" }}
                            className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-1"
                          >
                            <XCircle className="w-5 h-5 text-white" />
                          </motion.div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Token Symbol Badge */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 bg-zinc-800/80 px-3 py-1.5 rounded-full border border-zinc-700/50"
                >
                  <img src={logoSrc} alt={tokenSymbol} className="w-4 h-4 rounded-full" />
                  <span className="text-xs font-bold text-white">${tokenSymbol}</span>
                </motion.div>

                {/* Message */}
                <div className="space-y-2 px-2">
                  <h3 className="text-lg sm:text-xl font-bold text-white text-center">
                    {status === "waiting" && "Waiting for Approval"}
                    {status === "processing" && "Processing Transaction"}
                    {status === "success" && successTitle}
                    {status === "error" && "Transaction Failed"}
                  </h3>
                  <div className="text-xs sm:text-sm text-zinc-400 text-center leading-relaxed break-words whitespace-pre-line">
                    {message.split('\n\n').map((part, i) => (
                      <p key={i} className={part.includes('pending') || part.includes('⏳') ? "mt-3 text-amber-400/90 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20" : part.includes("match") || part.includes("🎉") ? "mt-3 text-green-400/90 bg-green-500/10 px-3 py-2 rounded-lg border border-green-500/20" : ""}>
                        {part}
                      </p>
                    ))}
                  </div>
                  
                  {/* Tip: Search users for faster matching */}
                  {status === "success" && message.includes('pending') && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="mt-3 text-xs text-cyan-400/80 bg-cyan-500/10 px-3 py-2 rounded-lg border border-cyan-500/20"
                    >
                      💡 <strong>Tip:</strong> Use the search bar to find and swipe on users who liked you for instant score!
                    </motion.div>
                  )}
                </div>

                {/* Transaction Hash & Explorer Link */}
                {txHash && (status === "processing" || status === "success") && (
                  <div className="w-full px-2 space-y-2">
                    <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                      <p className="text-xs text-zinc-400 mb-1">Transaction Hash</p>
                      <p className="text-xs text-zinc-300 font-mono break-all">
                        {txHash.slice(0, 10)}...{txHash.slice(-8)}
                      </p>
                    </div>
                    <a
                      href={`https://snowtrace.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-zinc-800/70 hover:bg-zinc-700/70 text-zinc-200 text-xs font-medium rounded-lg transition-all duration-200 border border-zinc-700/50 hover:border-orange-500/30"
                    >
                      View on Snowtrace
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Loading Animation */}
                {(status === "waiting" || status === "processing") && (
                  <div className="w-full px-4">
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-orange-500 via-yellow-500 to-orange-500 rounded-full"
                        animate={{
                          x: ["-100%", "100%"],
                        }}
                        transition={{
                          duration: 1.2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Close button for success/error */}
                {(status === "success" || status === "error") && onClose && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    onClick={onClose}
                    className="mt-2 px-8 py-2.5 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white text-sm font-semibold rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    Continue
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};