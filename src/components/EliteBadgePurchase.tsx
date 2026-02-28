import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Award, Flame, Loader2, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { useWeb3Auth } from '@/hooks/useWeb3Auth';
import { parseEther } from 'viem';
import { ethers } from 'ethers';

interface EliteBadgePurchaseProps {
  onSuccess?: () => void;
}

const REQUIRED_BURNS = 1000000;
import { AVLO_TOKEN_ADDRESS, ERC20_ABI } from '@/config/staking';
import { DEAD_ADDRESS } from '@/config/wagmi';


export const EliteBadgePurchase = ({ onSuccess }: EliteBadgePurchaseProps) => {
  const { profile, walletAddress } = useWalletAuth();
  const { isArena, arenaSDK } = useWeb3Auth();
  const [totalBurned, setTotalBurned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [burning, setBurning] = useState(false);
  const [activating, setActivating] = useState(false);
  const [hasSpecialBadge, setHasSpecialBadge] = useState(false);
  const isBlockedWallet = walletAddress?.toLowerCase() === '0x87A7A3D8f13f92795e2Ce5016B36E15893439B4F'.toLowerCase();

  useEffect(() => {
    if (profile?.id) {
      fetchUserBurns();
      checkBadgeStatus();
    }
  }, [profile?.id]);

  const fetchUserBurns = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('token_burns')
        .select('amount')
        .eq('user_id', profile.id);

      if (error) throw error;

      const total = data?.reduce((sum, burn) => sum + Number(burn.amount), 0) || 0;
      setTotalBurned(total);
      
      // Auto-activate badge if requirements are met
      if (total >= REQUIRED_BURNS && !isBlockedWallet) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('special_badge')
          .eq('id', profile.id)
          .single();
        
        if (profileData && !profileData.special_badge) {
          console.log('[BADGE] Auto-activating badge - requirements met');
          await supabase
            .from('profiles')
            .update({ special_badge: true })
            .eq('id', profile.id);
          
          setHasSpecialBadge(true);
          toast.success('🔥 Elite Burner badge automatically unlocked!');
        }
      }
    } catch (error) {
      console.error('Error fetching burns:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkBadgeStatus = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('special_badge')
        .eq('id', profile.id)
        .single();

      if (error) throw error;
      const active = data.special_badge || false;
      setHasSpecialBadge(!isBlockedWallet && active);
    } catch (error) {
      console.error('Error checking badge status:', error);
    }
  };

  const handleBurnTokens = async () => {
    console.log('[BURN] Button clicked!', { walletAddress, profileId: profile?.id, totalBurned, isArena });
    
    if (!walletAddress || !profile?.id) {
      console.log('[BURN] Wallet not connected');
      toast.error('Please connect your wallet');
      return;
    }

    const remainingBurns = REQUIRED_BURNS - totalBurned;
    console.log('[BURN] Remaining burns:', remainingBurns);
    
    if (remainingBurns <= 0) {
      console.log('[BURN] Already burned enough');
      toast.error('You have already burned enough tokens');
      return;
    }

    setBurning(true);
    console.log('[BURN] Starting burn process...');
    
    try {
      let provider;
      let signer;
      
      console.log('[BURN] Checking wallet type:', { isArena, hasArenaSDK: !!arenaSDK, hasEthereum: !!window.ethereum });
      
      // Handle both Arena SDK and regular wallets
      if (isArena && arenaSDK?.provider) {
        console.log('[BURN] Using Arena SDK provider');
        // Use Arena SDK provider
        provider = new ethers.BrowserProvider(arenaSDK.provider);
        signer = await provider.getSigner();
      } else if (window.ethereum) {
        console.log('[BURN] Using MetaMask/regular wallet');
        // Use regular wallet (MetaMask, etc.)
        // @ts-ignore
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
      } else {
        console.log('[BURN] No wallet provider found');
        toast.error('Please connect your wallet');
        setBurning(false);
        return;
      }

      console.log('[BURN] Creating contract...');
      const contract = new ethers.Contract(AVLO_TOKEN_ADDRESS, ERC20_ABI, signer);

      // Burn the remaining amount by sending to dead address
      const amountToBurn = parseEther(remainingBurns.toString());
      console.log('[BURN] Amount to burn:', remainingBurns, 'Wei:', amountToBurn.toString());
      
      toast.loading('🔐 Please confirm the transaction in your wallet...', { id: 'badge-burn' });
      console.log('[BURN] Calling contract.transfer() to DEAD_ADDRESS...', DEAD_ADDRESS);
      const tx = await contract.transfer(DEAD_ADDRESS, amountToBurn);
      console.log('[BURN] Transaction sent:', tx.hash);
      
      toast.loading('⛓️ Transaction submitted! Waiting for blockchain confirmation...', { id: 'badge-burn' });
      const receipt = await tx.wait();
      console.log('[BURN] Transaction confirmed:', receipt);
      
      toast.loading('💾 Recording burn on database...', { id: 'badge-burn' });

      // Record the burn in database
      const { error: burnError } = await supabase
        .from('token_burns')
        .insert({
          user_id: profile.id,
          amount: remainingBurns,
          burn_type: 'elite_badge',
          tx_hash: receipt.hash
        });

      if (burnError) {
        console.error('[BURN] Database error:', burnError);
        throw burnError;
      }

      console.log('[BURN] Updating badge status...');
      // Update the badge status
      const { error: badgeError } = await supabase
        .from('profiles')
        .update({ special_badge: true })
        .eq('id', profile.id);

      if (badgeError) {
        console.error('[BURN] Badge update error:', badgeError);
        throw badgeError;
      }

      setTotalBurned(REQUIRED_BURNS);
      setHasSpecialBadge(true);
      console.log('[BURN] Success!');
      toast.success('🔥 Elite Burner badge unlocked! Tokens burned successfully!', { id: 'badge-burn' });
      onSuccess?.();
    } catch (error: any) {
      console.error('[BURN] Error:', error);
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        toast.error('❌ Transaction was rejected', { id: 'badge-burn' });
      } else if (error.code === 'CALL_EXCEPTION' || error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        toast.error('On-chain burn failed. Check AVLO balance and try a smaller amount.', { id: 'badge-burn' });
      } else {
        toast.error('Failed to burn tokens. Please try again later.', { id: 'badge-burn' });
      }
    } finally {
      console.log('[BURN] Cleaning up...');
      setBurning(false);
    }
  };

  const handleActivateBadge = async () => {
    if (!profile?.id || totalBurned < REQUIRED_BURNS) {
      toast.error('You need to burn 1,000,000 AVLO to unlock Elite Burner badge');
      return;
    }

    setActivating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ special_badge: true })
        .eq('id', profile.id);

      if (error) throw error;

      setHasSpecialBadge(true);
      toast.success('Elite Burner badge activated! 🔥');
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate badge');
      console.error('Badge activation error:', error);
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-4 bg-zinc-900 border-orange-500/30">
        <div className="flex items-center justify-center">
          <Loader2 className="animate-spin text-orange-500" size={20} />
        </div>
      </Card>
    );
  }

  if (hasSpecialBadge && !isBlockedWallet) {
    return (
      <Card className="p-4 bg-gradient-to-br from-orange-900/50 to-yellow-900/50 border-orange-500/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-yellow-400 to-orange-400 blur-xl opacity-75 animate-pulse"></div>
            <Award className="relative w-8 h-8 text-yellow-400" />
          </div>
          <div>
            <p className="text-white font-bold">Elite Burner Badge Active</p>
            <p className="text-xs text-zinc-300">You've burned {totalBurned.toLocaleString()} AVLO</p>
          </div>
        </div>
      </Card>
    );
  }

  const remaining = REQUIRED_BURNS - totalBurned;
  const canActivate = totalBurned >= REQUIRED_BURNS;

  return (
    <Card className="p-4 bg-zinc-900 border-orange-500/30">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-orange-500" />
          <h3 className="text-white font-bold">Elite Burner Badge</h3>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Progress</span>
            <span className="text-white font-semibold">
              {totalBurned.toLocaleString()} / {REQUIRED_BURNS.toLocaleString()} AVLO
            </span>
          </div>
          
          <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 transition-all duration-500"
              style={{ width: `${Math.min((totalBurned / REQUIRED_BURNS) * 100, 100)}%` }}
            />
          </div>

          {!canActivate && (
            <p className="text-xs text-zinc-400">
              <Flame className="inline w-3 h-3 mr-1" />
              {remaining.toLocaleString()} more AVLO needed to unlock
            </p>
          )}
        </div>

        {canActivate ? (
          <Button
            onClick={handleActivateBadge}
            disabled={activating}
            className="w-full bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-500 hover:to-yellow-500 text-white"
          >
            {activating ? (
              <>
                <Loader2 className="animate-spin mr-2" size={16} />
                Activating...
              </>
            ) : (
              <>
                <Award className="mr-2" size={16} />
                Activate Elite Badge
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleBurnTokens}
            disabled={burning}
            className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white"
          >
            {burning ? (
              <>
                <Loader2 className="animate-spin mr-2" size={16} />
                Burning...
              </>
            ) : (
              <>
                <Flame className="mr-2" size={16} />
                Burn {remaining.toLocaleString()} AVLO & Unlock Badge
              </>
            )}
          </Button>
        )}

        <p className="text-xs text-center text-zinc-500">
          Elite Burners get animated badges, glowing profiles, and special recognition
        </p>
      </div>
    </Card>
  );
};