import { createRoot } from "react-dom/client";
import { useState, useEffect, Suspense, lazy } from "react";
import "./index.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { SoundProvider } from "./contexts/SoundContext";
import { WalletAuthProvider } from "./contexts/WalletAuthContext";
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import { OnlineUsersProvider } from "./contexts/OnlineUsersContext";
import { LoadingScreen } from "./components/LoadingScreen";

// Suppress Supabase Realtime WebSocket "origin not allowed" errors
// These occur in preview/iframe environments and are non-critical
window.addEventListener('error', (event) => {
  if (event.message?.includes('WebSocket connection closed abnormally') && event.message?.includes('origin not allowed')) {
    event.preventDefault();
    console.warn('[Realtime] WebSocket origin blocked — realtime features may be limited in this environment');
  }
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message || String(event.reason || '');
  if (reason.includes('WebSocket connection closed abnormally') && reason.includes('origin not allowed')) {
    event.preventDefault();
    console.warn('[Realtime] WebSocket origin blocked — realtime features may be limited in this environment');
  }
});

const App = lazy(() => import("./App.tsx"));

/**
 * AvaLove - Arena SDK Only
 * 100% Arena compatible - No external wallet support
 */

const queryClient = new QueryClient();

const Root = () => {
  const [showLoading, setShowLoading] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    // Minimum 1.5 saniye loading göster
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (minTimeElapsed) {
      // Fade out için küçük bir gecikme
      const hideTimer = setTimeout(() => {
        setShowLoading(false);
      }, 300);
      return () => clearTimeout(hideTimer);
    }
  }, [minTimeElapsed]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SoundProvider>
            <WalletAuthProvider>
              <OnlineUsersProvider>
                <AdminAuthProvider>
                  {showLoading && <LoadingScreen />}
                  <Suspense fallback={<LoadingScreen />}>
                    <App />
                  </Suspense>
                </AdminAuthProvider>
              </OnlineUsersProvider>
            </WalletAuthProvider>
          </SoundProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

createRoot(document.getElementById("root")!).render(<Root />);
