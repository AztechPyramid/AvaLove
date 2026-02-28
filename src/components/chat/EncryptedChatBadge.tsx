import { motion } from 'framer-motion';
import { Shield, Lock, Key, Fingerprint } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EncryptedChatBadgeProps {
  keyFingerprint: string;
  isInitialized: boolean;
}

export const EncryptedChatBadge = ({ keyFingerprint, isInitialized }: EncryptedChatBadgeProps) => {
  if (!isInitialized) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-zinc-800/50 border border-zinc-700/50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Key className="w-3 h-3 text-zinc-500" />
        </motion.div>
        <span className="text-[10px] text-zinc-500">Initializing...</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 cursor-help"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
          >
            <motion.div
              className="relative"
              animate={{ 
                boxShadow: ['0 0 0 0 rgba(16, 185, 129, 0)', '0 0 0 4px rgba(16, 185, 129, 0.3)', '0 0 0 0 rgba(16, 185, 129, 0)']
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <Lock className="w-2 h-2 text-emerald-300 absolute -bottom-0.5 -right-0.5" />
            </motion.div>
            <span className="text-[10px] font-medium text-emerald-400">E2E Encrypted</span>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent 
          side="bottom" 
          className="bg-zinc-900 border-emerald-500/30 p-4 max-w-xs"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">End-to-End Encrypted</p>
                <p className="text-[10px] text-zinc-400">AES-256-GCM Encryption</p>
              </div>
            </div>
            
            <div className="space-y-2 text-xs text-zinc-300">
              <div className="flex items-center gap-2">
                <Lock className="w-3 h-3 text-cyan-400" />
                <span>Messages are encrypted on your device</span>
              </div>
              <div className="flex items-center gap-2">
                <Key className="w-3 h-3 text-cyan-400" />
                <span>Only you and your match can read them</span>
              </div>
              <div className="flex items-center gap-2">
                <Fingerprint className="w-3 h-3 text-cyan-400" />
                <span>Even we can't access your messages</span>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-800">
              <p className="text-[10px] text-zinc-500">Security Key Fingerprint</p>
              <div className="flex items-center gap-2 mt-1">
                <code className="px-2 py-1 rounded bg-zinc-800 text-emerald-400 font-mono text-xs">
                  {keyFingerprint}
                </code>
                <span className="text-[10px] text-zinc-500">Verify with your match</span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
