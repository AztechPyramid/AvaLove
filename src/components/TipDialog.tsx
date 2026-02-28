import { useState, useEffect, useMemo } from 'react';
import { Gift, Loader2, AlertTriangle, Shield, CheckCircle2, ChevronDown, Wallet, Copy, Check, User, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { useWeb3Auth } from '@/hooks/useWeb3Auth';
import { AVLO_TOKEN_ADDRESS } from '@/config/staking';
import avloLogo from '@/assets/avlo-logo.jpg';
import { TransactionProgress } from '@/components/TransactionProgress';
import { z } from 'zod';
import { useAvloPrice } from '@/hooks/useAvloPrice';
import { usePaymentTokens, PaymentToken } from '@/hooks/usePaymentTokens';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface TipDialogProps {
  receiverId: string;
  receiverName: string;
  receiverWallet: string;
  receiverAvatar?: string;
  context: 'discover' | 'match' | 'chat';
  variant?: 'default' | 'discover';
  matchId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  userScore?: number;
}

const customAmountSchema = z.number().int().min(1, "Amount must be at least 1").max(1000000, "Amount cannot exceed 1,000,000");

const TIP_AMOUNTS = [100, 200, 300, 500, 1000, 2000, 5000, 10000];

const AVALANCHE_RPC = "https://api.avax.network/ext/bc/C/rpc";
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

// Security validation utilities
const isValidEthAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

const normalizeAddress = (address: string): string => {
  return address.toLowerCase().trim();
};

// Copyable Wallet Address Component
const ReceiverWalletCopy = ({ address }: { address: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success('Wallet address copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };
  
  const shortAddress = `${address.slice(0, 8)}...${address.slice(-6)}`;
  
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 bg-zinc-800/60 hover:bg-zinc-700/60 px-2.5 py-1.5 rounded-lg transition-all group w-full max-w-[220px] sm:max-w-none"
    >
      <Wallet className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
      <span className="text-xs font-mono text-zinc-300 truncate">{shortAddress}</span>
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500 shrink-0 ml-auto" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-zinc-500 group-hover:text-orange-500 transition-colors shrink-0 ml-auto" />
      )}
    </button>
  );
};

