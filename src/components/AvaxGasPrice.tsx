import { useState, useEffect } from 'react';
import { Fuel } from 'lucide-react';
import avaxLogo from '@/assets/avax-logo.png';
import { useWeb3Auth } from '@/hooks/useWeb3Auth';

interface GasPriceData {
  nAvax: number;
  usd: number;
  avaxPrice: number;
}

const AVALANCHE_RPC = 'https://api.avax.network/ext/bc/C/rpc';

export function AvaxGasPrice({ showBalance = false }: { showBalance?: boolean }) {
  const { walletAddress, isConnected } = useWeb3Auth();
  const [gasPrice, setGasPrice] = useState<GasPriceData | null>(null);
  const [avaxBalance, setAvaxBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch gas price from Avalanche RPC
        const gasResponse = await fetch(AVALANCHE_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_gasPrice',
            params: []
          })
        });
        
        const gasData = await gasResponse.json();
        const gasPriceWei = parseInt(gasData.result, 16) || 25000000000; // Default 25 gwei if parsing fails
        const gasPriceNAvax = gasPriceWei / 1e9; // Convert wei to nAVAX (gwei)
        
        // Estimate gas for typical ERC20 transfer (approx 65000 gas)
        const estimatedGas = 65000;
        const totalGasCostAvax = (gasPriceWei * estimatedGas) / 1e18;
        
        // Fetch AVAX price from CoinGecko
        let avaxPrice = 35; // Fallback price
        try {
          const priceResponse = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=usd',
            { signal: AbortSignal.timeout(5000) }
          );
          if (priceResponse.ok) {
            const priceData = await priceResponse.json();
            avaxPrice = priceData['avalanche-2']?.usd || 35;
          }
        } catch {
          console.log('Using fallback AVAX price');
        }
        
        const usdCost = totalGasCostAvax * avaxPrice;
        
        setGasPrice({
          nAvax: Math.max(1, Math.round(gasPriceNAvax)),
          usd: usdCost,
          avaxPrice
        });

        // Fetch user's AVAX balance if wallet connected
        if (showBalance && walletAddress && isConnected) {
          const balanceResponse = await fetch(AVALANCHE_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              method: 'eth_getBalance',
              params: [walletAddress, 'latest']
            })
          });
          
          const balanceData = await balanceResponse.json();
          const balanceWei = parseInt(balanceData.result, 16) || 0;
          const balanceAvax = balanceWei / 1e18;
          setAvaxBalance(balanceAvax);
        }
      } catch (error) {
        console.error('Error fetching gas price:', error);
        setGasPrice({ nAvax: 25, usd: 0.05, avaxPrice: 35 }); // Fallback values
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 2 minutes (gas price doesn't change that fast)
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, [walletAddress, isConnected, showBalance]);

  if (loading || !gasPrice) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-800/50 border border-zinc-700/50 animate-pulse">
        <div className="w-4 h-4 rounded-full bg-zinc-700" />
        <div className="w-20 h-3 rounded bg-zinc-700" />
      </div>
    );
  }

  const hasEnoughGas = avaxBalance !== null ? avaxBalance > 0.01 : true;

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors ${
      showBalance && !hasEnoughGas 
        ? 'bg-red-500/10 border-red-500/30' 
        : 'bg-zinc-800/80 border-zinc-700/50 hover:bg-zinc-700/80'
    }`}>
      {/* Gas Label */}
      <div className="flex items-center gap-1">
        <Fuel className="w-3.5 h-3.5 text-orange-400" />
        <span className="text-[10px] sm:text-xs text-zinc-400 font-medium">Gas:</span>
      </div>

      {/* Gas Price */}
      <div className="flex items-center gap-1">
        <img 
          src={avaxLogo} 
          alt="AVAX" 
          className="w-3.5 h-3.5 rounded-full"
        />
        <span className="text-[10px] sm:text-xs font-medium text-white">
          {gasPrice.nAvax}
        </span>
        <span className="text-[10px] sm:text-xs text-zinc-500">
          nAVAX
        </span>
        <span className="text-[10px] sm:text-xs text-green-400">
          (~${gasPrice.usd < 0.01 ? '<0.01' : gasPrice.usd.toFixed(3)})
        </span>
      </div>

      {/* User Balance */}
      {showBalance && avaxBalance !== null && (
        <>
          <span className="text-zinc-600">|</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] sm:text-xs text-zinc-400">Bal:</span>
            <span className={`text-[10px] sm:text-xs font-medium ${hasEnoughGas ? 'text-green-400' : 'text-red-400'}`}>
              {avaxBalance < 0.001 ? '<0.001' : avaxBalance.toFixed(3)} AVAX
            </span>
          </div>
        </>
      )}
    </div>
  );
}
