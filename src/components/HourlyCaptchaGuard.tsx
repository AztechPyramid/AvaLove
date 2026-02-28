import { useState, useEffect, useCallback } from 'react';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import ConnectCaptcha from '@/components/ConnectCaptcha';
import { toast } from 'sonner';

const CAPTCHA_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const CAPTCHA_TIMEOUT_MS = 60 * 1000; // 60 seconds to solve
const STORAGE_KEY = 'hourly_captcha_passed_at';

export default function HourlyCaptchaGuard({ children }: { children: React.ReactNode }) {
  const { isConnected, isArena, disconnectWallet } = useWalletAuth();
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

  const getLastPassed = () => {
    const val = localStorage.getItem(STORAGE_KEY);
    return val ? parseInt(val, 10) : 0;
  };

  const markPassed = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  };

  // Schedule next CAPTCHA check
  const scheduleNext = useCallback(() => {
    const lastPassed = getLastPassed();
    const elapsed = Date.now() - lastPassed;
    const remaining = Math.max(CAPTCHA_INTERVAL_MS - elapsed, 1000);

    const id = setTimeout(() => {
      if (!document.hidden) {
        setShowCaptcha(true);
      } else {
        // If tab is hidden, wait until it's visible
        const handleVisibility = () => {
          if (!document.hidden) {
            document.removeEventListener('visibilitychange', handleVisibility);
            setShowCaptcha(true);
          }
        };
        document.addEventListener('visibilitychange', handleVisibility);
      }
    }, remaining);

    setTimeoutId(id);
    return id;
  }, []);

  useEffect(() => {
    if (!isConnected || !isArena) {
      setShowCaptcha(false);
      return;
    }

    // If no record of passing, show CAPTCHA immediately (don't auto-mark)
    // Connect page sets this key on CAPTCHA pass — if missing, user bypassed it
    if (!getLastPassed()) {
      setShowCaptcha(true);
      return;
    }

    const id = scheduleNext();
    return () => clearTimeout(id);
  }, [isConnected, isArena, scheduleNext]);

  // Timeout: if CAPTCHA is shown but not solved in time, kick user
  useEffect(() => {
    if (!showCaptcha) return;

    const kickTimer = setTimeout(() => {
      console.warn('[HOURLY CAPTCHA] Timeout reached — kicking user');
      toast.error('Verification timeout. You have been disconnected.');
      disconnectWallet();
      setShowCaptcha(false);
      localStorage.removeItem(STORAGE_KEY);
    }, CAPTCHA_TIMEOUT_MS);

    return () => clearTimeout(kickTimer);
  }, [showCaptcha, disconnectWallet]);

  const handlePass = () => {
    markPassed();
    setShowCaptcha(false);
    toast.success('Verified! See you in an hour 👋');
    scheduleNext();
  };

  return (
    <>
      {showCaptcha && <ConnectCaptcha onPass={handlePass} />}
      {children}
    </>
  );
}
