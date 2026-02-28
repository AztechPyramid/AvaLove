import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Flame, Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWalletAuth } from "@/contexts/WalletAuthContext";
import { useAvloBalance } from "@/hooks/useAvloBalance";
import { useRewardPerSecond } from "@/hooks/useRewardPerSecond";
import { toast } from "sonner";
import AvloTokenLogo from "@/assets/avlo-token-logo.jpg";

interface BoostProfileButtonProps {
  profileId: string;
  profileName: string;
  onBoostComplete?: () => void;
}

interface BoostOption {
  duration: string;
  hours: number;
  multiplier: number;
}

// Base multipliers - 1h = 1x, others are multiples
const BOOST_MULTIPLIERS: BoostOption[] = [
  { duration: "1h", hours: 1, multiplier: 1 },
  { duration: "2h", hours: 2, multiplier: 2 },
  { duration: "4h", hours: 4, multiplier: 4 },
  { duration: "24h", hours: 24, multiplier: 24 },
  { duration: "7d", hours: 168, multiplier: 168 },
];

export function BoostProfileButton({ profileId, profileName, onBoostComplete }: BoostProfileButtonProps) {
  const { profile } = useWalletAuth();
  const { balance, refresh: refreshBalance } = useAvloBalance();
  const { rewardPerSecond } = useRewardPerSecond();
  const [open, setOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<BoostOption | null>(null);
  const [boosting, setBoosting] = useState(false);

  // Calculate dynamic costs based on rewardPerSecond * 1000 * multiplier
  const baseCost = rewardPerSecond * 1000;
  
  const boostOptions = useMemo(() => {
    return BOOST_MULTIPLIERS.map(opt => ({
      ...opt,
      cost: baseCost * opt.multiplier
    }));
  }, [baseCost]);

  const getSelectedCost = () => {
    if (!selectedOption) return 0;
    return baseCost * selectedOption.multiplier;
  };

  const handleBoost = async () => {
    if (!profile?.id) {
      toast.error("Please connect your wallet");
      return;
    }

    if (profile.id === profileId) {
      toast.error("You cannot boost yourself");
      return;
    }

    if (!selectedOption) {
      toast.error("Select a boost duration");
      return;
    }

    const cost = getSelectedCost();

    if (cost > balance) {
      toast.error("Insufficient AVLO credits");
      return;
    }

    setBoosting(true);
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + selectedOption.hours);

      // Record the boost in swipe_profile_boosts table
      const { error: boostError } = await supabase
        .from('swipe_profile_boosts')
        .insert({
          profile_id: profileId,
          booster_id: profile.id,
          amount: cost,
          duration_hours: selectedOption.hours,
          expires_at: expiresAt.toISOString()
        });

      if (boostError) throw boostError;

      // Record as token burn for tracking (this deducts from spendable credits)
      const { error: burnError } = await supabase
        .from('token_burns')
        .insert({
          user_id: profile.id,
          burn_type: 'swipe_boost',
          amount: cost
        });

      if (burnError) {
        console.error("Token burn record error:", burnError);
        throw burnError;
      }

      // Send notification to the boosted user (non-blocking)
      supabase
        .from('notifications')
        .insert({
          user_id: profileId,
          type: 'profile_boost',
          title: '🔥 Profile Boosted!',
          message: `${profile.username || 'Someone'} boosted your profile with ${formatCost(cost)} AVLO credits for ${selectedOption.duration}!`,
          data: {
            booster_id: profile.id,
            booster_username: profile.username,
            booster_avatar: profile.avatar_url,
            amount: cost,
            duration: selectedOption.duration
          }
        })
        .then(({ error }) => {
          if (error) console.error("Notification error:", error);
        });

      toast.success(`Boosted ${profileName} for ${selectedOption.duration}!`);
      setOpen(false);
      setSelectedOption(null);
      refreshBalance();
      onBoostComplete?.();
    } catch (error) {
      console.error("Boost error:", error);
      toast.error("Failed to boost profile");
    } finally {
      setBoosting(false);
    }
  };

  const formatCost = (cost: number) => {
    if (cost >= 1000000) return `${(cost / 1000000).toFixed(1)}M`;
    if (cost >= 1000) return `${(cost / 1000).toFixed(0)}K`;
    return cost.toFixed(2);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white gap-0.5 h-7 text-[9px] px-1 w-full font-mono"
        >
          <Flame className="w-2.5 h-2.5" />
          BOOST
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-purple-500" />
            Boost {profileName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-purple-500/30">
            <p className="text-sm text-zinc-400 mb-2">Your AVLO Credit Balance</p>
            <div className="flex items-center gap-2">
              <img src={AvloTokenLogo} alt="AVLO" className="w-6 h-6 rounded-full" />
              <span className="text-xl font-bold text-white">
                {balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Select Boost Duration</Label>
            <div className="grid grid-cols-3 gap-2">
              {boostOptions.map((option) => {
                const canAfford = balance >= option.cost;
                return (
                  <button
                    key={option.hours}
                    onClick={() => canAfford && setSelectedOption(BOOST_MULTIPLIERS.find(m => m.hours === option.hours) || null)}
                    disabled={!canAfford}
                    className={`p-3 rounded-lg border transition-all ${
                      selectedOption?.hours === option.hours
                        ? 'border-purple-500 bg-purple-500/20 ring-2 ring-purple-500/50'
                        : canAfford
                        ? 'border-zinc-700 bg-zinc-800 hover:border-purple-500/50'
                        : 'border-zinc-800 bg-zinc-900 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Clock className="w-4 h-4 text-purple-400" />
                      <span className="font-semibold text-white">{option.duration}</span>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <img src={AvloTokenLogo} alt="AVLO" className="w-4 h-4 rounded-full" />
                      <span className="text-sm text-purple-300">{formatCost(option.cost)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
            <p className="text-xs text-purple-300">
              🔥 Boosted profiles appear with a purple glow and "Boosted" badge in Discover! Higher boost = more visibility priority.
            </p>
          </div>

          <Button
            onClick={handleBoost}
            disabled={boosting || !selectedOption}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
          >
            {boosting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Flame className="w-4 h-4 mr-2" />
            )}
            {boosting ? "Boosting..." : selectedOption ? `Boost for ${selectedOption.duration}` : "Select Duration"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
