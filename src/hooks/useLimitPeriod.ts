import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type LimitPeriod = "daily" | "weekly" | "monthly" | "yearly";

export const periodLabels: Record<LimitPeriod, string> = {
  daily: "Günlük",
  weekly: "Haftalık",
  monthly: "Aylık",
  yearly: "Yıllık"
};

export const periodLabelsEn: Record<LimitPeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly"
};

export function useLimitPeriod() {
  const [period, setPeriod] = useState<LimitPeriod>("daily");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPeriod();
  }, []);

  const fetchPeriod = async () => {
    try {
      const { data } = await supabase
        .from('game_config')
        .select('config_value')
        .eq('config_key', 'limit_period')
        .single();

      const cfg: any = data?.config_value;

      if (typeof cfg === 'string') {
        setPeriod(cfg as LimitPeriod);
      } else if (cfg && typeof cfg === 'object' && 'value' in cfg) {
        setPeriod(cfg.value as LimitPeriod);
      }
    } catch (error) {
      console.error("Error fetching limit period:", error);
    } finally {
      setLoading(false);
    }
  };

  return {
    period,
    periodLabel: periodLabels[period],
    periodLabelEn: periodLabelsEn[period],
    loading,
    refetch: fetchPeriod
  };
}
