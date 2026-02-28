import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useRewardPerSecond() {
  const [rewardPerSecond, setRewardPerSecond] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  const fetchValue = async () => {
    try {
      const { data, error } = await supabase
        .from("game_config")
        .select("config_value")
        .eq("config_key", "reward_per_second")
        .maybeSingle();

      if (error) throw error;

      const cfg: any = data?.config_value;
      const value =
        typeof cfg === "number"
          ? cfg
          : cfg && typeof cfg === "object" && "value" in cfg
            ? Number(cfg.value)
            : 1;

      if (Number.isFinite(value) && value > 0) setRewardPerSecond(value);
    } catch (e) {
      console.error("Error fetching reward_per_second:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchValue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { rewardPerSecond, loading, refetch: fetchValue };
}
