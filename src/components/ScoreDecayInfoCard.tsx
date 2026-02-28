import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  TrendingDown, Clock, Wifi, WifiOff, ChevronDown, ChevronUp, 
  Zap, AlertTriangle, Timer, Activity, ArrowRight, Gift, Calendar, Ban
} from 'lucide-react';

interface ScoreDecayInfoCardProps {
  defaultOpen?: boolean;
}

export function ScoreDecayInfoCard({ defaultOpen = false }: ScoreDecayInfoCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-black border border-amber-500/30 shadow-2xl shadow-amber-500/10 mb-8 relative overflow-hidden">
        {/* Tech grid background */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(245, 158, 11, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(245, 158, 11, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '30px 30px',
          }}
        />
        {/* Gradient accent */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-500 via-orange-500 to-red-500" />
        
        <CollapsibleTrigger asChild>
          <button className="w-full p-6 sm:p-8 flex items-center justify-between hover:bg-white/5 transition-colors relative z-10">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="p-3 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl border border-amber-500/30">
                  <TrendingDown className="w-6 h-6 text-amber-400" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-pulse" />
              </div>
              <div className="text-left">
                <h2 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent flex items-center gap-2">
                  <Timer className="w-5 h-5 text-amber-400" />
                  Score Decay & Daily Bonus
                </h2>
                <p className="text-zinc-500 text-sm font-mono">// Stay active • 1 min offline = -1 score • Daily +60 bonus</p>
              </div>
            </div>
            {isOpen ? (
              <ChevronUp className="w-6 h-6 text-amber-400" />
            ) : (
              <ChevronDown className="w-6 h-6 text-amber-400" />
            )}
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-6 sm:px-8 pb-6 sm:pb-8 relative z-10">
            <div className="space-y-4 text-zinc-300 leading-relaxed">
              <p className="border-l-2 border-amber-500/50 pl-4 text-sm">
                <span className="text-amber-400 font-semibold font-mono">&gt;</span> Your score <span className="text-red-400 font-semibold">decays in real-time</span> when you're offline, but you get a <span className="text-green-400 font-semibold">+60 daily login bonus</span> to keep you earning!
              </p>

              {/* Daily Login Bonus Section */}
              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/40">
                    <Gift className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                      Daily Login Bonus
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">+60 Score</span>
                    </h3>
                    <p className="text-xs text-zinc-500 font-mono">Claim once every 24 hours</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  <div className="bg-black/30 rounded-lg p-3 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-green-400" />
                      <span className="text-white font-semibold text-sm">Daily Reset</span>
                    </div>
                    <p className="text-xs text-zinc-400">Log in each day to claim your <span className="text-green-400 font-bold">+60 score bonus</span></p>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3 border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown className="w-4 h-4 text-amber-400" />
                      <span className="text-white font-semibold text-sm">Decay Applies</span>
                    </div>
                    <p className="text-xs text-zinc-400">Bonus score <span className="text-amber-400 font-bold">decays when offline</span> like normal score</p>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3 border border-red-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Ban className="w-4 h-4 text-red-400" />
                      <span className="text-white font-semibold text-sm">No Stacking</span>
                    </div>
                    <p className="text-xs text-zinc-400">Missed days <span className="text-red-400 font-bold">don't accumulate</span> — claim daily!</p>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 my-6">
                {/* Decay Rate */}
                <div className="bg-black border border-amber-500/30 rounded-xl p-4 hover:border-amber-500/60 transition-all group">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/30 group-hover:border-amber-500/60">
                      <TrendingDown className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <span className="text-white font-bold text-lg">1 min = -1 Score</span>
                      <p className="text-xs text-zinc-500">Decay rate</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    For every <span className="text-orange-400 font-bold">1 minute</span> you're offline, your score decreases by <span className="text-red-400 font-bold">1 point</span>. This decay is <span className="text-amber-400 font-semibold">permanent</span> once applied.
                  </p>
                </div>

                {/* Online Protection */}
                <div className="bg-black border border-green-500/30 rounded-xl p-4 hover:border-green-500/60 transition-all group">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/30 group-hover:border-green-500/60">
                      <Wifi className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <span className="text-white font-bold text-lg">Online = Protected</span>
                      <p className="text-xs text-zinc-500">No decay while active</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    While you're <span className="text-green-400 font-bold">online and active</span> on the platform, your score is protected. No decay occurs when you're connected.
                  </p>
                </div>
              </div>

              {/* How It Works */}
              <div className="bg-black/50 border border-zinc-800 rounded-xl p-4">
                <h4 className="text-white font-bold mb-3 flex items-center gap-2 font-mono text-sm">
                  <Activity className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-400">daily</span>.<span className="text-green-400">bonus</span>.<span className="text-white">lifecycle</span>()
                </h4>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-start gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <span className="text-green-400 font-bold w-6">01</span>
                    <span className="text-zinc-400">User logs in → <span className="text-green-400 font-bold">+60 daily bonus</span> automatically granted</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <span className="text-amber-400 font-bold w-6">02</span>
                    <span className="text-zinc-400">User goes <span className="text-red-400 font-bold">offline</span> → Decay timer starts on all score</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <span className="text-amber-400 font-bold w-6">03</span>
                    <span className="text-zinc-400">60 minutes offline → <span className="text-red-400 font-bold">All 60 bonus points decayed</span></span>
                  </div>
                  <div className="flex items-start gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <span className="text-green-400 font-bold w-6">04</span>
                    <span className="text-zinc-400">Next day login → <span className="text-green-400 font-bold">Fresh +60 bonus</span> (doesn't stack with missed days)</span>
                  </div>
                </div>
              </div>

              {/* Key Points */}
              <div className="relative overflow-hidden rounded-xl bg-zinc-900/50 border border-zinc-700/50 p-4">
                <h5 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Key Points
                </h5>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                    <ArrowRight className="w-3 h-3 text-green-400 shrink-0" />
                    <span><span className="text-green-400 font-semibold">+60 score daily bonus</span> on first login of each day</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                    <ArrowRight className="w-3 h-3 text-red-400 shrink-0" />
                    <span>Bonus <span className="text-red-400 font-semibold">does NOT stack</span> — missed days don't accumulate</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                    <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Decay is <span className="text-white font-semibold">calculated in real-time</span> based on your last activity</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                    <ArrowRight className="w-3 h-3 text-red-400 shrink-0" />
                    <span>Score <span className="text-red-400 font-semibold">cannot go below 0</span> from decay alone (Time Debt is separate)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                    <ArrowRight className="w-3 h-3 text-green-400 shrink-0" />
                    <span><span className="text-green-400 font-semibold">Online users</span> have a green glow in leaderboards</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                    <ArrowRight className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>Recover score via <span className="text-cyan-400 font-semibold">swaps, matches, or platform activity</span></span>
                  </div>
                </div>
              </div>

              {/* Visual indicator */}
              <div className="flex items-center justify-center gap-4 py-2 px-4 bg-gradient-to-r from-green-500/10 via-amber-500/10 to-red-500/10 rounded-lg border border-amber-500/20 flex-wrap">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-bold text-green-400">+60 Daily</span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600" />
                <div className="flex items-center gap-2">
                  <WifiOff className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-zinc-400">Offline</span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600" />
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-400">-1/min</span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600" />
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-zinc-400">Less Time</span>
                </div>
              </div>

              <p className="text-center text-amber-400/80 font-mono text-xs mt-4 p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <Zap className="w-3 h-3 inline mr-1" />
                Log in daily for your +60 bonus, then stay active to keep it! Inactive users decay — active users thrive!
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}