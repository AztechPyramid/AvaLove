import { useState, useEffect } from 'react';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Heart, Mail, Sparkles, MessageCircle, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MatchCard } from '@/components/MatchCard';
import { motion } from 'framer-motion';

interface Match {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  otherUser: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    location: string | null;
    wallet_address: string | null;
    interests: string[] | null;
    special_badge?: boolean | null;
  };
}

const Matches = () => {
  const { profile } = useWalletAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchMatches();
    }
  }, [profile?.id]);

  const fetchMatches = async () => {
    if (!profile?.id) return;

    try {
      const { data: matchesData, error } = await supabase
        .from('matches')
        .select('*')
        .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch other user profiles
      const matchesWithUsers = await Promise.all(
        (matchesData || []).map(async (match) => {
          const otherUserId = match.user1_id === profile.id ? match.user2_id : match.user1_id;
          
          const { data: userData } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, bio, location, wallet_address, interests, special_badge')
            .eq('id', otherUserId)
            .single();

          return {
            ...match,
            otherUser: userData || { 
              id: otherUserId, 
              username: 'Unknown', 
              display_name: null,
              avatar_url: null, 
              bio: null,
              location: null,
              wallet_address: null,
              interests: null,
              special_badge: null
            }
          };
        })
      );

      setMatches(matchesWithUsers);
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
        {/* Tech Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          />
        </div>
        <motion.div
          className="text-xl text-cyan-400 font-medium"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Loading matches...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24 pb-8 px-4 relative overflow-hidden">
      {/* Tech Grid Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `
              linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
        
        {/* Animated circuit lines */}
        <svg className="absolute inset-0 w-full h-full opacity-10">
          <defs>
            <linearGradient id="matchCircuitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          {[...Array(6)].map((_, i) => (
            <motion.line
              key={i}
              x1={`${i * 20}%`}
              y1="0"
              x2={`${i * 20 + 15}%`}
              y2="100%"
              stroke="url(#matchCircuitGrad)"
              strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: [0, 0.5, 0] }}
              transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </svg>
        
        {/* Animated gradient orbs */}
        <motion.div
          className="absolute top-20 right-10 w-[400px] h-[400px] rounded-full blur-[120px]"
          animate={{
            background: [
              "radial-gradient(circle, rgba(6, 182, 212, 0.2), transparent 70%)",
              "radial-gradient(circle, rgba(168, 85, 247, 0.2), transparent 70%)",
              "radial-gradient(circle, rgba(6, 182, 212, 0.2), transparent 70%)",
            ],
          }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        
        <motion.div
          className="absolute bottom-20 left-10 w-[300px] h-[300px] rounded-full blur-[100px]"
          animate={{
            background: [
              "radial-gradient(circle, rgba(236, 72, 153, 0.15), transparent 70%)",
              "radial-gradient(circle, rgba(6, 182, 212, 0.15), transparent 70%)",
              "radial-gradient(circle, rgba(236, 72, 153, 0.15), transparent 70%)",
            ],
          }}
          transition={{ duration: 5, repeat: Infinity }}
        />

        {/* Floating particles */}
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-cyan-500/40 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-4 mb-4">
            {/* Animated Logo */}
            <div className="relative">
              <motion.div
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-cyan-500/30"
                animate={{ boxShadow: ["0 10px 30px -10px rgba(6, 182, 212, 0.3)", "0 10px 30px -10px rgba(168, 85, 247, 0.4)", "0 10px 30px -10px rgba(6, 182, 212, 0.3)"] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Mail className="w-8 h-8 text-white" />
              </motion.div>
              
              {/* Orbiting element */}
              <motion.div
                className="absolute w-3 h-3 bg-pink-400 rounded-full shadow-lg shadow-pink-400"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: "32px 32px", left: "0", top: "0" }}
              />
              
              {/* Glow effect */}
              <motion.div
                className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 opacity-30 blur-xl -z-10"
                animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
                Your Matches
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-zinc-400 text-sm">Connect with your perfect matches</span>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <motion.div
            className="flex items-center gap-6 mt-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500/10 to-red-500/10 border border-pink-500/20">
              <Heart className="w-5 h-5 text-pink-400" />
              <span className="text-pink-400 font-bold">{matches.length}</span>
              <span className="text-zinc-400 text-sm">Matches</span>
            </div>
            
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
              <MessageCircle className="w-5 h-5 text-cyan-400" />
              <span className="text-zinc-400 text-sm">Start chatting!</span>
            </div>
          </motion.div>
        </motion.div>

        {matches.length === 0 ? (
          <motion.div
            className="relative overflow-hidden rounded-2xl border border-zinc-800/50"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            {/* Background effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-black to-zinc-900" />
            <div className="absolute top-0 right-0 w-60 h-60 bg-cyan-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-pink-500/5 rounded-full blur-3xl" />
            
            <div className="relative p-16 text-center">
              <motion.div
                className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl"
                animate={{ 
                  boxShadow: [
                    "0 20px 50px -15px rgba(6, 182, 212, 0.3)",
                    "0 20px 50px -15px rgba(236, 72, 153, 0.3)",
                    "0 20px 50px -15px rgba(6, 182, 212, 0.3)"
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Heart className="w-12 h-12 text-white" />
              </motion.div>
              
              <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-400 mb-3">
                No matches yet
              </h2>
              <p className="text-zinc-400 text-lg mb-6">
                Keep swiping to find your perfect match! 💕
              </p>
              
              <motion.button
                onClick={() => navigate('/')}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  <span>Start Discovering</span>
                </div>
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {matches.map((match, index) => (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <MatchCard match={match} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Matches;