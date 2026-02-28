import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Loader2, Coins, AlertTriangle, CheckCircle2, BadgeCheck, Info, Sparkles, Wallet, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useWeb3Auth } from '@/hooks/useWeb3Auth';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { ethers, BrowserProvider } from 'ethers';
import { AVLO_TOKEN_ADDRESS, ERC20_ABI } from '@/config/staking';
import { TransactionProgress } from '@/components/TransactionProgress';
import { motion } from 'framer-motion';

const LISTING_FEE = 1000000; // 1,000,000 AVLO
const LISTING_FEE_ADDRESS = '0xB799CD1f2ED5dB96ea94EdF367fBA2d90dfd9634';
const MIN_SWIPE_PRICE = 1;
const AVALANCHE_RPC = "https://api.avax.network/ext/bc/C/rpc";

const SIMPLE_ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

interface StakingToken {
  address: string;
  logo: string;
  name: string;
}

interface AddTokenDialogProps {
  onTokenAdded?: () => void;
}

export function AddTokenDialog({ onTokenAdded }: AddTokenDialogProps) {
  const { walletAddress, isConnected, isArena, arenaSDK } = useWeb3Auth();
  const { profile } = useWalletAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avloBalance, setAvloBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [stakingTokens, setStakingTokens] = useState<StakingToken[]>([]);
  const [loadingStakingTokens, setLoadingStakingTokens] = useState(false);
  const [listedTokenAddresses, setListedTokenAddresses] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    token_address: '',
    logo_url: '',
    swipe_price: MIN_SWIPE_PRICE
  });

  const [tokenInfo, setTokenInfo] = useState({
    name: '',
    symbol: '',
    decimals: 18
  });

  const [txProgress, setTxProgress] = useState({
    isOpen: false,
    status: 'waiting' as 'waiting' | 'processing' | 'success' | 'error',
    message: '',
    txHash: null as string | null
  });

  // Fetch AVLO balance, staking tokens, and listed tokens when dialog opens
  useEffect(() => {
    if (isOpen && walletAddress) {
      fetchAvloBalance();
      fetchListedTokens();
      fetchStakingTokens();
    }
  }, [isOpen, walletAddress]);

  // Fetch already listed tokens to filter suggestions
  const fetchListedTokens = async () => {
    try {
      // Fetch from dao_tokens (approved tokens)
      const { data: daoTokens } = await supabase
        .from('dao_tokens')
        .select('token_address')
        .eq('is_active', true);

      // Fetch from user_token_submissions (pending + active)
      const { data: submissions } = await supabase
        .from('user_token_submissions')
        .select('token_address')
        .eq('is_active', true);

      const addresses = new Set<string>();
      
      daoTokens?.forEach(t => {
        if (t.token_address) addresses.add(t.token_address.toLowerCase());
      });
      
      submissions?.forEach(t => {
        if (t.token_address) addresses.add(t.token_address.toLowerCase());
      });

      setListedTokenAddresses(addresses);
    } catch (error) {
      console.error('[ADD TOKEN] Error fetching listed tokens:', error);
    }
  };

  // Fetch unique staking tokens from pools
  const fetchStakingTokens = async () => {
    setLoadingStakingTokens(true);
    try {
      const { data, error } = await supabase
        .from('staking_pools')
        .select('stake_token_address, stake_token_logo, title')
        .eq('is_active', true);

      if (error) throw error;

      // Get unique tokens by address (case-insensitive)
      const tokenMap = new Map<string, StakingToken>();
      const provider = new ethers.JsonRpcProvider(AVALANCHE_RPC);

      for (const pool of data || []) {
        if (!pool.stake_token_address) continue;
        const normalizedAddress = pool.stake_token_address.toLowerCase();
        
        if (!tokenMap.has(normalizedAddress)) {
          try {
            const checksumAddress = ethers.getAddress(pool.stake_token_address);
            const contract = new ethers.Contract(checksumAddress, SIMPLE_ERC20_ABI, provider);
            const symbol = await contract.symbol();
            
            tokenMap.set(normalizedAddress, {
              address: checksumAddress,
              logo: pool.stake_token_logo || '',
              name: symbol
            });
          } catch (e) {
            console.error('Error fetching token symbol:', e);
          }
        }
      }

      // Filter out already listed tokens
      const allTokens = Array.from(tokenMap.values());
      const filteredTokens = allTokens.filter(
        token => !listedTokenAddresses.has(token.address.toLowerCase())
      );

      setStakingTokens(filteredTokens);
    } catch (error) {
      console.error('[ADD TOKEN] Error fetching staking tokens:', error);
    } finally {
      setLoadingStakingTokens(false);
    }
  };

  const selectStakingToken = (token: StakingToken) => {
    setFormData({
      ...formData,
      token_address: token.address,
      logo_url: token.logo
    });
  };

  const fetchAvloBalance = async () => {
    if (!walletAddress) return;
    setLoadingBalance(true);
    try {
      const provider = new ethers.JsonRpcProvider(AVALANCHE_RPC);
      const contract = new ethers.Contract(AVLO_TOKEN_ADDRESS, SIMPLE_ERC20_ABI, provider);
      const balance = await contract.balanceOf(walletAddress);
      const formatted = parseFloat(ethers.formatUnits(balance, 18));
      console.log('[ADD TOKEN] AVLO Balance fetched:', formatted, 'for wallet:', walletAddress);
      setAvloBalance(formatted);
    } catch (error) {
      console.error('[ADD TOKEN] Error fetching AVLO balance:', error);
      setAvloBalance(0);
    } finally {
      setLoadingBalance(false);
    }
  };

  // Fetch token info when address changes
  useEffect(() => {
    if (formData.token_address.length === 42) {
      fetchTokenInfo(formData.token_address);
    } else {
      setTokenInfo({ name: '', symbol: '', decimals: 18 });
    }
  }, [formData.token_address]);

  const fetchTokenInfo = async (address: string) => {
    try {
      const checksumAddress = ethers.getAddress(address);
      const provider = new ethers.JsonRpcProvider(AVALANCHE_RPC);
      const contract = new ethers.Contract(checksumAddress, SIMPLE_ERC20_ABI, provider);
      
      const [name, symbol, decimals] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals()
      ]);

      setTokenInfo({ name, symbol, decimals: Number(decimals) });
    } catch (error) {
      console.error('[ADD TOKEN] Error fetching token info:', error);
      setTokenInfo({ name: '', symbol: '', decimals: 18 });
    }
  };

  const hasEnoughBalance = avloBalance >= LISTING_FEE;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected || !walletAddress || !profile?.id) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!tokenInfo.name || !tokenInfo.symbol) {
      toast.error('Invalid token address');
      return;
    }

    if (formData.swipe_price < MIN_SWIPE_PRICE) {
      toast.error(`Minimum swipe price is ${MIN_SWIPE_PRICE.toLocaleString()}`);
      return;
    }

    if (!hasEnoughBalance) {
      toast.error(`Insufficient AVLO balance. You need ${LISTING_FEE.toLocaleString()} AVLO to list a token.`);
      return;
    }

    setLoading(true);
    setTxProgress({
      isOpen: true,
      status: 'waiting',
      message: 'Preparing transaction...',
      txHash: null
    });

    try {
      let txHash: string;
      const amount = ethers.parseUnits(LISTING_FEE.toString(), 18);

      if (isArena && arenaSDK?.provider) {
        // Arena SDK transaction - use provider.request method
        const arenaAddress = arenaSDK.provider.accounts?.[0];
        if (!arenaAddress) throw new Error('Arena wallet not connected');

        const transferInterface = new ethers.Interface(SIMPLE_ERC20_ABI);
        const transferData = transferInterface.encodeFunctionData('transfer', [
          LISTING_FEE_ADDRESS,
          amount
        ]);

        console.log('[ADD TOKEN] Arena transfer tx params:', { 
          from: arenaAddress, 
          to: AVLO_TOKEN_ADDRESS, 
          data: transferData 
        });

        setTxProgress({
          isOpen: true,
          status: 'processing',
          message: 'Confirm transaction in Arena...',
          txHash: null
        });

        const result = await arenaSDK.provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: arenaAddress,
            to: AVLO_TOKEN_ADDRESS,
            data: transferData,
            value: '0x0',
            gas: '0x30D40' // 200000 gas
          }]
        });

        if (!result) {
          throw new Error('Transaction failed');
        }
        txHash = result as string;
        console.log('[ADD TOKEN] Arena tx hash:', txHash);
        
        // Wait a bit for tx to propagate
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        // Browser wallet transaction
        const provider = new BrowserProvider(window.ethereum as any);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(AVLO_TOKEN_ADDRESS, SIMPLE_ERC20_ABI, signer);
        
        setTxProgress({
          isOpen: true,
          status: 'processing',
          message: 'Confirm transaction in wallet...',
          txHash: null
        });

        const tx = await contract.transfer(LISTING_FEE_ADDRESS, amount);
        txHash = tx.hash;
        await tx.wait();
      }

      setTxProgress({
        isOpen: true,
        status: 'processing',
        message: 'Saving token submission...',
        txHash
      });

      // Save to database
      const { error } = await supabase
        .from('user_token_submissions')
        .insert({
          user_id: profile.id,
          token_address: ethers.getAddress(formData.token_address),
          token_name: tokenInfo.name,
          token_symbol: tokenInfo.symbol,
          logo_url: formData.logo_url || null,
          decimals: tokenInfo.decimals,
          swipe_price: formData.swipe_price,
          payment_address: '0xB799CD1f2ED5dB96ea94EdF367fBA2d90dfd9634',
          listing_fee_tx_hash: txHash,
          is_active: true,
          is_verified: false
        });

      if (error) throw error;

      setTxProgress({
        isOpen: true,
        status: 'success',
        message: 'Token listed successfully!',
        txHash
      });

      toast.success('Token listed successfully! It will be available for swipes immediately.');
      
      // Reset form
      setFormData({
        token_address: '',
        logo_url: '',
        swipe_price: MIN_SWIPE_PRICE
      });
      setTokenInfo({ name: '', symbol: '', decimals: 18 });
      
      setTimeout(() => {
        setTxProgress(prev => ({ ...prev, isOpen: false }));
        setIsOpen(false);
        onTokenAdded?.();
      }, 2000);

    } catch (error: any) {
      console.error('[ADD TOKEN] Error listing token:', error);
      setTxProgress({
        isOpen: true,
        status: 'error',
        message: error.message || 'Failed to list token',
        txHash: null
      });
      toast.error(error.message || 'Failed to list token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <motion.button
            className="w-full h-14 relative overflow-hidden rounded-xl font-bold text-white flex items-center justify-center gap-2 group"
            style={{
              background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 25%, #0d9488 50%, #f97316 75%, #ffffff 100%)',
              backgroundSize: '300% 300%',
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            animate={{
              backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
            }}
            transition={{
              backgroundPosition: {
                duration: 4,
                repeat: Infinity,
                ease: 'linear',
              },
            }}
          >
            {/* Glowing border effect */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-green-400 via-orange-400 to-white opacity-0 group-hover:opacity-30 blur-xl transition-opacity" />
            
            {/* Inner content */}
            <div className="absolute inset-[1px] bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 rounded-xl flex items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-orange-500 flex items-center justify-center">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg tracking-wide bg-gradient-to-r from-green-400 via-white to-orange-400 bg-clip-text text-transparent font-bold">
                Add Your Token
              </span>
              <Sparkles className="w-4 h-4 text-orange-400 animate-pulse" />
            </div>
          </motion.button>
        </DialogTrigger>
        <DialogContent className="bg-zinc-900/95 backdrop-blur-xl border-zinc-800 max-w-lg max-h-[90vh] overflow-y-auto p-0">
          {/* Mobile Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute right-4 top-4 z-50 p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 transition-colors md:hidden"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-orange-600/20 p-6 border-b border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
                <motion.div
                  className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Coins className="w-6 h-6 text-white" />
                </motion.div>
                List Your Token
              </DialogTitle>
              <DialogDescription className="text-zinc-400 mt-2">
                Add your token to the platform for swipes. Pay listing fee to activate.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-5">
            {/* Submit Button - TOP for mobile visibility */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Button
                onClick={handleSubmit}
                disabled={loading || !hasEnoughBalance || !tokenInfo.name}
                className="w-full h-14 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 hover:from-purple-700 hover:via-pink-700 hover:to-orange-700 text-white font-bold text-lg rounded-xl shadow-lg shadow-purple-500/25"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Pay {LISTING_FEE.toLocaleString()} AVLO & List Token
                  </>
                )}
              </Button>
            </motion.div>

            {/* Balance Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`p-4 rounded-xl border ${hasEnoughBalance 
                ? 'bg-green-500/10 border-green-500/30' 
                : 'bg-red-500/10 border-red-500/30'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${hasEnoughBalance ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    <Wallet className={`w-5 h-5 ${hasEnoughBalance ? 'text-green-400' : 'text-red-400'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400">Listing Fee</p>
                    <p className={`font-bold ${hasEnoughBalance ? 'text-green-400' : 'text-red-400'}`}>
                      {LISTING_FEE.toLocaleString()} AVLO
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-400">Your Balance</p>
                  <p className="font-bold text-white">
                    {loadingBalance ? (
                      <Loader2 className="w-4 h-4 animate-spin inline" />
                    ) : (
                      `${avloBalance.toLocaleString()} AVLO`
                    )}
                  </p>
                </div>
              </div>
              {hasEnoughBalance ? (
                <div className="flex items-center gap-2 mt-3 text-green-400 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Sufficient balance</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-3 text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Insufficient balance</span>
                </div>
              )}
            </motion.div>

            {/* Arena Warning */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-orange-400 font-semibold text-sm">Important Notice</p>
                  <p className="text-zinc-400 text-sm mt-1">
                    Tokens outside The Arena ecosystem will not be listed. Only Arena-compatible tokens are accepted.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Quick Select - Staking Pool Tokens */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <Label className="text-zinc-300">Quick Select from Staking Pools</Label>
              </div>
              {loadingStakingTokens ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                </div>
              ) : stakingTokens.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {stakingTokens.map((token) => (
                    <motion.button
                      key={token.address}
                      onClick={() => selectStakingToken(token)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                        formData.token_address.toLowerCase() === token.address.toLowerCase()
                          ? 'bg-purple-500/20 border-purple-500'
                          : 'bg-zinc-800/50 border-zinc-700 hover:border-purple-500/50'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {token.logo ? (
                        <img 
                          src={token.logo} 
                          alt={token.name} 
                          className="w-6 h-6 rounded-full object-cover"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{token.name.slice(0, 2)}</span>
                        </div>
                      )}
                      <span className="text-white font-medium text-sm">{token.name}</span>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 text-sm">No staking pool tokens available</p>
              )}
            </motion.div>

            {/* Token Address */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-2"
            >
              <Label className="text-zinc-300 flex items-center gap-2">
                <span>Token Contract Address</span>
                <span className="text-red-400">*</span>
              </Label>
              <Input
                value={formData.token_address}
                onChange={(e) => setFormData({ ...formData, token_address: e.target.value })}
                placeholder="0x..."
                className="bg-zinc-800/50 border-zinc-700 text-white font-mono text-sm h-12 rounded-xl"
              />
            </motion.div>

            {/* Auto-fetched Token Info */}
            {tokenInfo.name && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                    {formData.logo_url ? (
                      <img src={formData.logo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <span className="text-white font-bold">{tokenInfo.symbol.slice(0, 2)}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg">{tokenInfo.name}</p>
                    <p className="text-zinc-400 text-sm">${tokenInfo.symbol}</p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-400 ml-auto" />
                </div>
              </motion.div>
            )}

            {/* Logo URL */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="space-y-2"
            >
              <Label className="text-zinc-300">Token Logo URL (optional)</Label>
              <Input
                value={formData.logo_url}
                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                placeholder="https://..."
                className="bg-zinc-800/50 border-zinc-700 text-white h-12 rounded-xl"
              />
              {formData.logo_url && (
                <img 
                  src={formData.logo_url} 
                  alt="Token logo" 
                  className="mt-2 w-12 h-12 rounded-full object-cover border-2 border-purple-500/50"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              )}
            </motion.div>

            {/* Swipe Price - Fixed at 1000 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-purple-400" />
                  <span className="text-zinc-300">Swipe Price</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-white">{MIN_SWIPE_PRICE.toLocaleString()}</span>
                  <span className="text-zinc-400">tokens</span>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Fixed price per swipe for all tokens
              </p>
            </motion.div>

            {/* Verified Badge Info */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <BadgeCheck className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-blue-400 font-semibold text-sm">Verification</p>
                  <p className="text-zinc-400 text-xs mt-1">
                    Your token will be active immediately. Admins may verify it later to add a blue checkmark.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>

      <TransactionProgress
        isOpen={txProgress.isOpen}
        status={txProgress.status}
        message={txProgress.message}
        txHash={txProgress.txHash}
        onClose={() => setTxProgress(prev => ({ ...prev, isOpen: false }))}
      />
    </>
  );
}