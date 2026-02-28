import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Loader2, ChevronDown } from "lucide-react";
import { AnimatedAvatar } from "@/components/AnimatedAvatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import AvloTokenLogo from "@/assets/avlo-token-logo.jpg";

interface BoosterInfo {
  user_id: string;
  total_amount: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  arena_username: string | null;
  arena_verified: boolean | null;
}

interface ProfileBoostInfoProps {
  profileId: string;
  boostAmount?: number;
  compact?: boolean;
}

export function ProfileBoostInfo({ profileId, boostAmount, compact = false }: ProfileBoostInfoProps) {
  const [boosters, setBoosters] = useState<BoosterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchBoosters();
  }, [profileId]);

  const fetchBoosters = async () => {
    try {
      // Only get active boosts (not expired)
      const { data: boosts, error } = await supabase
        .from('swipe_profile_boosts')
        .select(`
          booster_id,
          amount,
          user:booster_id(username, display_name, avatar_url, arena_username, arena_verified)
        `)
        .eq('profile_id', profileId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Aggregate by user
      const userTotals = new Map<string, BoosterInfo>();
      boosts?.forEach((boost: any) => {
        if (!boost.user) return;
        const existing = userTotals.get(boost.booster_id);
        if (existing) {
          existing.total_amount += Number(boost.amount);
        } else {
          userTotals.set(boost.booster_id, {
            user_id: boost.booster_id,
            total_amount: Number(boost.amount),
            username: boost.user.username,
            display_name: boost.user.display_name,
            avatar_url: boost.user.avatar_url,
            arena_username: boost.user.arena_username,
            arena_verified: boost.user.arena_verified,
          });
        }
      });

      // Sort by total amount and take top 10 only
      const sorted = Array.from(userTotals.values())
        .sort((a, b) => b.total_amount - a.total_amount)
        .slice(0, 10);
      setBoosters(sorted);
    } catch (error) {
      console.error("Error fetching boosters:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalBoost = boostAmount || 0;

  if (totalBoost === 0 && boosters.length === 0) return null;

  // Compact mode - just show boosters avatars stacked
  if (compact) {
    return (
      <div 
        className="flex items-center gap-1 cursor-pointer" 
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        <Flame className="w-3 h-3 text-purple-400 animate-pulse" />
        <div className="flex -space-x-1.5">
          {boosters.slice(0, 3).map((booster) => (
            <AnimatedAvatar
              key={booster.user_id}
              userId={booster.user_id}
              avatarUrl={booster.avatar_url}
              username={booster.username}
              displayName={booster.display_name}
              className="w-4 h-4 ring-1 ring-purple-500/50"
              fallbackClassName="text-[6px]"
            />
          ))}
          {boosters.length > 3 && (
            <div className="w-4 h-4 rounded-full bg-purple-500/30 flex items-center justify-center text-[6px] text-white ring-1 ring-purple-500/50">
              +{boosters.length - 3}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between bg-gradient-to-br from-purple-900/80 via-purple-800/70 to-pink-900/60 border-purple-500/50 hover:from-purple-800/90 hover:via-purple-700/80 hover:to-pink-800/70 text-white h-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <Flame className="w-3 h-3 text-purple-400 animate-pulse" />
            <span className="text-xs font-semibold">Boosted</span>
            <div className="flex items-center gap-1 bg-purple-500/20 px-1.5 py-0.5 rounded-full">
              <img src={AvloTokenLogo} alt="AVLO" className="w-3 h-3 rounded-full" />
              <span className="text-[10px] font-bold text-purple-300">
                {totalBoost.toLocaleString()}
              </span>
            </div>
            {/* Stacked boosters avatars */}
            <div className="flex -space-x-1.5 ml-1">
              {boosters.slice(0, 3).map((booster) => (
                <AnimatedAvatar
                  key={booster.user_id}
                  userId={booster.user_id}
                  avatarUrl={booster.avatar_url}
                  username={booster.username}
                  displayName={booster.display_name}
                  className="w-4 h-4 ring-1 ring-purple-500/50"
                  fallbackClassName="text-[6px]"
                />
              ))}
            </div>
          </div>
          <ChevronDown className={`w-3 h-3 text-purple-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="bg-gradient-to-br from-purple-900/30 via-pink-900/20 to-purple-900/30 border border-purple-500/30 rounded-xl p-2">
          {loading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
            </div>
          ) : boosters.length > 0 ? (
            <div className="space-y-1.5">
              {boosters.map((booster, index) => (
                <div 
                  key={booster.user_id}
                  className="flex items-center justify-between bg-black/20 rounded-lg px-2 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 font-medium w-4">
                      #{index + 1}
                    </span>
                    <AnimatedAvatar
                      userId={booster.user_id}
                      avatarUrl={booster.avatar_url}
                      username={booster.username}
                      displayName={booster.display_name}
                      className="w-5 h-5"
                      fallbackClassName="text-[8px]"
                    />
                    <span className="text-[11px] text-white font-medium truncate max-w-[80px]">
                      {booster.display_name || booster.username}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <img src={AvloTokenLogo} alt="AVLO" className="w-3 h-3 rounded-full" />
                    <span className="text-[10px] font-semibold text-purple-300">
                      {booster.total_amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-purple-300/60 text-center py-1">No active boosters</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}