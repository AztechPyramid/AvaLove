import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletAuth } from "@/contexts/WalletAuthContext";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ArrowLeft, Shield, Gamepad2, Settings, Clock, Coins, Play, TrendingUp, Users, KeyRound, Lock, Image, CreditCard, Zap, Sparkles, AlertTriangle, BarChart3, MapPin, Bot, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { motion, AnimatePresence } from "framer-motion";
import RewardPoolAdmin from "@/components/games/RewardPoolAdmin";
import GameManager from "@/components/games/GameManager";
import LimitPeriodManager from "@/components/games/LimitPeriodManager";
import RewardPerSecondManager from "@/components/games/RewardPerSecondManager";
import AutomaticRewardPayment from "@/components/games/AutomaticRewardPayment";
import StakingPoolManager from "@/components/admin/StakingPoolManager";
import StakingCreationCostManager from "@/components/admin/StakingCreationCostManager";
import VideoManager from "@/components/admin/VideoManager";
import ScoreConfigManager from "@/components/admin/ScoreConfigManager";
import AdminManager from "@/components/admin/AdminManager";
import ArenaAvatarSync from "@/components/admin/ArenaAvatarSync";
import { PaymentTokensManager } from "@/components/admin/PaymentTokensManager";
import { UserTokenManager } from "@/components/admin/UserTokenManager";
import EconomyManager from "@/components/admin/EconomyManager";
import { RoadmapManager } from "@/components/admin/RoadmapManager";
import VolumeBot from "@/components/admin/VolumeBot";
import AgentOverview from "@/components/admin/AgentOverview";
import AgentCreationCostManager from "@/components/admin/AgentCreationCostManager";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as OTPAuth from "otpauth";

// TOTP Secret - Store this securely
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";

const adminTabs = [
  { id: "reward-pool", label: "Reward Pool", icon: Coins, description: "Manage reward distributions" },
  { id: "payments", label: "Auto Pay", icon: Zap, description: "Automatic payment settings" },
  { id: "games", label: "Games", icon: Gamepad2, description: "Game configurations" },
  { id: "limit", label: "Limits", icon: Clock, description: "Rate & time limits" },
  { id: "score-config", label: "Score", icon: TrendingUp, description: "Scoring system" },
  { id: "staking", label: "Staking", icon: Settings, description: "Staking pools & costs" },
  { id: "videos", label: "Videos", icon: Play, description: "Video content management" },
  { id: "admins", label: "Admins", icon: Users, description: "Admin access control" },
  { id: "avatars", label: "Avatars", icon: Image, description: "Avatar sync tools" },
  { id: "payment-tokens", label: "Tokens", icon: CreditCard, description: "Payment token settings" },
  { id: "economy", label: "Ekonomi", icon: BarChart3, description: "Token ekonomisi ve arz" },
  { id: "roadmap", label: "Roadmap", icon: MapPin, description: "Proje yol haritası" },
  { id: "volume-bot", label: "Volume Bot", icon: Bot, description: "Alım-satım hacim botu" },
  { id: "agent-overview", label: "Agents", icon: Globe, description: "Agent keys & brain overview" },
];

