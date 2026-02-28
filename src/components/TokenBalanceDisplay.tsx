import { useState, useEffect } from 'react';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { useAvloPrice } from '@/hooks/useAvloPrice';
import { usePaymentTokens, PaymentToken } from '@/hooks/usePaymentTokens';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import avloLogo from '@/assets/avlo-logo.jpg';
import arenaLogo from '@/assets/arena-logo.png';
import { Card } from '@/components/ui/card';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { ERC20_ABI } from '@/config/staking';

const AVALANCHE_RPC = "https://api.avax.network/ext/bc/C/rpc";

interface TokenBalanceDisplayProps {
  walletAddress?: string;
  compact?: boolean;
  className?: string;
}

interface CustomTokenBalance {
  token: PaymentToken;
  balance: string;
}

export const TokenBalanceDisplay = ({ walletAddress, compact = false, className = '' }: TokenBalanceDisplayProps) => {
  const { walletAddress: connectedAddress } = useWalletAuth();
  const targetAddress = walletAddress || connectedAddress;
  const { avloBalance, arenaBalance, hasBalances } = useTokenBalances(walletAddress);
  const { formatAvloWithUsd } = useAvloPrice();
  const { tokens } = usePaymentTokens();
  const [customBalances, setCustomBalances] = useState<CustomTokenBalance[]>([]);
  const [loadingCustom, setLoadingCustom] = useState(false);

  useEffect(() => {
    const fetchCustomBalances = async () => {
      if (!targetAddress || tokens.length === 0) {
        setCustomBalances([]);
        return;
      }

      setLoadingCustom(true);
      try {
        const provider = new JsonRpcProvider(AVALANCHE_RPC);
        const balances: CustomTokenBalance[] = [];

        for (const token of tokens) {
          try {
            const contract = new Contract(token.token_address, ERC20_ABI, provider);
            const rawBalance = await contract.balanceOf(targetAddress);
            const formatted = formatUnits(rawBalance, token.decimals);
            
            // Show all tokens regardless of balance
            balances.push({ token, balance: formatted });
          } catch (err) {
            console.error(`Error fetching balance for ${token.token_symbol}:`, err);
            // Still add token with 0 balance if fetch fails
            balances.push({ token, balance: '0' });
          }
        }

        setCustomBalances(balances);
      } catch (error) {
        console.error('Error fetching custom token balances:', error);
      } finally {
        setLoadingCustom(false);
      }
    };

    fetchCustomBalances();
  }, [targetAddress, tokens]);

  if (!hasBalances) {
    return null;
  }

  const avloFormatted = formatAvloWithUsd(avloBalance);

  // Filter tokens with balance > 0
  const tokensWithBalance = customBalances.filter(({ token, balance }) => {
    const isNotMainToken = token.token_symbol.toUpperCase() !== 'ARENA' && token.token_symbol.toUpperCase() !== 'AVLO';
    const hasBalance = parseFloat(balance) > 0;
    return isNotMainToken && hasBalance;
  });

  const hasAvloBalance = parseFloat(avloBalance) > 0;
  const hasArenaBalance = parseFloat(arenaBalance) > 0;

  if (compact) {
    return (
      <div className={`max-h-[180px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent ${className}`}>
        {/* AVLO Token - only show if has balance */}
        {hasAvloBalance && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5">
            <div className="flex items-center gap-2">
              <img src={avloLogo} alt="AVLO" className="w-6 h-6 rounded-full" />
              <span className="text-sm text-white/70">AVLO</span>
            </div>
            <div className="text-right">
              <div className="font-semibold text-sm text-orange-500">{avloFormatted.avlo}</div>
              <div className="text-xs text-green-400">{avloFormatted.usd}</div>
            </div>
          </div>
        )}
        
        {/* ARENA Token - only show if has balance */}
        {hasArenaBalance && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5">
            <div className="flex items-center gap-2">
              <img src={arenaLogo} alt="ARENA" className="w-6 h-6 rounded-full" />
              <span className="text-sm text-white/70">ARENA</span>
            </div>
            <div className="text-right">
              <div className="font-semibold text-sm text-orange-500">{parseFloat(arenaBalance).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
            </div>
          </div>
        )}

        {/* Platform Tokens with balance */}
        {tokensWithBalance.map(({ token, balance }) => (
          <div key={token.id} className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5">
            <div className="flex items-center gap-2">
              {token.logo_url ? (
                <img src={token.logo_url} alt={token.token_symbol} className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-[10px]">
                  {token.token_symbol.slice(0, 2)}
                </div>
              )}
              <span className="text-sm text-white/70">{token.token_symbol}</span>
            </div>
            <div className="text-right">
              <div className="font-semibold text-sm text-orange-500">
                {parseFloat(balance).toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        ))}

        {/* Loading skeleton */}
        {loadingCustom && tokens.length > 0 && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5 animate-pulse">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-zinc-700" />
              <div className="w-12 h-3 bg-zinc-700 rounded" />
            </div>
            <div className="w-16 h-4 bg-zinc-700 rounded" />
          </div>
        )}

        {/* Empty state */}
        {!loadingCustom && !hasAvloBalance && !hasArenaBalance && tokensWithBalance.length === 0 && (
          <div className="text-center text-white/40 text-sm py-4">
            No tokens found
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className={`p-4 bg-black border-zinc-800 ${className}`}>
      <h3 className="text-sm font-semibold mb-3 text-zinc-400">Your Balances</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {/* AVLO Token */}
        <div className="flex flex-col items-center justify-center p-3 bg-zinc-900 rounded-lg border border-zinc-800">
          <img src={avloLogo} alt="AVLO" className="w-8 h-8 rounded-full mb-2" />
          <span className="text-xs text-zinc-400 mb-1">AVLO</span>
          <span className="font-bold text-lg text-orange-500">{avloFormatted.avlo}</span>
          <span className="text-xs text-green-400">{avloFormatted.usd}</span>
        </div>
        
        {/* ARENA Token */}
        <div className="flex flex-col items-center justify-center p-3 bg-zinc-900 rounded-lg border border-zinc-800">
          <img src={arenaLogo} alt="ARENA" className="w-8 h-8 rounded-full mb-2" />
          <span className="text-xs text-zinc-400 mb-1">ARENA</span>
          <span className="font-bold text-lg text-orange-500">{parseFloat(arenaBalance).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
        </div>

        {/* Custom Payment Tokens - exclude ARENA and AVLO since they're already shown above */}
        {customBalances
          .filter(({ token }) => token.token_symbol.toUpperCase() !== 'ARENA' && token.token_symbol.toUpperCase() !== 'AVLO')
          .map(({ token, balance }) => (
          <div key={token.id} className="flex flex-col items-center justify-center p-3 bg-zinc-900 rounded-lg border border-zinc-800">
            {token.logo_url ? (
              <img src={token.logo_url} alt={token.token_symbol} className="w-8 h-8 rounded-full mb-2 object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full mb-2 bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs">
                {token.token_symbol.slice(0, 2)}
              </div>
            )}
            <span className="text-xs text-zinc-400 mb-1 truncate max-w-full">{token.token_symbol}</span>
            <span className="font-bold text-lg text-orange-500">
              {parseFloat(balance).toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}

        {/* Loading skeleton for custom tokens */}
        {loadingCustom && tokens.length > 0 && (
          <div className="flex flex-col items-center justify-center p-3 bg-zinc-900 rounded-lg border border-zinc-800 animate-pulse">
            <div className="w-8 h-8 rounded-full mb-2 bg-zinc-700" />
            <div className="w-12 h-3 bg-zinc-700 rounded mb-1" />
            <div className="w-16 h-5 bg-zinc-700 rounded" />
          </div>
        )}
      </div>
    </Card>
  );
};