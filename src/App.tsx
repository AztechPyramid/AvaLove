import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Header } from '@/components/Header';
import { useGlobalSoundEffects } from '@/hooks/useGlobalSoundEffects';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import FloatingChat, { StakingChatProvider } from '@/components/FloatingChat';
import HourlyCaptchaGuard from '@/components/HourlyCaptchaGuard';

import Connect from "./pages/Connect";
import ProfileSetup from "./pages/ProfileSetup";
import Discover from "./pages/Discover";
import Posts from "./pages/Posts";
import Matches from "./pages/Matches";
import Chat from "./pages/Chat";
import PublicChat from "./pages/PublicChat";
import History from "./pages/History";
import Statistics from "./pages/Statistics";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import Staking from "./pages/Staking";
import Airdrop from "./pages/Airdrop";
import Referral from "./pages/Referral";
import FAQ from "./pages/FAQ";
import MiniGames from "./pages/MiniGames";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import WatchEarn from "./pages/WatchEarn";
import RewardTracker from "./pages/RewardTracker";
import BlackJack from "./pages/BlackJack";
import BlackJackLobby from "./pages/BlackJackLobby";
import BlackJackOnline from "./pages/BlackJackOnline";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Wallet from "./pages/Wallet";
import LoveArt from "./pages/LoveArt";
import AvaScan from "./pages/AvaScan";

import LoveAI from "./pages/LoveAI";
import AvaAI from "./pages/AvaAI";
import ActiveUsers from "./pages/ActiveUsers";
import Pitch from "./pages/Pitch";
import DAO from "./pages/DAO";
import Docs from "./pages/Docs";
import NetworkMap from "./pages/NetworkMap";
import PendingMatchesPage from "./pages/PendingMatchesPage";
import LoveFi from "./pages/LoveFi";
import YieldYakStrategies from "./pages/YieldYakStrategies";
import Swap from "./pages/Swap";
import Status from "./pages/Status";
import BuildApp from "./pages/BuildApp";
import YourAgents from "./pages/YourAgents";



const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, loading, isArena, isConnected, walletAddress } = useWalletAuth();

  if (loading) return <LoadingScreen />;
  
  // Arena users: allow access if wallet is connected, even if profile hasn't loaded yet (DB may be slow)
  if (isArena && isConnected && walletAddress) {
    return <>{children}</>;
  }
  
  if (!profile) return <Navigate to="/connect" />;

  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, loading } = useWalletAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!profile?.id) {
        setIsAdmin(false);
        return;
      }
      
      const { data: hasAdminRole } = await supabase.rpc('has_role', {
        _user_id: profile.id,
        _role: 'admin'
      });
      
      setIsAdmin(hasAdminRole === true);
    };
    
    checkAdminRole();
  }, [profile?.id]);

  if (loading || isAdmin === null) return <div className="min-h-screen bg-black" />;
  if (!profile) return <Navigate to="/connect" />;
  if (!isAdmin) return <Navigate to="/" />;

  return <>{children}</>;
};


const App = () => {
  useGlobalSoundEffects();
  const { profile, loading } = useWalletAuth();
  const location = useLocation();
  
  // Don't show sidebar on connect page
  if (location.pathname === '/connect') {
    return (
      <div className="min-h-screen flex flex-col">
        <Routes>
          <Route path="/connect" element={<Connect />} />
          <Route path="*" element={<Navigate to="/connect" />} />
        </Routes>
      </div>
    );
  }

  return (
    <HourlyCaptchaGuard>
      <StakingChatProvider>
        <SidebarProvider defaultOpen={false}>
          <div className="min-h-screen flex w-full bg-black overflow-x-hidden max-w-full">
            {profile && <AppSidebar />}
            <SidebarInset className="flex-1 bg-black overflow-x-hidden max-w-full">
              <Header />
              <main className="flex-1 bg-black overflow-x-hidden max-w-full">
                <Routes>
                  <Route path="/connect" element={<Connect />} />
                  <Route path="/profile-setup" element={<ProfileSetup />} />
                  <Route path="/" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
                  <Route path="/swap" element={<ProtectedRoute><Swap /></ProtectedRoute>} />
                  <Route path="/ava-ai" element={<ProtectedRoute><AvaAI /></ProtectedRoute>} />
                  <Route path="/love-ai" element={<ProtectedRoute><LoveAI /></ProtectedRoute>} />
                  <Route path="/active-users" element={<ProtectedRoute><ActiveUsers /></ProtectedRoute>} />
                  <Route path="/network-map" element={<ProtectedRoute><NetworkMap /></ProtectedRoute>} />
                  <Route path="/posts" element={<ProtectedRoute><Posts /></ProtectedRoute>} />
                  <Route path="/matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
                  <Route path="/pending-matches" element={<ProtectedRoute><PendingMatchesPage /></ProtectedRoute>} />
                  <Route path="/chat/:matchId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                  <Route path="/public-chat" element={<ProtectedRoute><PublicChat /></ProtectedRoute>} />
                  <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
                  <Route path="/statistics" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
                  <Route path="/staking" element={<ProtectedRoute><Staking /></ProtectedRoute>} />
                  <Route path="/airdrop" element={<ProtectedRoute><Airdrop /></ProtectedRoute>} />
                  <Route path="/referral" element={<ProtectedRoute><Referral /></ProtectedRoute>} />
                  <Route path="/faq" element={<ProtectedRoute><FAQ /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/profile/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                  <Route path="/mini-games" element={<ProtectedRoute><MiniGames /></ProtectedRoute>} />
                  <Route path="/watch-earn" element={<ProtectedRoute><WatchEarn /></ProtectedRoute>} />
                  <Route path="/blackjack" element={<ProtectedRoute><BlackJack /></ProtectedRoute>} />
                  <Route path="/blackjack-lobby" element={<ProtectedRoute><BlackJackLobby /></ProtectedRoute>} />
                  <Route path="/blackjack-online/:tableId" element={<ProtectedRoute><BlackJackOnline /></ProtectedRoute>} />
                  {/* Raffle removed */}
                  <Route path="/reward-tracker" element={<ProtectedRoute><RewardTracker /></ProtectedRoute>} />
                  <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
                  <Route path="/loveart" element={<ProtectedRoute><LoveArt /></ProtectedRoute>} />
                  
                  <Route path="/avascan" element={<ProtectedRoute><AvaScan /></ProtectedRoute>} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/pitch" element={<Pitch />} />
                  <Route path="/status" element={<Status />} />
                  <Route path="/dao" element={<ProtectedRoute><DAO /></ProtectedRoute>} />
                  <Route path="/docs" element={<ProtectedRoute><Docs /></ProtectedRoute>} />
                  <Route path="/lovefi" element={<ProtectedRoute><LoveFi /></ProtectedRoute>} />
                  <Route path="/lovefi/yieldyak" element={<ProtectedRoute><YieldYakStrategies /></ProtectedRoute>} />
                   <Route path="/build-app" element={<ProtectedRoute><BuildApp /></ProtectedRoute>} />
                   <Route path="/your-agents" element={<ProtectedRoute><YourAgents /></ProtectedRoute>} />
                  <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </SidebarInset>
            {/* Global Chat - Desktop: Right sidebar, Mobile: Floating button */}
            {profile && <FloatingChat isGlobal />}
          </div>
        </SidebarProvider>
      </StakingChatProvider>
    </HourlyCaptchaGuard>
  );
};

export default App;