export const TipDialog = ({ 
  receiverId, 
  receiverName, 
  receiverWallet, 
  receiverAvatar,
  context, 
  variant = 'default', 
  matchId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  userScore
}: TipDialogProps) => {
  const { profile } = useWalletAuth();
  const { walletAddress, isConnected, arenaSDK } = useWeb3Auth();
  const { formatAvloWithUsd, price: avloPrice } = useAvloPrice();
  const { tokens, loading: tokensLoading } = usePaymentTokens();
  
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const [selectedToken, setSelectedToken] = useState<PaymentToken | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [securityChecks, setSecurityChecks] = useState({
    addressValid: false,
    receiverExists: false,
    notSelf: false,
    sufficientBalance: false
  });
  const [txProgress, setTxProgress] = useState({
    isOpen: false,
    status: 'waiting' as 'waiting' | 'processing' | 'success' | 'error',
    message: '',
    txHash: null as string | null,
  });
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  // Default to AVLO token
  const defaultAvloToken = useMemo(() => {
    const avlo = tokens.find(t => t.token_symbol === 'AVLO');
    if (avlo) return avlo;
    
    // Fallback if not in tokens list
    return {
      id: 'default-avlo',
      token_address: AVLO_TOKEN_ADDRESS,
      token_name: 'AvaLove',
      token_symbol: 'AVLO',
      logo_url: null,
      swipe_price: 1000,
      post_price: 1000,
      comment_price: 1000,
      payment_address: '0x000000000000000000000000000000000000dEaD',
      decimals: 18,
      is_active: true,
      is_verified: true
    } as PaymentToken;
  }, [tokens]);

  // Set default token when dialog opens
  useEffect(() => {
    if (open && !selectedToken && defaultAvloToken) {
      setSelectedToken(defaultAvloToken);
    }
  }, [open, selectedToken, defaultAvloToken]);

  // Fetch token balance when token changes
  useEffect(() => {
    const fetchBalance = async () => {
      if (!walletAddress || !selectedToken) {
        setTokenBalance('0');
        return;
      }
      
      setIsLoadingBalance(true);
      try {
        const provider = new JsonRpcProvider(AVALANCHE_RPC);
        const tokenContract = new Contract(selectedToken.token_address, ERC20_ABI, provider);
        const balance = await tokenContract.balanceOf(walletAddress);
        const decimals = selectedToken.decimals || 18;
        setTokenBalance(formatUnits(balance, decimals));
      } catch (error) {
        console.error('[TIP] Error fetching token balance:', error);
        setTokenBalance('0');
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
  }, [walletAddress, selectedToken]);

  // Run security checks
  useEffect(() => {
    const runSecurityChecks = async () => {
      const finalAmount = isCustomMode ? parseInt(customAmount) || 0 : selectedAmount;
      const balanceNum = parseFloat(tokenBalance);
      
      const checks = {
        addressValid: isValidEthAddress(receiverWallet),
        receiverExists: !!receiverId && receiverId.length > 0,
        notSelf: profile?.id !== receiverId,
        sufficientBalance: balanceNum >= finalAmount
      };
      
      setSecurityChecks(checks);
    };
    
    runSecurityChecks();
  }, [receiverWallet, receiverId, profile?.id, tokenBalance, selectedAmount, customAmount, isCustomMode]);


  const allSecurityChecksPassed = useMemo(() => {
    return Object.values(securityChecks).every(Boolean);
  }, [securityChecks]);

  const getTokenLogo = (token: PaymentToken) => {
    if (token.logo_url) return token.logo_url;
    if (token.token_symbol === 'AVLO') return avloLogo;
    return null;
  };

  const handleSendTip = async () => {
    // Prevent double clicks
    if (isSending) {
      console.log('[TIP] Already sending, ignoring duplicate request');
      return;
    }

    if (!profile || !isConnected || !walletAddress) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!selectedToken) {
      toast.error('Please select a token');
      return;
    }

    // Security validation
    if (profile.id === receiverId) {
      toast.error('You cannot send tips to yourself');
      return;
    }

    if (!receiverWallet || !isValidEthAddress(receiverWallet)) {
      toast.error('Invalid receiver wallet address');
      return;
    }

    // Skip database verification for foundation donations (receiverId starts with "foundation")
    const isFoundationDonation = receiverId === 'foundation' || receiverId.startsWith('foundation');
    
    if (!isFoundationDonation) {
      // Verify receiver exists in database
      const { data: receiverProfile, error: receiverError } = await supabase
        .from('profiles')
        .select('id, wallet_address')
        .eq('id', receiverId)
        .single();

      if (receiverError || !receiverProfile) {
        toast.error('Receiver profile not found');
        return;
      }

      // Verify wallet address matches
      if (normalizeAddress(receiverProfile.wallet_address || '') !== normalizeAddress(receiverWallet)) {
        toast.error('Receiver wallet address mismatch - possible security issue');
        console.error('[TIP SECURITY] Wallet mismatch:', {
          expected: receiverProfile.wallet_address,
          received: receiverWallet
        });
        return;
      }
    }

    if (!arenaSDK?.provider) {
      toast.error('Arena wallet not connected');
      return;
    }

    const finalAmount = isCustomMode ? parseInt(customAmount) : selectedAmount;
    
    if (isCustomMode) {
      const validation = customAmountSchema.safeParse(finalAmount);
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }
    }

    // Check balance
    const balanceNum = parseFloat(tokenBalance);
    if (balanceNum < finalAmount) {
      toast.error(`Insufficient ${selectedToken.token_symbol} balance. You have ${parseFloat(tokenBalance).toLocaleString()} ${selectedToken.token_symbol}`);
      return;
    }

    // Lock sending immediately
    setIsSending(true);
    
    // Show waiting UI
    setTxProgress({
      isOpen: true,
      status: 'waiting',
      message: `Waiting for Arena approval to send ${selectedToken.token_symbol}...`,
      txHash: null,
    });

    try {
      const decimals = selectedToken.decimals || 18;
      const amountInWei = BigInt(finalAmount) * (BigInt(10) ** BigInt(decimals));

      console.log('[TIP] Sending tip via Arena SDK...', { 
        token: selectedToken.token_symbol,
        amount: finalAmount,
        receiver: receiverWallet 
      });

      // Build ERC20 transfer data
      const functionSelector = '0xa9059cbb';
      const paddedAddress = receiverWallet.slice(2).toLowerCase().padStart(64, '0');
      const paddedAmount = amountInWei.toString(16).padStart(64, '0');
      const data = functionSelector + paddedAddress + paddedAmount;

      // Send transaction via Arena SDK - SINGLE request
      const txHash = await arenaSDK.provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddress,
          to: selectedToken.token_address,
          data,
          value: '0x0',
          gas: '0x5B8D80'
        }],
      }) as string;

      if (!txHash) {
        throw new Error('Transaction hash not returned');
      }

      console.log('[TIP] Transaction confirmed:', txHash);

      // Show success immediately
      setTxProgress({
        isOpen: true,
        status: 'success',
        message: `Successfully sent ${finalAmount.toLocaleString()} ${selectedToken.token_symbol} to ${receiverName}!`,
        txHash: txHash,
      });

      // Record to database (non-blocking)
      recordTipToDatabase(txHash, finalAmount, message).catch((err) => {
        console.error('[TIP] Failed to record tip:', err);
      });

      // Reset form state
      setMessage('');
      setSelectedAmount(100);
      setCustomAmount('');
      setIsCustomMode(false);
      
    } catch (error: any) {
      console.error('[TIP] Error sending tip:', error);
      
      const isUserRejection = 
        error.code === 4001 || 
        error.code === 5000 || 
        error.message?.toLowerCase().includes('user rejected') ||
        error.message?.toLowerCase().includes('user denied');
      
      if (isUserRejection) {
        // User cancelled - just close progress and reset
        setTxProgress({ isOpen: false, status: 'waiting', message: '', txHash: null });
        setIsSending(false);
        return;
      }
      
      let errorMessage = 'Failed to send tip';
      if (error.message?.includes('insufficient funds') || error.message?.includes('insufficient balance')) {
        errorMessage = `Insufficient ${selectedToken?.token_symbol || ''} tokens`;
      } else if (error.message?.includes('nonce')) {
        errorMessage = 'Transaction busy, please try again';
      }
      
      setTxProgress({
        isOpen: true,
        status: 'error',
        message: errorMessage,
        txHash: null,
      });
    } finally {
      setIsSending(false);
    }
  };

  const recordTipToDatabase = async (txHash: string, amount: number, tipMessage: string) => {
    if (!profile || !selectedToken) {
      console.error('[TIP] Cannot record: Missing profile or token');
      return;
    }
    
    try {
      console.log('[TIP] Recording tip to database:', { txHash, amount, token: selectedToken.token_symbol, receiver: receiverId });
      
      const { error } = await supabase.from('tips').insert({
        sender_id: profile.id,
        receiver_id: receiverId,
        amount: amount,
        message: tipMessage.trim() || null,
        context,
        tx_hash: txHash,
        token_symbol: selectedToken.token_symbol,
        token_logo_url: selectedToken.logo_url,
      });

      if (error) {
        console.error('[TIP] Error inserting tip:', error);
        return;
      }

      console.log('[TIP] Tip recorded successfully');

      // Send chat message if in chat context
      if (context === 'chat' && matchId) {
        const tokenLogo = selectedToken.token_symbol === 'AVLO' ? '🧡' : '💰';
        const chatMessage = tipMessage.trim() 
          ? `${tokenLogo} Sent ${amount.toLocaleString()} ${selectedToken.token_symbol} tip with message: "${tipMessage.trim()}"`
          : `${tokenLogo} Sent ${amount.toLocaleString()} ${selectedToken.token_symbol} tip`;
        
        await supabase.from('messages').insert({
          match_id: matchId,
          sender_id: profile.id,
          content: chatMessage,
          is_voice: false,
        });
      }
    } catch (error) {
      console.error('[TIP] Error recording tip:', error);
    }
  };

  const finalAmount = isCustomMode ? parseInt(customAmount) || 0 : selectedAmount;

  return (
    <>
      <TransactionProgress
        isOpen={txProgress.isOpen}
        status={txProgress.status}
        message={txProgress.message}
        txHash={txProgress.txHash}
        onClose={() => {
          setTxProgress({ isOpen: false, status: 'waiting', message: '', txHash: null });
          // Close tip dialog on success
          if (txProgress.status === 'success') {
            setOpen(false);
          }
        }}
        tokenLogo={selectedToken?.token_symbol === 'AVLO' ? avloLogo : selectedToken?.logo_url}
        tokenSymbol={selectedToken?.token_symbol || 'AVLO'}
        successTitle="Tip Sent! 🎁"
      />
      
      <Dialog open={open} onOpenChange={setOpen}>
      {!controlledOpen && (
        <DialogTrigger asChild>
          {variant === 'discover' ? (
            <Button 
              size="sm" 
              variant="outline"
              className="h-7 text-[9px] px-2 bg-white/10 border-white/20 text-white hover:bg-white/20 font-mono shrink-0"
            >
              <Gift className="w-2.5 h-2.5 mr-0.5" />
              TIP
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5 bg-black border-green-500/50 text-green-500 hover:bg-green-500/10 hover:text-green-400">
              <Gift className="h-3.5 w-3.5" />
              Tip
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="w-[95vw] max-w-lg bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-cyan-500/20 text-white max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl shadow-cyan-500/10">
        {/* Tech Header with Glow Effect */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
        
        <DialogHeader className="relative pb-4">
          <div className="absolute -top-2 -left-2 w-20 h-20 bg-cyan-500/10 rounded-full blur-2xl" />
          <div className="absolute -top-2 -right-2 w-16 h-16 bg-orange-500/10 rounded-full blur-2xl" />
          
          <DialogTitle className="flex items-center gap-3 text-white relative">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-cyan-500 rounded-xl blur opacity-60" />
              <div className="relative bg-zinc-900 p-2.5 rounded-xl border border-cyan-500/30">
                <Gift className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <span className="text-lg font-bold bg-gradient-to-r from-white via-cyan-200 to-orange-200 bg-clip-text text-transparent">
                Send Tip
              </span>
              <p className="text-xs text-zinc-500 font-normal mt-0.5">Instant blockchain transfer</p>
            </div>
          </DialogTitle>
          <DialogDescription className="text-zinc-400 flex items-center gap-2 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            <span>Send tokens directly to <span className="text-cyan-400 font-medium">{receiverName}</span></span>
          </DialogDescription>
        </DialogHeader>

        {/* Receiver Verification Card - Security Feature */}
        <div className="relative mt-2 p-3 sm:p-4 rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 via-zinc-900/50 to-orange-500/5">
          <div className="absolute top-0 right-0 px-2 py-0.5 bg-cyan-500/10 rounded-bl-lg rounded-tr-xl">
            <span className="text-[10px] text-cyan-400 font-medium uppercase tracking-wider flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Verify Recipient
            </span>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Receiver Avatar */}
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-orange-500 rounded-full blur opacity-40" />
              <Avatar className="relative w-12 h-12 sm:w-14 sm:h-14 ring-2 ring-cyan-500/30">
                <AvatarImage 
                  src={receiverAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${receiverId}&backgroundColor=b6e3f4,c0aede,d1d4f9`} 
                  alt={receiverName}
                  className="object-cover"
                />
                <AvatarFallback className="bg-gradient-to-br from-cyan-500/20 to-orange-500/20 text-cyan-400 font-bold">
                  {receiverName?.slice(0, 2).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-zinc-900 flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
            
            {/* Receiver Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-white font-semibold text-sm sm:text-base truncate">{receiverName}</span>
              </div>
              
              {/* Copyable Wallet Address */}
              <ReceiverWalletCopy address={receiverWallet} />
            </div>
          </div>
          
          <p className="text-[10px] sm:text-xs text-zinc-500 mt-3 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-orange-400" />
            Please verify this is the correct recipient before sending
          </p>
          
          {/* Send Button - Moved to Top for Mobile Accessibility */}
          <Button
            onClick={handleSendTip}
            disabled={isSending || !allSecurityChecksPassed || !selectedToken}
            className="relative w-full gap-2 bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 hover:from-orange-600 hover:via-orange-700 hover:to-orange-600 text-white font-bold disabled:opacity-50 h-11 sm:h-12 text-sm sm:text-base overflow-hidden group mt-3"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            {isSending ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span className="font-mono">Processing...</span>
              </>
            ) : (
              <>
                <Gift size={18} />
                <span>Send {finalAmount.toLocaleString()} {selectedToken?.token_symbol || 'AVLO'}</span>
              </>
            )}
          </Button>
          
          {!allSecurityChecksPassed && (
            <p className="text-[10px] sm:text-xs text-center text-yellow-500 flex items-center justify-center gap-1 mt-2">
              <AlertTriangle className="w-3 h-3" />
              Please resolve security warnings before sending
            </p>
          )}
        </div>

        <div className="space-y-4 py-2 sm:py-4">
          {/* Token Selector - Tech Style */}
          <div className="relative">
            <label className="text-xs sm:text-sm font-medium mb-2 block text-cyan-400 uppercase tracking-wider">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                Select Token
              </span>
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between bg-zinc-900/80 border-cyan-500/30 text-white hover:bg-zinc-800 hover:border-cyan-500/50 transition-all duration-300 h-11 sm:h-12"
                  disabled={tokensLoading}
                >
                  {selectedToken ? (
                    <div className="flex items-center gap-2">
                      {getTokenLogo(selectedToken) ? (
                        <div className="relative">
                          <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-sm" />
                          <img 
                            src={selectedToken.token_symbol === 'AVLO' && !selectedToken.logo_url ? avloLogo : selectedToken.logo_url!} 
                            alt={selectedToken.token_symbol} 
                            className="relative w-6 h-6 rounded-full object-cover ring-1 ring-cyan-500/50"
                          />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500/30 to-orange-500/30 flex items-center justify-center text-xs font-bold">
                          {selectedToken.token_symbol[0]}
                        </div>
                      )}
                      <span className="font-medium">{selectedToken.token_symbol}</span>
                      {selectedToken.is_verified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                    </div>
                  ) : (
                    <span className="text-zinc-400">Select token...</span>
                  )}
                  <ChevronDown className="w-4 h-4 ml-2 text-cyan-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 bg-zinc-900 border-cyan-500/30 backdrop-blur-xl">
                <ScrollArea className="h-64">
                  {tokens.map((token) => (
                    <DropdownMenuItem
                      key={token.id}
                      onClick={() => setSelectedToken(token)}
                      className="flex items-center gap-2 cursor-pointer hover:bg-cyan-500/10 transition-colors text-white"
                    >
                      {getTokenLogo(token) ? (
                        <img 
                          src={token.token_symbol === 'AVLO' && !token.logo_url ? avloLogo : token.logo_url!} 
                          alt={token.token_symbol} 
                          className="w-5 h-5 rounded-full object-cover ring-1 ring-white/10"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500/30 to-orange-500/30 flex items-center justify-center text-xs text-white">
                          {token.token_symbol[0]}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-white">{token.token_symbol}</span>
                          {token.is_verified && (
                            <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                          )}
                        </div>
                        <span className="text-xs text-zinc-400">{token.token_name}</span>
                      </div>
                      {selectedToken?.id === token.id && (
                        <CheckCircle2 className="w-4 h-4 text-cyan-500" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Balance Display - Tech Card */}
            {selectedToken && (
              <div className="mt-2 flex items-center gap-2 text-xs sm:text-sm bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2">
                <Wallet className="w-4 h-4 text-cyan-400" />
                <span className="text-zinc-500">Balance:</span>
                {isLoadingBalance ? (
                  <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                ) : (
                  <span className={`font-mono font-medium ${parseFloat(tokenBalance) < finalAmount ? 'text-red-400' : 'text-cyan-400'}`}>
                    {parseFloat(tokenBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })} {selectedToken.token_symbol}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Amount Selection - Tech Grid */}
          <div>
            <label className="text-xs sm:text-sm font-medium mb-2 sm:mb-3 block text-cyan-400 uppercase tracking-wider">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                Select Amount
              </span>
            </label>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {TIP_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  variant={!isCustomMode && selectedAmount === amount ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setIsCustomMode(false);
                    setSelectedAmount(amount);
                  }}
                  className={`font-mono text-xs sm:text-sm font-semibold transition-all duration-300 ${
                    !isCustomMode && selectedAmount === amount 
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-orange-500 shadow-lg shadow-orange-500/20' 
                      : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700/50 hover:border-cyan-500/30'
                  }`}
                >
                  {amount >= 1000 ? `${(amount/1000)}K` : amount}
                </Button>
              ))}
            </div>
          </div>

          {userScore && userScore > 0 && (
            <div>
              <Button
                variant={!isCustomMode && selectedAmount === userScore ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setIsCustomMode(false);
                  setSelectedAmount(userScore);
                }}
                className={`w-full font-semibold text-xs sm:text-sm ${
                  !isCustomMode && selectedAmount === userScore 
                    ? 'bg-gradient-to-r from-cyan-500 to-orange-500 hover:from-cyan-600 hover:to-orange-600 text-white border-cyan-500' 
                    : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700/50 hover:border-cyan-500/30'
                }`}
              >
                💎 Send Score Amount ({userScore.toLocaleString('en-US')} {selectedToken?.token_symbol || 'AVLO'})
              </Button>
            </div>
          )}

          {/* Custom Amount - Tech Input */}
          <div>
            <label className="text-xs sm:text-sm font-medium mb-2 block text-zinc-400">Custom Amount</label>
            <Input
              type="number"
              placeholder="Enter amount (1-1,000,000)"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                if (e.target.value) {
                  setIsCustomMode(true);
                }
              }}
              min={1}
              max={1000000}
              className="bg-zinc-900/80 border-zinc-700/50 text-white placeholder:text-zinc-600 focus:border-cyan-500/50 focus:ring-cyan-500/20 font-mono h-10 sm:h-11"
            />
          </div>

          {/* Message - Tech Textarea */}
          <div>
            <label className="text-xs sm:text-sm font-medium mb-2 block text-zinc-400">
              Message (Optional)
            </label>
            <Textarea
              placeholder="Add a nice message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={200}
              rows={2}
              className="bg-zinc-900/80 border-zinc-700/50 text-white placeholder:text-zinc-600 focus:border-cyan-500/50 resize-none text-sm"
            />
            <p className="text-[10px] sm:text-xs text-zinc-500 mt-1">
              {message.length}/200
            </p>
          </div>

          {/* Security Checks - Tech Card */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-cyan-500/20 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-cyan-400">
              <Shield className="w-4 h-4" />
              <span className="uppercase tracking-wider">Security Verification</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg ${securityChecks.addressValid ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {securityChecks.addressValid ? <CheckCircle2 className="w-3 h-3 flex-shrink-0" /> : <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
                <span className="truncate">Valid address</span>
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg ${securityChecks.receiverExists ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {securityChecks.receiverExists ? <CheckCircle2 className="w-3 h-3 flex-shrink-0" /> : <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
                <span className="truncate">Profile verified</span>
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg ${securityChecks.notSelf ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {securityChecks.notSelf ? <CheckCircle2 className="w-3 h-3 flex-shrink-0" /> : <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
                <span className="truncate">Not self</span>
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg ${securityChecks.sufficientBalance ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                {securityChecks.sufficientBalance ? <CheckCircle2 className="w-3 h-3 flex-shrink-0" /> : <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
                <span className="truncate">Sufficient funds</span>
              </div>
            </div>
          </div>

          {/* Total Amount Summary - Tech Hero */}
          <div className="relative bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-orange-500/30 p-3 sm:p-4 rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-cyan-500/5" />
            <div className="relative flex items-center justify-between">
              <span className="text-xs sm:text-sm text-zinc-400 uppercase tracking-wider">Total</span>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2 font-bold text-lg sm:text-xl text-white">
                  {selectedToken && getTokenLogo(selectedToken) ? (
                    <div className="relative">
                      <div className="absolute inset-0 bg-orange-500/30 rounded-full blur-md" />
                      <img 
                        src={selectedToken.token_symbol === 'AVLO' && !selectedToken.logo_url ? avloLogo : selectedToken.logo_url!} 
                        alt={selectedToken.token_symbol} 
                        className="relative w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover ring-2 ring-orange-500/50"
                      />
                    </div>
                  ) : (
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-orange-500/30 to-cyan-500/30 flex items-center justify-center text-xs font-bold">
                      {selectedToken?.token_symbol?.[0] || '?'}
                    </div>
                  )}
                  <span className="font-mono bg-gradient-to-r from-white to-orange-200 bg-clip-text text-transparent">
                    {finalAmount.toLocaleString()} {selectedToken?.token_symbol || 'AVLO'}
                  </span>
                </div>
                {selectedToken?.token_symbol === 'AVLO' && (
                  <span className="text-[10px] sm:text-xs text-cyan-400 font-mono">
                    ≈ {formatAvloWithUsd(finalAmount).usd}
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="text-[10px] sm:text-xs text-center text-zinc-600 flex items-center justify-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-cyan-500/50" />
            Instant blockchain transfer via Arena wallet
            <span className="w-1 h-1 rounded-full bg-cyan-500/50" />
          </p>
        </div>
      </DialogContent>
      </Dialog>
    </>
  );
};