export default function Admin() {
  const navigate = useNavigate();
  const { walletAddress, isConnected, profile } = useWalletAuth();
  const { isTotpVerified, setTotpVerified } = useAdminAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState("");
  const [activeTab, setActiveTab] = useState("reward-pool");

  // Check admin status using the server-side user_roles table
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!profile?.id) {
        setIsAdmin(false);
        setIsCheckingAdmin(false);
        return;
      }

      try {
        const { data: hasAdminRole, error } = await supabase.rpc('has_role', {
          _user_id: profile.id,
          _role: 'admin'
        });

        if (error) {
          console.error('[ADMIN] Error checking admin role:', error);
          setIsAdmin(false);
        } else {
          console.log('[ADMIN] Admin role check result:', hasAdminRole);
          setIsAdmin(hasAdminRole === true);
        }
      } catch (error) {
        console.error('[ADMIN] Failed to check admin status:', error);
        setIsAdmin(false);
      } finally {
        setIsCheckingAdmin(false);
      }
    };

    if (isConnected && profile) {
      checkAdminStatus();
    } else if (!isConnected) {
      setIsAdmin(false);
      setIsCheckingAdmin(false);
    }
  }, [profile?.id, isConnected]);

  // Verify TOTP code
  const verifyTotp = () => {
    if (totpCode.length !== 6) {
      setTotpError("Please enter a 6-digit code");
      return;
    }

    try {
      const totp = new OTPAuth.TOTP({
        issuer: "AvaLove",
        label: "Admin",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: TOTP_SECRET
      });

      const delta = totp.validate({ token: totpCode, window: 1 });
      
      if (delta !== null) {
        setTotpVerified(true);
        setTotpError("");
        toast.success("TOTP verified successfully!");
      } else {
        setTotpError("Invalid code. Please try again.");
        toast.error("Invalid TOTP code");
      }
    } catch (error) {
      console.error("TOTP verification error:", error);
      setTotpError("Verification failed. Please try again.");
    }
  };

  // Handle OTP input complete
  useEffect(() => {
    if (totpCode.length === 6) {
      verifyTotp();
    }
  }, [totpCode]);

  // Redirect to connect if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="max-w-md w-full bg-card/80 backdrop-blur-xl border-border/50 p-8 text-center space-y-6 shadow-2xl">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Shield className="w-10 h-10 text-primary-foreground" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Wallet Required</h2>
              <p className="text-muted-foreground">
                Connect your wallet to access the admin panel.
              </p>
            </div>
            <Button 
              onClick={() => navigate("/connect")}
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
            >
              Connect Wallet
            </Button>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (isCheckingAdmin || isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-4"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center"
          >
            <Shield className="w-8 h-8 text-primary-foreground" />
          </motion.div>
          <p className="text-muted-foreground">Verifying admin access...</p>
        </motion.div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="max-w-md w-full bg-card/80 backdrop-blur-xl border-destructive/30 p-8 text-center space-y-6 shadow-2xl">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-destructive/20 flex items-center justify-center">
              <Shield className="w-10 h-10 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
              <p className="text-muted-foreground">
                Your wallet does not have admin privileges.
              </p>
              {walletAddress && (
                <p className="text-xs text-muted-foreground font-mono break-all bg-muted/50 p-2 rounded-lg">
                  {walletAddress}
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate("/")}>
                Go Home
              </Button>
              <Button onClick={() => navigate("/connect")}>
                Switch Wallet
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Show TOTP verification screen if admin but not TOTP verified
  if (isAdmin && !isTotpVerified) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        {/* Grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative"
        >
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 via-secondary/30 to-primary/30 rounded-3xl blur-xl opacity-50" />
          
          <Card className="relative max-w-md w-full bg-black/90 backdrop-blur-xl border border-primary/30 p-8 text-center space-y-6 shadow-2xl rounded-2xl">
            {/* Scanning line effect */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
              <motion.div
                className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent"
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              />
            </div>
            
            <motion.div 
              className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 flex items-center justify-center relative"
              animate={{ 
                boxShadow: [
                  "0 0 20px hsl(var(--primary)/0.3), inset 0 0 20px hsl(var(--primary)/0.1)", 
                  "0 0 40px hsl(var(--primary)/0.5), inset 0 0 30px hsl(var(--primary)/0.2)", 
                  "0 0 20px hsl(var(--primary)/0.3), inset 0 0 20px hsl(var(--primary)/0.1)"
                ] 
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <KeyRound className="w-12 h-12 text-primary" />
              <motion.div
                className="absolute inset-0 rounded-2xl border-2 border-primary/50"
                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">Security Verification</h2>
              <p className="text-zinc-400 text-sm">
                Enter the 6-digit authentication code
              </p>
            </div>
            
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={totpCode}
                onChange={(value) => {
                  setTotpCode(value);
                  setTotpError("");
                }}
              >
                <InputOTPGroup className="gap-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot 
                      key={i}
                      index={i} 
                      className="w-12 h-14 text-xl bg-black border-primary/30 text-white rounded-xl focus:border-primary focus:ring-primary/30 transition-all" 
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            {totpError && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-sm flex items-center justify-center gap-1"
              >
                <AlertTriangle className="w-4 h-4" />
                {totpError}
              </motion.p>
            )}

            <Button 
              onClick={verifyTotp} 
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-semibold h-12 rounded-xl transition-all hover:shadow-lg hover:shadow-primary/25"
              disabled={totpCode.length !== 6}
            >
              <Lock className="w-4 h-4 mr-2" />
              Authenticate
            </Button>

            <div className="pt-2 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 font-mono">
                {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "reward-pool":
        return <RewardPoolAdmin />;
      case "payments":
        return <AutomaticRewardPayment />;
      case "games":
        return <GameManager />;
      case "limit":
        return (
          <div className="grid gap-6 md:grid-cols-2">
            <LimitPeriodManager />
            <RewardPerSecondManager />
          </div>
        );
      case "score-config":
        return <ScoreConfigManager />;
      case "staking":
        return (
          <div className="space-y-6">
            <StakingPoolManager />
            <StakingCreationCostManager />
          </div>
        );
      case "videos":
        return <VideoManager />;
      case "admins":
        return <AdminManager />;
      case "avatars":
        return <ArenaAvatarSync />;
      case "payment-tokens":
        return (
          <div className="space-y-6">
            <PaymentTokensManager />
            <UserTokenManager />
          </div>
        );
      case "economy":
        return <EconomyManager />;
      case "roadmap":
        return <RoadmapManager />;
      case "volume-bot":
        return <VolumeBot />;
      case "agent-overview":
        return (
          <div className="space-y-6">
            <AgentOverview walletAddress={walletAddress} />
            <AgentCreationCostManager walletAddress={walletAddress} />
          </div>
        );
      default:
        return null;
    }
  };

  const activeTabData = adminTabs.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-black to-secondary/10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-primary/20 to-transparent blur-3xl" />
        
        <div className="container mx-auto px-4 py-8 relative">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="mb-6 text-muted-foreground hover:text-foreground group"
            >
              <ArrowLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
              Back to App
            </Button>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex items-center gap-4 mb-2"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
              <Shield className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
                Admin Panel
              </h1>
              <p className="text-muted-foreground mt-1">Platform management & configuration</p>
            </div>
          </motion.div>
          
          {walletAddress && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full"
            >
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-foreground">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
              <Sparkles className="w-4 h-4 text-primary" />
            </motion.div>
          )}
        </div>
      </div>

      {/* Navigation Tabs - Mobile Responsive Grid */}
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="container mx-auto px-4 py-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:flex xl:flex-wrap gap-2">
            {adminTabs.map((tab, index) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <motion.button
                  key={tab.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    relative flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2 
                    px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl
                    transition-all duration-300 font-medium text-xs sm:text-sm
                    min-h-[60px] sm:min-h-0
                    ${isActive 
                      ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-lg" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50 bg-zinc-900/50"
                    }
                  `}
                >
                  <Icon className="w-4 h-4 sm:w-4 sm:h-4" />
                  <span className="text-center sm:text-left leading-tight">{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary to-secondary -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="container mx-auto px-4 py-8">
        {/* Active Tab Header */}
        {activeTabData && (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <activeTabData.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{activeTabData.label}</h2>
                <p className="text-sm text-muted-foreground">{activeTabData.description}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab Content with Animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
