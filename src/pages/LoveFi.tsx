import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Zap, TrendingUp, Lock, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ALL_PROTOCOLS, PROTOCOL_LOGOS } from '@/config/lovefi';
import yieldYakLogo from '@/assets/yieldyak-logo.png';

// Protocol logo mapping
const protocolLogos: Record<string, string> = {
  'Aave': PROTOCOL_LOGOS.aave,
  'Trader Joe': PROTOCOL_LOGOS.joe
};

export default function LoveFi() {
  const navigate = useNavigate();
  const yieldYakStrategyCount = ALL_PROTOCOLS.find(p => p.id === 'yieldyak')?.strategies?.length ?? 0;

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.15),transparent_50%)]" />
        
        <div className="relative max-w-6xl mx-auto px-4 pt-8 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 mb-4">
              <Zap className="w-3 h-3 mr-1" />
              DeFi Aggregator
            </Badge>
            
            <h1 className="text-4xl md:text-5xl font-black mb-4">
              <span className="text-transparent bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 bg-clip-text">
                LoveFi
              </span>
            </h1>
            
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto mb-6">
              Access the best DeFi protocols on Avalanche. Auto-compound your yields 
              with institutional-grade strategies from trusted protocols.
            </p>

            {/* Security Features */}
            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-zinc-300">Audited Contracts</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <Lock className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-zinc-300">Non-Custodial</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-zinc-300">Auto-Compound</span>
              </div>
            </div>
          </motion.div>

          {/* Protocol Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* YieldYak Protocol Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card 
                className="bg-zinc-900/50 border-zinc-800 hover:border-emerald-500/50 transition-all cursor-pointer group overflow-hidden"
                onClick={() => navigate('/lovefi/yieldyak')}
              >
                <CardHeader className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex items-center gap-4 relative">
                    <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700 group-hover:border-emerald-500/50 transition-colors">
                      <img 
                        src={yieldYakLogo} 
                        alt="YieldYak" 
                        className="w-12 h-12 object-contain"
                      />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-white flex items-center gap-2">
                        YieldYak
                        <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">Live</Badge>
                      </CardTitle>
                      <CardDescription className="text-zinc-400">
                        Yield Optimizer
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="relative">
                  <p className="text-zinc-400 text-sm mb-4">
                    Auto-compounding yield optimizer on Avalanche. Maximize your returns with automated strategies.
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">
                        {yieldYakStrategyCount} Strategy{yieldYakStrategyCount === 1 ? '' : 'ies'}
                      </Badge>
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-emerald-400 group-hover:text-emerald-300"
                    >
                      View Strategies
                      <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Coming Soon Cards */}
            {['Aave', 'Trader Joe'].map((protocol, index) => (
              <motion.div
                key={protocol}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
              >
                <Card className="bg-zinc-900/30 border-zinc-800/50 opacity-60">
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50 overflow-hidden">
                        <img 
                          src={protocolLogos[protocol]} 
                          alt={protocol} 
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-zinc-500 flex items-center gap-2">
                          {protocol}
                          <Badge className="bg-zinc-800 text-zinc-500 text-xs">Soon</Badge>
                        </CardTitle>
                        <CardDescription className="text-zinc-600">
                          Coming Soon
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <p className="text-zinc-600 text-sm">
                      Additional DeFi protocol integration coming soon.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Info Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-12"
          >
            <Card className="bg-zinc-900/30 border-zinc-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  Security First
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-zinc-800/30 rounded-lg">
                    <h4 className="font-medium text-white mb-2">Non-Custodial</h4>
                    <p className="text-sm text-zinc-400">
                      Your funds remain in your wallet. We never hold your assets.
                    </p>
                  </div>
                  <div className="p-4 bg-zinc-800/30 rounded-lg">
                    <h4 className="font-medium text-white mb-2">Audited Protocols</h4>
                    <p className="text-sm text-zinc-400">
                      All integrated protocols have been professionally audited.
                    </p>
                  </div>
                  <div className="p-4 bg-zinc-800/30 rounded-lg">
                    <h4 className="font-medium text-white mb-2">Direct Interaction</h4>
                    <p className="text-sm text-zinc-400">
                      Transactions go directly to protocol contracts on-chain.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
