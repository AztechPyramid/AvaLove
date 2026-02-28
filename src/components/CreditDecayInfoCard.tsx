import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  TrendingDown, Clock, Wifi, WifiOff, ChevronDown, ChevronUp, 
  Zap, AlertTriangle, Activity, ArrowRight, Coins, Timer, DollarSign
} from 'lucide-react';

interface CreditDecayInfoCardProps {
  defaultOpen?: boolean;
}

export function CreditDecayInfoCard({ defaultOpen = false }: CreditDecayInfoCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-black border border-orange-500/30 shadow-2xl shadow-orange-500/10 mb-8 relative overflow-hidden">
        {/* Tech grid background */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(249, 115, 22, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(249, 115, 22, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '30px 30px',
          }}
        />
        {/* Gradient accent */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-500 via-red-500 to-pink-500" />
        
        <CollapsibleTrigger asChild>
          <button className="w-full p-6 sm:p-8 flex items-center justify-between hover:bg-white/5 transition-colors relative z-10">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="p-3 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-2xl border border-orange-500/30">
                  <Coins className="w-6 h-6 text-orange-400" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full animate-pulse" />
              </div>
              <div className="text-left">
                <h2 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-orange-400" />
                  Offline Credit Decay
                </h2>
                <p className="text-zinc-500 text-sm font-mono">// Credits decrease when offline • Capped at earned amount</p>
              </div>
            </div>
            {isOpen ? (
              <ChevronUp className="w-6 h-6 text-orange-400" />
            ) : (
              <ChevronDown className="w-6 h-6 text-orange-400" />
            )}
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-6 sm:px-8 pb-6 sm:pb-8 relative z-10">
            <div className="space-y-4 text-zinc-300 leading-relaxed">
              <p className="border-l-2 border-orange-500/50 pl-4 text-sm">
                <span className="text-orange-400 font-semibold font-mono">&gt;</span> Your unpaid AVLO credits <span className="text-red-400 font-semibold">decrease in real-time</span> when you're offline. Credits decay at the same rate you earn them — but <span className="text-green-400 font-semibold">can never go below 0</span>.
              </p>

              <div className="grid sm:grid-cols-2 gap-4 my-6">
                {/* Decay Rate */}
                <div className="bg-black border border-orange-500/30 rounded-xl p-4 hover:border-orange-500/60 transition-all group">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/30 group-hover:border-orange-500/60">
                      <Timer className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <span className="text-white font-bold text-lg">1 credit/sec</span>
                      <p className="text-xs text-zinc-500">Decay rate = Earn rate</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    For every <span className="text-orange-400 font-bold">second</span> you're offline, your unpaid credits decrease at the <span className="text-red-400 font-bold">same rate you earn</span> (admin-configured).
                  </p>
                </div>

                {/* Credit Protection */}
                <div className="bg-black border border-green-500/30 rounded-xl p-4 hover:border-green-500/60 transition-all group">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/30 group-hover:border-green-500/60">
                      <Wifi className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <span className="text-white font-bold text-lg">Online = Safe</span>
                      <p className="text-xs text-zinc-500">No decay while active</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    While you're <span className="text-green-400 font-bold">online and active</span>, your credits are protected. Decay only applies when you disconnect.
                  </p>
                </div>
              </div>

              {/* How It Works */}
              <div className="bg-black/50 border border-zinc-800 rounded-xl p-4">
                <h4 className="text-white font-bold mb-3 flex items-center gap-2 font-mono text-sm">
                  <Activity className="w-4 h-4 text-orange-400" />
                  <span className="text-orange-400">credit</span>.<span className="text-red-400">decay</span>.<span className="text-white">logic</span>()
                </h4>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-start gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <span className="text-green-400 font-bold w-6">01</span>
                    <span className="text-zinc-400">User earns <span className="text-green-400 font-bold">4,060 AVLO</span> from games/videos/swaps</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <span className="text-amber-400 font-bold w-6">02</span>
                    <span className="text-zinc-400">User goes <span className="text-red-400 font-bold">offline for 1 hour</span> (3,600 seconds)</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <span className="text-red-400 font-bold w-6">03</span>
                    <span className="text-zinc-400">Decay = <span className="text-orange-400 font-bold">3,600 credits</span> (but capped at earnings)</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <span className="text-green-400 font-bold w-6">04</span>
                    <span className="text-zinc-400">New balance = <span className="text-green-400 font-bold">460 AVLO</span> (4,060 - 3,600)</span>
                  </div>
                </div>
              </div>

              {/* Key Points */}
              <div className="relative overflow-hidden rounded-xl bg-zinc-900/50 border border-zinc-700/50 p-4">
                <h5 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  Key Points
                </h5>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                    <ArrowRight className="w-3 h-3 text-orange-400 shrink-0" />
                    <span>Decay <span className="text-orange-400 font-semibold">CANNOT exceed</span> your total unpaid earnings</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                    <ArrowRight className="w-3 h-3 text-green-400 shrink-0" />
                    <span>Credits <span className="text-green-400 font-semibold">never go negative</span> — minimum is 0 AVLO</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                    <ArrowRight className="w-3 h-3 text-red-400 shrink-0" />
                    <span>Decay is recorded as <span className="text-red-400 font-semibold">"Offline Decay"</span> in your credit history</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                    <ArrowRight className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>Decay applies on <span className="text-cyan-400 font-semibold">next login</span> — we calculate time since last activity</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                    <ArrowRight className="w-3 h-3 text-green-400 shrink-0" />
                    <span><span className="text-green-400 font-semibold">Earn more</span> by staying active — play games, watch videos, swap tokens!</span>
                  </div>
                </div>
              </div>

              {/* Visual indicator */}
              <div className="flex items-center justify-center gap-4 py-2 px-4 bg-gradient-to-r from-green-500/10 via-orange-500/10 to-red-500/10 rounded-lg border border-orange-500/20 flex-wrap">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-bold text-green-400">Earn Credits</span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600" />
                <div className="flex items-center gap-2">
                  <WifiOff className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-zinc-400">Go Offline</span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600" />
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-bold text-orange-400">Credits Decay</span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600" />
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-zinc-400">Less Payout</span>
                </div>
              </div>

              <p className="text-center text-orange-400/80 font-mono text-xs mt-4 p-2 bg-orange-500/5 border border-orange-500/20 rounded-lg">
                <Zap className="w-3 h-3 inline mr-1" />
                Stay active to protect your earnings! Offline users lose credits — active users get paid!
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
