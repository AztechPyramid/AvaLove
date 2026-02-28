import { useState, useEffect, useCallback } from 'react';
import { ArrowDownUp, RefreshCw, AlertTriangle, CheckCircle2, Loader2, ArrowDown, ChevronDown, Shield, Zap, Info, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSwap } from '@/hooks/useSwap';
import { SWAP_TOKENS, SwapTokenSymbol, VELORA_CONFIG } from '@/config/swap';
import { formatUnits } from 'ethers';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import SwapProgressDialog from '@/components/swap/SwapProgressDialog';
import SwapVolumeLeaderboard from '@/components/swap/SwapVolumeLeaderboard';
import { InsufficientGasPopup } from '@/components/InsufficientGasPopup';
import avloLogo from '@/assets/avlo-token-logo.jpg';
import arenaLogo from '@/assets/arena-token-logo.jpg';

const MIN_GAS_REQUIRED = '0.01';

const TOKEN_LOGOS: Record<string, string> = {
  ARENA: arenaLogo,
  AVLO: avloLogo,
};

const PERCENTAGE_OPTIONS = [25, 50, 75, 100];

const Swap = () => {
  const { profile } = useWalletAuth();
  const {
    isLoading,
    isApproving,
    isSwapping,
    quote,
    error,
    tokenPrices,
    balances,
    pairInfo,
    getQuote,
    executeSwap,
    approveSwapToken,
    checkApproval,
    clearError,
    clearQuote,
    refreshBalances,
    refreshPrices,
    isConnected,
    walletAddress,
  } = useSwap();

  const [srcToken, setSrcToken] = useState<SwapTokenSymbol>('ARENA');
  const [destToken, setDestToken] = useState<SwapTokenSymbol>('AVLO');
  const [srcAmount, setSrcAmount] = useState('');
  const [destAmount, setDestAmount] = useState('');
  const slippage = VELORA_CONFIG.DEFAULT_SLIPPAGE / 100;
  
  // 2-stage dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [swapStage, setSwapStage] = useState<'idle' | 'approving' | 'approved' | 'swapping' | 'success' | 'error'>('idle');
  const [scoreEarned, setScoreEarned] = useState(0);
  const [avloRewardEarned, setAvloRewardEarned] = useState(0);
  const [rewardUsdEarned, setRewardUsdEarned] = useState(0);
  const [swapError, setSwapError] = useState('');
  
  // Gas check state
  const [avaxBalance, setAvaxBalance] = useState('0');
  const [showGasPopup, setShowGasPopup] = useState(false);
  
  // Fetch AVAX balance for gas check
  useEffect(() => {
    const fetchAvaxBalance = async () => {
      if (!walletAddress) return;
      try {
        const response = await fetch('https://api.avax.network/ext/bc/C/rpc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getBalance',
            params: [walletAddress, 'latest'],
            id: 1,
          }),
        });
        const data = await response.json();
        if (data.result) {
          const balanceWei = BigInt(data.result);
          const balanceAvax = Number(balanceWei) / 1e18;
          setAvaxBalance(balanceAvax.toString());
        }
      } catch (err) {
        console.error('Failed to fetch AVAX balance:', err);
      }
    };
    
    fetchAvaxBalance();
    const interval = setInterval(fetchAvaxBalance, 60000);
    return () => clearInterval(interval);
  }, [walletAddress]);
  
  const hasEnoughGas = parseFloat(avaxBalance) >= parseFloat(MIN_GAS_REQUIRED);

  // Debounced quote fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      if (srcAmount && parseFloat(srcAmount) > 0) {
        getQuote(srcToken, destToken, srcAmount);
      } else {
        setDestAmount('');
        clearQuote();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [srcAmount, srcToken, destToken, getQuote, clearQuote]);

  // Update dest amount when quote changes
  useEffect(() => {
    if (quote) {
      const formatted = formatUnits(quote.destAmount, SWAP_TOKENS[destToken].decimals);
      setDestAmount(parseFloat(formatted).toFixed(6));
    }
  }, [quote, destToken]);

  const handleSwapTokens = useCallback(() => {
    const tempSrc = srcToken;
    const tempAmount = destAmount;
    setSrcToken(destToken);
    setDestToken(tempSrc);
    setSrcAmount(tempAmount);
    setDestAmount('');
    clearQuote();
  }, [srcToken, destToken, destAmount, clearQuote]);

  const handlePercentageClick = useCallback((percentage: number) => {
    const balance = balances[srcToken];
    if (!balance) return;
    
    const balanceFloat = parseFloat(balance.formatted);
    // Use 99% instead of 100% to avoid precision/rounding issues that cause reverts
    const effectivePercentage = percentage === 100 ? 99 : percentage;
    const amount = (balanceFloat * effectivePercentage) / 100;
    
    setSrcAmount(amount > 0 ? amount.toFixed(6) : '0');
  }, [balances, srcToken]);

  const handleSwap = async () => {
    if (!quote || !profile?.id) return;
    
    // Check for minimum gas before proceeding
    if (!hasEnoughGas) {
      setShowGasPopup(true);
      return;
    }

    // SECURITY: Check balance BEFORE attempting swap
    const srcBalance = balances[srcToken];
    const requiredAmount = parseFloat(srcAmount);
    const availableBalance = srcBalance ? parseFloat(srcBalance.formatted) : 0;
    
    if (availableBalance < requiredAmount) {
      toast.error(`Insufficient ${srcToken} balance. You have ${formatNumber(availableBalance, 4)} but need ${formatNumber(requiredAmount, 4)}`);
      return;
    }
    
    setDialogOpen(true);
    setSwapStage('idle');
    setSwapError('');
    setScoreEarned(0);
    setAvloRewardEarned(0);

    try {
      // Step 1: Check if approval is needed
      const isApproved = await checkApproval(srcToken, quote.srcAmount);
      
      if (!isApproved) {
        // Need approval - show approval stage
        setSwapStage('approving');
        const approvalSuccess = await approveSwapToken(srcToken);
        
        if (!approvalSuccess) {
          setSwapStage('error');
          setSwapError('Token approval failed or was rejected');
          return;
        }
        
        setSwapStage('approved');
        // Small delay to show approved state
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Step 2: Execute swap
      setSwapStage('swapping');
      const swapTxHash = await executeSwap(quote);
      
      if (!swapTxHash) {
        setSwapStage('error');
        setSwapError('Swap failed, was rejected, or did not confirm on-chain');
        return;
      }

      // Calculate USD value for display (server will verify)
      const srcPrice = tokenPrices[srcToken]?.priceUsd || 0;
      const usdValue = parseFloat(srcAmount) * srcPrice;

      // SECURITY: Record swap via secure backend endpoint with TX hash for on-chain verification
      // Rewards are only given after backend verifies the transaction succeeded on-chain
      try {
        const { data: recordResult, error: recordError } = await supabase.functions.invoke('verify-swap', {
          body: {
            action: 'record',
            srcToken: SWAP_TOKENS[srcToken].address,
            destToken: SWAP_TOKENS[destToken].address,
            srcAmount: srcAmount,
            destAmount: destAmount,
            userAddress: walletAddress,
            txHash: swapTxHash, // CRITICAL: Send txHash for on-chain verification
          },
        });

        if (recordError || !recordResult?.success || recordResult?.verified !== true) {
          console.error('Error recording/verifying swap:', recordError, recordResult);
          setSwapStage('error');
          setSwapError(recordError?.message || recordResult?.error || 'Swap verification failed');
          return;
        }

        // Use server-calculated values (cannot be manipulated)
        setScoreEarned(recordResult.scoreEarned || 0);
        setAvloRewardEarned(recordResult.avloReward || 0);
        setRewardUsdEarned(recordResult.rewardUsd || 0);

        // Refresh balances immediately after verified success (prevents re-using stale balance)
        await refreshBalances();
      } catch (err) {
        console.error('Error recording swap:', err);
        setSwapStage('error');
        setSwapError('Failed to verify swap. Please try again.');
        return;
      }

      setSwapStage('success');
      
      // Auto close after success
      setTimeout(() => {
        setDialogOpen(false);
        setSrcAmount('');
        setDestAmount('');
        clearQuote();
      }, 3000);

    } catch (err: any) {
      console.error('Swap error:', err);
      setSwapStage('error');
      setSwapError(err.message || 'An unexpected error occurred');
    }
  };

  // Format number with dots as thousand separators and comma as decimal separator
  const formatNumber = (value: string | number, decimals: number = 4): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num) || num === 0) return '0';
    
    // Split into integer and decimal parts
    const fixed = num.toFixed(decimals);
    const [intPart, decPart] = fixed.split('.');
    
    // Add thousand separators (dots) to integer part
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    // Remove trailing zeros from decimal part
    const trimmedDec = decPart ? decPart.replace(/0+$/, '') : '';
    
    // Return with comma as decimal separator
    return trimmedDec ? `${formattedInt},${trimmedDec}` : formattedInt;
  };

  const getTokenBalance = (token: SwapTokenSymbol) => {
    const balance = balances[token];
    if (!balance) return '0,00';
    const val = parseFloat(balance.formatted);
    if (val < 0.0001 && val > 0) return '<0,0001';
    return formatNumber(val, 4);
  };

  const getTokenUsdValue = (token: SwapTokenSymbol, amount: string) => {
    const price = tokenPrices[token];
    if (!price || !amount) return '$0,00';
    const value = parseFloat(amount) * price.priceUsd;
    if (value < 0.01) return '<$0,01';
    return `$${formatNumber(value, 2)}`;
  };

  // Token verification now done on-chain via quoteYakExactIn

  const TokenSelector = ({ 
    selectedToken, 
    onSelect, 
    excludeToken 
  }: { 
    selectedToken: SwapTokenSymbol; 
    onSelect: (token: SwapTokenSymbol) => void;
    excludeToken: SwapTokenSymbol;
  }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center gap-2 px-3 py-2 h-auto bg-zinc-800/80 hover:bg-zinc-700 rounded-xl border border-zinc-700/50"
        >
          <img 
            src={TOKEN_LOGOS[selectedToken]} 
            alt={selectedToken} 
            className="w-6 h-6 rounded-full ring-2 ring-zinc-600"
          />
          <span className="font-semibold text-white">{selectedToken}</span>
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-zinc-900/95 backdrop-blur-xl border-zinc-700 min-w-[180px]">
        {(Object.keys(SWAP_TOKENS) as SwapTokenSymbol[])
          .filter(token => token !== excludeToken)
          .map(token => (
            <DropdownMenuItem
              key={token}
              onClick={() => onSelect(token)}
              className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800"
            >
              <img 
                src={TOKEN_LOGOS[token]} 
                alt={token} 
                className="w-7 h-7 rounded-full ring-2 ring-zinc-600"
              />
              <div className="flex flex-col flex-1">
                <span className="font-semibold text-white">{token}</span>
                <span className="text-xs text-zinc-400">{SWAP_TOKENS[token].name}</span>
              </div>
              <Shield className="w-4 h-4 text-green-500" />
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Tech Pitch Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-black to-zinc-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-900/20 via-transparent to-transparent" />
      
      {/* Animated Grid */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(34,197,94,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,197,94,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }} />
      </div>

      {/* Floating Orbs */}
      <motion.div 
        className="absolute top-20 left-10 w-64 h-64 bg-green-500/10 rounded-full blur-3xl"
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <motion.div 
        className="absolute bottom-20 right-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl"
        animate={{ 
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      <div className="container max-w-lg mx-auto px-4 py-6 relative z-10">
        {/* Header with Tech Pitch Style */}
        <motion.div 
          className="flex items-center justify-between mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-black text-transparent bg-gradient-to-r from-green-400 via-emerald-400 to-green-500 bg-clip-text flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                <ArrowDownUp className="w-5 h-5 text-white" />
              </div>
              SWAP
            </h1>
            
            {/* Token Swap Animation */}
            <div className="flex items-center gap-1 p-1.5 bg-zinc-800/60 rounded-xl border border-zinc-700/50 backdrop-blur-sm">
              <motion.div
                className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 p-0.5 overflow-hidden"
                animate={{ 
                  x: [0, 4, 0],
                  scale: [1, 1.05, 1],
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-transparent rounded-lg" />
                <img 
                  src={arenaLogo} 
                  alt="ARENA" 
                  className="w-full h-full rounded-md object-cover"
                />
              </motion.div>
              
              <motion.div
                className="flex items-center justify-center w-6"
                animate={{ 
                  rotate: [0, 180, 360],
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity,
                  ease: "linear"
                }}
              >
                <ArrowDownUp className="w-3.5 h-3.5 text-green-400" />
              </motion.div>
              
              <motion.div
                className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 p-0.5 overflow-hidden"
                animate={{ 
                  x: [0, -4, 0],
                  scale: [1, 1.05, 1],
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-lg" />
                <img 
                  src={avloLogo} 
                  alt="AVLO" 
                  className="w-full h-full rounded-md object-cover"
                />
              </motion.div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { refreshPrices(); refreshBalances(); }}
            className="text-zinc-400 hover:text-green-400 hover:bg-green-500/10 rounded-xl"
          >
            <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
          </Button>
        </motion.div>

        {/* Swap Card with Tech Pitch Design */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-zinc-900/80 border-zinc-800/50 backdrop-blur-xl shadow-2xl shadow-green-500/5 overflow-hidden relative">
            {/* Top glow effect */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-500/50 to-transparent" />
            
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-green-500/30" />
            <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-green-500/30" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-green-500/30" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-green-500/30" />

            <CardContent className="p-4 space-y-4">
              {/* From Token */}
              <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">From</span>
                  <span className="text-xs text-zinc-500">
                    Balance: {getTokenBalance(srcToken)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <TokenSelector 
                    selectedToken={srcToken} 
                    onSelect={(t) => { setSrcToken(t); clearQuote(); }} 
                    excludeToken={destToken} 
                  />
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={srcAmount}
                    onChange={(e) => setSrcAmount(e.target.value)}
                    className="bg-transparent border-none text-right text-2xl font-semibold text-white focus-visible:ring-0 p-0"
                  />
                </div>
                
                {/* Percentage Buttons */}
                <div className="flex items-center gap-2 mt-3">
                  {PERCENTAGE_OPTIONS.map((pct) => (
                    <button
                      key={pct}
                      onClick={() => handlePercentageClick(pct)}
                      className="flex-1 py-1.5 px-2 text-xs font-medium rounded-lg bg-zinc-700/50 hover:bg-green-500/20 hover:text-green-400 text-zinc-300 transition-all border border-transparent hover:border-green-500/30"
                    >
                      {pct === 100 ? 'MAX' : `${pct}%`}
                    </button>
                  ))}
                </div>
                
                <div className="text-right text-xs text-zinc-500 mt-2">
                  {getTokenUsdValue(srcToken, srcAmount)}
                </div>
              </div>

              {/* Swap Direction Button */}
              <div className="flex justify-center -my-2 relative z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSwapTokens}
                  className="bg-zinc-700 hover:bg-green-500/20 hover:text-green-400 rounded-full w-10 h-10 border-4 border-zinc-900 transition-all hover:border-green-500/30"
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>
              </div>

              {/* To Token */}
              <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">To</span>
                  <span className="text-xs text-zinc-500">
                    Balance: {getTokenBalance(destToken)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <TokenSelector 
                    selectedToken={destToken} 
                    onSelect={(t) => { setDestToken(t); clearQuote(); }} 
                    excludeToken={srcToken} 
                  />
                  <div className="flex-1 text-right text-2xl font-semibold text-white">
                    {destAmount ? formatNumber(destAmount, 6) : '0'}
                  </div>
                </div>
                <div className="text-right text-xs text-zinc-500 mt-2">
                  {getTokenUsdValue(destToken, destAmount)}
                </div>
              </div>

              {/* Quote Details */}
              {quote && (
                <motion.div 
                  className="bg-zinc-800/30 rounded-xl p-3 space-y-2 border border-zinc-700/20"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Rate</span>
                    <span className="text-white font-mono">
                      1 {srcToken} = {quote.exchangeRate} {destToken}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400 flex items-center gap-1">
                      Price Impact
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3 h-3" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-zinc-900 border-zinc-700">
                          <p className="text-white">Difference between market and execution price</p>
                        </TooltipContent>
                      </Tooltip>
                    </span>
                    <span className={cn(
                      "font-mono",
                      quote.priceImpact < 1 ? 'text-green-400' :
                      quote.priceImpact < 3 ? 'text-yellow-400' : 'text-red-400'
                    )}>
                      {quote.priceImpact >= 0 ? quote.priceImpact.toFixed(2) : '0.00'}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Slippage</span>
                    <span className="text-white font-mono">{slippage}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Route</span>
                    <span className="text-green-400 text-xs font-medium">
                      {quote.priceRoute?.dex || 'Arena Router'}
                    </span>
                  </div>
                  {pairInfo && (srcToken === 'AVLO' || destToken === 'AVLO') && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">Liquidity</span>
                      <span className="text-emerald-400 text-xs font-mono">
                        ${pairInfo.liquidity?.usd?.toLocaleString() || '0'}
                      </span>
                    </div>
                  )}
                </motion.div>
              )}


              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="text-xs text-red-400">{error}</span>
                </div>
              )}

              {/* Swap Button */}
              <Button
                onClick={handleSwap}
                disabled={!quote || isSwapping || isApproving || !isConnected}
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl shadow-lg shadow-green-500/20 transition-all hover:shadow-green-500/40"
              >
                {!isConnected ? (
                  'Connect Wallet'
                ) : isApproving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : isSwapping ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Swapping...
                  </>
                ) : isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Getting Quote...
                  </>
                ) : !srcAmount || parseFloat(srcAmount) === 0 ? (
                  'Enter Amount'
                ) : !quote ? (
                  'Finding Best Route...'
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    Swap Now
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Token Prices */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-zinc-900/50 border-zinc-800/50 mt-4 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                Live Prices
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(['ARENA', 'AVLO'] as SwapTokenSymbol[]).map(token => {
                const price = tokenPrices[token];
                return (
                  <div key={token} className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <img 
                        src={TOKEN_LOGOS[token]} 
                        alt={token} 
                        className="w-6 h-6 rounded-full ring-2 ring-zinc-700"
                      />
                      <span className="text-sm font-medium text-white">{token}</span>
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    </div>
                    <span className="text-sm text-zinc-300 font-mono">
                      {price ? `$${price.priceUsd.toFixed(6)}` : '...'}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Score Reward Card */}
        <motion.div 
          className="mt-4 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/30 backdrop-blur-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Earn Rewards by Swapping!</h3>
              <p className="text-xs text-zinc-400">
                Earn{' '}
                <span className="inline-flex items-center gap-1 mx-1">
                  <img src="/images/avlo-logo.jpg" alt="AVLO" className="w-3.5 h-3.5 rounded-full inline" />
                  <span className="text-purple-400 font-semibold">0.2% AVLO</span>
                </span>
                credit + <span className="text-orange-400 font-semibold">1 Score per $0.01 volume</span>!
              </p>
            </div>
          </div>
        </motion.div>

        {/* Score Stealing Info Card */}
        <motion.div 
          className="mt-4 p-4 bg-gradient-to-r from-orange-500/10 to-pink-500/10 rounded-xl border border-orange-500/30 backdrop-blur-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Score Stealing System
                <Info className="w-3 h-3 text-zinc-500" />
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                When rewards are paid, the payer <span className="text-green-400 font-semibold">steals 1 score</span> from the recipient for every <span className="text-orange-400 font-semibold">$0.01 USD</span> paid. Swap volume also earns score at the same rate!
              </p>
            </div>
          </div>
        </motion.div>

        {/* Volume Leaderboard */}
        <SwapVolumeLeaderboard />
      </div>

      {/* Swap Progress Dialog */}
      <SwapProgressDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        stage={swapStage}
        srcToken={srcToken}
        destToken={destToken}
        srcAmount={srcAmount}
        destAmount={destAmount}
        scoreEarned={scoreEarned}
        avloReward={avloRewardEarned}
        rewardUsd={rewardUsdEarned}
        errorMessage={swapError}
      />
      
      {/* Insufficient Gas Popup */}
      <InsufficientGasPopup
        isOpen={showGasPopup}
        onClose={() => setShowGasPopup(false)}
        currentBalance={avaxBalance}
        requiredBalance={MIN_GAS_REQUIRED}
      />
    </div>
  );
};

export default Swap;