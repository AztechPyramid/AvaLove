import { useState, useMemo } from 'react';
import { Check, ChevronDown, Flame, Coins, Search, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { WalletToken } from '@/hooks/useWalletTokenBalances';
import { useAvloPrice } from '@/hooks/useAvloPrice';
import avloLogo from '@/assets/avlo-logo.jpg';
import { cn } from '@/lib/utils';

// Fixed USD value for swipes
const FIXED_USD_VALUE = 0.10;

interface PaymentTokenSelectorProps {
  tokens: WalletToken[]; // Now uses WalletToken which already has price & balance filtering
  selectedToken: WalletToken | null;
  onSelect: (token: WalletToken | null) => void;
  action: 'swipe' | 'post' | 'comment';
  avloPrice: number;
  avloBalance?: number;
  formatPrice?: (amount: number, symbol: string) => string;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
}

export function PaymentTokenSelector({
  tokens,
  selectedToken,
  onSelect,
  action,
  avloPrice,
  avloBalance = 0,
  formatPrice,
  className,
  compact = false,
  disabled = false,
}: PaymentTokenSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { price: avloPriceUsd } = useAvloPrice();

  // Reset search when dropdown closes
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSearchQuery('');
    }
  };

  const getActionLabel = () => {
    switch (action) {
      case 'swipe': return 'right swipe';
      case 'post': return 'post';
      case 'comment': return 'comment';
      default: return 'action';
    }
  };

  const formatTokenAmount = (amount: number): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(2)}K`;
    } else if (amount >= 1) {
      return amount.toFixed(2);
    } else if (amount > 0) {
      return amount.toFixed(4);
    }
    return '0';
  };

  // Handle token selection
  const handleTokenSelect = (token: WalletToken | null) => {
    onSelect(token);
    setOpen(false);
  };

  // Filter tokens by search query only - WalletToken already has price & balance filtering done by useWalletTokenBalances
  const filteredTokens = useMemo(() => {
    // Tokens from useWalletTokenBalances are already filtered:
    // - Have DexScreener price
    // - Have enough balance for at least 1 swipe ($0.10)
    let filtered = tokens.filter(token => {
      // Extra safety: ensure swipe_price is valid (> 0)
      return token.swipe_price > 0 && token.priceUsd > 0;
    });
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (token) =>
          token.token_name.toLowerCase().includes(query) ||
          token.token_symbol.toLowerCase().includes(query)
      );
    }

    // Sort by symbol alphabetically
    return [...filtered].sort((a, b) => 
      a.token_symbol.localeCompare(b.token_symbol)
    );
  }, [tokens, searchQuery]);

  // Calculate AVLO amount for $0.10
  const avloAmountForFixedUsd = avloPriceUsd && avloPriceUsd > 0 
    ? FIXED_USD_VALUE / avloPriceUsd 
    : avloPrice;

  // Check if user has enough AVLO
  const hasEnoughAvlo = avloBalance >= avloAmountForFixedUsd;

  return (
    <div className="flex flex-col gap-2">
      {/* Token selector dropdown */}
      <DropdownMenu open={open} onOpenChange={disabled ? undefined : handleOpenChange}>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button
            variant="outline"
            size={compact ? "sm" : "default"}
            disabled={disabled}
            className={cn(
              "border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 text-white gap-1.5 overflow-hidden max-w-full",
              className,
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
              {selectedToken ? (
                <>
                  {selectedToken.logo_url ? (
                    <img 
                      src={selectedToken.logo_url} 
                      alt={selectedToken.token_symbol}
                      className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <Coins className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  )}
                  <span className="font-medium truncate text-sm flex items-center gap-1">
                    {formatTokenAmount(selectedToken.swipe_price)} {selectedToken.token_symbol}
                  </span>
                  <span className="text-xs text-green-400 flex-shrink-0">
                    ($0.10)
                  </span>
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span className="font-medium truncate text-sm text-zinc-400">
                    Select token (min $0.10 balance)
                  </span>
                </>
              )}
            </div>
            <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="center" 
          className="bg-zinc-900 border-zinc-700 w-[var(--radix-dropdown-menu-trigger-width)] min-w-[280px]"
        >
          <p className="px-3 py-2 text-xs text-zinc-500 font-medium">
            Select payment token:
          </p>

          {/* Search input */}
          {tokens.length > 3 && (
            <div className="px-2 pb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  placeholder="Search tokens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 bg-zinc-800 border-zinc-700 text-white text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          <div className="max-h-[300px] overflow-y-auto">
            {filteredTokens.length === 0 ? (
              <p className="px-3 py-4 text-xs text-zinc-500 text-center">
                No tokens with sufficient balance
              </p>
            ) : (
              filteredTokens.map((token) => {
                const isSelected = selectedToken?.token_address === token.token_address;

                return (
                  <DropdownMenuItem
                    key={token.id}
                    onClick={() => handleTokenSelect(token)}
                    className="flex items-center justify-between py-3 cursor-pointer hover:bg-zinc-800"
                  >
                    <div className="flex items-center gap-3">
                      {token.logo_url ? (
                        <img 
                          src={token.logo_url} 
                          alt={token.token_symbol}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                          <Coins className="w-4 h-4 text-purple-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-white">
                          {token.token_symbol}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {formatTokenAmount(token.swipe_price)} per {getActionLabel()}
                          <span className="text-green-400 ml-1">($0.10)</span>
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-green-500" />
                    )}
                  </DropdownMenuItem>
                );
              })
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default PaymentTokenSelector;
