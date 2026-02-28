import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { ArenaReferralSection } from '@/components/ArenaReferralSection';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Users, TrendingUp, CheckCircle2, Award } from 'lucide-react';
import { motion } from 'framer-motion';

const Referral = () => {
  const { profile } = useWalletAuth();
  const arenaProfile = profile as any;

  // Fetch Arena referral stats
  const { data: referralStats } = useQuery({
    queryKey: ['arenaReferralStats', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return { sent: 0, confirmed: 0, pendingForMe: 0 };

      // Count sent referrals
      const { data: sent } = await supabase
        .from('arena_referrals')
        .select('id, status')
        .eq('referrer_id', profile.id);

      // Count pending referrals for me to confirm
      const { data: pendingForMe } = await supabase
        .from('arena_referrals')
        .select('id')
        .ilike('referred_arena_username', arenaProfile?.arena_username || '')
        .eq('status', 'pending')
        .is('referred_id', null);

      const totalSent = sent?.length || 0;
      const confirmedCount = sent?.filter(r => r.status === 'confirmed').length || 0;

      return {
        sent: totalSent,
        confirmed: confirmedCount,
        pendingForMe: pendingForMe?.length || 0
      };
    },
    enabled: !!profile?.id
  });

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white">Please connect your wallet</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Stats Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          <Card className="bg-zinc-900/80 backdrop-blur-sm border-zinc-800 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-gray-400">Total Sent</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {referralStats?.sent || 0}
            </div>
          </Card>

          <Card className="bg-zinc-900/80 backdrop-blur-sm border-green-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-400">Confirmed</span>
            </div>
            <div className="text-2xl font-bold text-green-400">
              {referralStats?.confirmed || 0}
            </div>
          </Card>

          <Card className="bg-zinc-900/80 backdrop-blur-sm border-purple-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-gray-400">Score Earned</span>
            </div>
            <div className="text-2xl font-bold text-purple-400">
              +{referralStats?.confirmed || 0}
            </div>
          </Card>

          <Card className="bg-zinc-900/80 backdrop-blur-sm border-yellow-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-gray-400">Pending</span>
            </div>
            <div className="text-2xl font-bold text-yellow-400">
              {referralStats?.pendingForMe || 0}
            </div>
          </Card>
        </motion.div>

        {/* Pending notification */}
        {(referralStats?.pendingForMe || 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="bg-zinc-900/80 backdrop-blur-sm border-yellow-500/30 p-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <p className="text-yellow-400 text-sm">
                  You have <span className="font-bold">{referralStats?.pendingForMe}</span> pending referral confirmation(s) below
                </p>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Arena Referral System */}
        <ArenaReferralSection />
      </div>
    </div>
  );
};

export default Referral;