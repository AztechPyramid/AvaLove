import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Shield, TrendingUp, Info, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ALL_STRATEGIES, BENQI_USDC_STRATEGY } from '@/config/lovefi';
import { useLoveFi } from '@/hooks/useLoveFi';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { formatUnits } from 'ethers';
import yieldYakLogo from '@/assets/yieldyak-logo.png';
import { TransactionProgress } from '@/components/TransactionProgress';
export default function YieldYakStrategies() {
  const navigate = useNavigate();
  const { walletAddress } = useWalletAuth();
  const [selectedStrategy, setSelectedStrategy] = useState(BENQI_USDC_STRATEGY);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [activeTab, setActiveTab] = useState('deposit');

  const { 
    info, 
    loading, 
    deposit, 
    withdraw, 
    withdrawAll, 
    formatBalance,
    refresh,
    txProgress,
    closeTxProgress
  } = useLoveFi(selectedStrategy);

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    const success = await deposit(depositAmount);
    if (success) {
      setDepositAmount('');
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return;
    const success = await withdraw(withdrawAmount);
    if (success) {
      setWithdrawAmount('');
    }
  };

  const handleWithdrawAll = async () => {
    const success = await withdrawAll();
    if (success) {
      setWithdrawAmount('');
    }
  };

  // Format small amounts properly (e.g., BTC with 8 decimals) - no scientific notation
  const formatSmallAmount = (value: bigint, decimals: number) => {
    const formatted = formatUnits(value, decimals);
    const num = parseFloat(formatted);
    
    if (num === 0) return '0';
    // Always show decimal format, never scientific notation
    if (num < 0.00000001) return num.toFixed(12);
    if (num < 0.0000001) return num.toFixed(10);
    if (num < 0.000001) return num.toFixed(9);
    if (num < 0.0001) return num.toFixed(8);
    if (num < 0.01) return num.toFixed(6);
    if (num < 1) return num.toFixed(4);
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  const setMaxDeposit = () => {
    if (info?.tokenBalance) {
      // Use full precision for input value
      setDepositAmount(formatUnits(info.tokenBalance, selectedStrategy.depositToken.decimals));
    }
  };

  const setMaxWithdraw = () => {
    if (info?.userDeposits) {
      setWithdrawAmount(formatUnits(info.userDeposits, selectedStrategy.depositToken.decimals));
    }
  };

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent" />
        
        <div className="relative max-w-6xl mx-auto px-4 pt-6 pb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/lovefi')}
            className="text-zinc-400 hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to LoveFi
          </Button>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center overflow-hidden border border-emerald-500/30">
              <img src={yieldYakLogo} alt="YieldYak" className="w-12 h-12 object-contain" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white flex items-center gap-2">
                YieldYak Strategies
                <Badge className="bg-emerald-500/20 text-emerald-400">Live</Badge>
              </h1>
              <p className="text-zinc-400">Auto-compounding yield optimizer on Avalanche</p>
            </div>
            <a 
              href="https://yieldyak.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-auto"
            >
              <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300">
                <ExternalLink className="w-4 h-4 mr-2" />
                Website
              </Button>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Strategy List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-bold text-white mb-4">Available Strategies</h2>
            
            {ALL_STRATEGIES.map((strategy) => (
              <motion.div
                key={strategy.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Card 
                  className={`bg-zinc-900/50 border-zinc-800 cursor-pointer transition-all ${
                    selectedStrategy.id === strategy.id 
                      ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' 
                      : 'hover:border-zinc-700'
                  }`}
                  onClick={() => setSelectedStrategy(strategy)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img 
                          src={strategy.depositToken.logoUrl} 
                          alt={strategy.depositToken.symbol}
                          className="w-10 h-10 rounded-full"
                        />
                        <img 
                          src={strategy.protocolLogoUrl}
                          alt={strategy.protocolName}
                          className="w-5 h-5 rounded-full absolute -bottom-1 -right-1 border-2 border-zinc-900"
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-white">{strategy.name}</h3>
                        <p className="text-xs text-zinc-400">{strategy.protocolName}</p>
                      </div>
                      <Badge 
                        className={`text-xs ${
                          strategy.riskLevel === 'low' 
                            ? 'bg-green-500/20 text-green-400' 
                            : strategy.riskLevel === 'medium'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {strategy.riskLevel}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-3">
                      {strategy.features.map((feature) => (
                        <Badge 
                          key={feature} 
                          variant="outline" 
                          className="text-xs border-zinc-700 text-zinc-400"
                        >
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Strategy Details & Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Strategy Info Card */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img 
                        src={selectedStrategy.depositToken.logoUrl} 
                        alt={selectedStrategy.depositToken.symbol}
                        className="w-12 h-12 rounded-full"
                      />
                      <img 
                        src={selectedStrategy.protocolLogoUrl}
                        alt={selectedStrategy.protocolName}
                        className="w-6 h-6 rounded-full absolute -bottom-1 -right-1 border-2 border-zinc-900"
                      />
                    </div>
                    <div>
                      <CardTitle className="text-white">{selectedStrategy.name}</CardTitle>
                      <CardDescription>{selectedStrategy.description}</CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={refresh}>
                    <TrendingUp className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Your Deposit</p>
                    <p className="text-lg font-bold text-white">
                      {info ? formatBalance(info.userDeposits, selectedStrategy.depositToken.decimals) : '0.00'}
                      <span className="text-xs text-zinc-400 ml-1">{selectedStrategy.depositToken.symbol}</span>
                    </p>
                  </div>
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Wallet Balance</p>
                    <p className="text-lg font-bold text-white">
                      {info ? formatBalance(info.tokenBalance, selectedStrategy.depositToken.decimals) : '0.00'}
                      <span className="text-xs text-zinc-400 ml-1">{selectedStrategy.depositToken.symbol}</span>
                    </p>
                  </div>
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Total Deposits</p>
                    <p className="text-lg font-bold text-emerald-400">
                      {info ? formatBalance(info.totalDeposits, selectedStrategy.depositToken.decimals) : '...'}
                      <span className="text-xs text-zinc-400 ml-1">{selectedStrategy.depositToken.symbol}</span>
                    </p>
                  </div>
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      {info?.depositsEnabled ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span className="text-green-400 font-medium">Active</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          <span className="text-yellow-400 font-medium">Paused</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Deposit/Withdraw Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid grid-cols-2 bg-zinc-800/50">
                    <TabsTrigger value="deposit" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                      Deposit
                    </TabsTrigger>
                    <TabsTrigger value="withdraw" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
                      Withdraw
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="deposit" className="mt-4">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm text-zinc-400">Amount to Deposit</label>
                          <button 
                            onClick={setMaxDeposit}
                            className="text-xs text-emerald-400 hover:text-emerald-300"
                          >
                            Max: {info ? formatSmallAmount(info.tokenBalance, selectedStrategy.depositToken.decimals) : '0'}
                          </button>
                        </div>
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            className="bg-zinc-800 border-zinc-700 text-white pr-20"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
                            {selectedStrategy.depositToken.symbol}
                          </span>
                        </div>
                      </div>

                      <Button 
                        onClick={handleDeposit}
                        disabled={loading || !depositAmount || parseFloat(depositAmount) <= 0}
                        className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          'Deposit'
                        )}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="withdraw" className="mt-4">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm text-zinc-400">Amount to Withdraw</label>
                          <button 
                            onClick={setMaxWithdraw}
                            className="text-xs text-orange-400 hover:text-orange-300"
                          >
                            Max: {info ? formatSmallAmount(info.userDeposits, selectedStrategy.depositToken.decimals) : '0'}
                          </button>
                        </div>
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            className="bg-zinc-800 border-zinc-700 text-white pr-20"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
                            {selectedStrategy.depositToken.symbol}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Button 
                          onClick={handleWithdraw}
                          disabled={loading || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                          variant="outline"
                          className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Withdraw'}
                        </Button>
                        <Button 
                          onClick={handleWithdrawAll}
                          disabled={loading || !info?.userShares || info.userShares === BigInt(0)}
                          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Withdraw All'}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Security Info */}
            <Card className="bg-zinc-900/30 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-emerald-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white mb-1">Security Notice</h4>
                    <p className="text-sm text-zinc-400">
                      This strategy interacts directly with YieldYak's audited smart contracts on Avalanche. 
                      Your funds are deposited into the protocol's vault and are not held by LoveFi. 
                      Always verify transaction details before confirming.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contract Info */}
            <Card className="bg-zinc-900/30 border-zinc-800">
              <CardContent className="p-4">
                <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-zinc-400" />
                  Contract Details
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Strategy Contract</span>
                    <a 
                      href={`https://snowtrace.io/address/${selectedStrategy.strategyContract}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      {selectedStrategy.strategyContract.slice(0, 6)}...{selectedStrategy.strategyContract.slice(-4)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Deposit Token</span>
                    <a 
                      href={`https://snowtrace.io/address/${selectedStrategy.depositToken.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      {selectedStrategy.depositToken.symbol} ({selectedStrategy.depositToken.address.slice(0, 6)}...{selectedStrategy.depositToken.address.slice(-4)})
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Transaction Progress Popup */}
      <TransactionProgress
        isOpen={txProgress.isOpen}
        status={txProgress.status}
        message={txProgress.message}
        txHash={txProgress.txHash}
        onClose={closeTxProgress}
        tokenLogo={selectedStrategy?.depositToken.logoUrl}
        tokenSymbol={selectedStrategy?.depositToken.symbol}
        successTitle={
          txProgress.type === 'approval' 
            ? 'Approval Complete! ✅' 
            : txProgress.type === 'deposit' 
            ? 'Deposit Successful! 🎉'
            : 'Withdrawal Complete! 💰'
        }
      />
    </div>
  );
}
