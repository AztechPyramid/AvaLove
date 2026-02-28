import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWeb3Auth } from './useWeb3Auth';
import { toast } from 'sonner';

interface VerificationSession {
  sessionId: string;
  nonce: string;
  message: string;
  expiresAt: string;
}

export const useWalletVerification = () => {
  const { walletAddress, isConnected } = useWeb3Auth();
  const [verificationSession, setVerificationSession] = useState<VerificationSession | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Check if wallet is already verified
  useEffect(() => {
    if (walletAddress) {
      checkVerification();
    } else {
      setIsVerified(false);
    }
  }, [walletAddress]);

  const checkVerification = async () => {
    if (!walletAddress) return;

    try {
      const storedSessionId = localStorage.getItem(`wallet_session_${walletAddress.toLowerCase()}`);
      if (!storedSessionId) {
        setIsVerified(false);
        return;
      }

      const { data, error } = await supabase
        .from('wallet_sessions')
        .select('*')
        .eq('id', storedSessionId)
        .eq('verified', true)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (data && !error) {
        setIsVerified(true);
      } else {
        setIsVerified(false);
        localStorage.removeItem(`wallet_session_${walletAddress.toLowerCase()}`);
      }
    } catch (error) {
      console.error('Error checking verification:', error);
      setIsVerified(false);
    }
  };

  const generateNonce = async () => {
    if (!walletAddress) {
      toast.error('Please connect your wallet first');
      return null;
    }

    try {
      const { data, error } = await supabase.functions.invoke('verify-wallet', {
        body: {
          action: 'generateNonce',
          walletAddress,
        },
      });

      if (error) throw error;

      setVerificationSession(data);
      return data;
    } catch (error) {
      console.error('Error generating nonce:', error);
      toast.error('Failed to generate verification nonce');
      return null;
    }
  };

  const verifySignature = async (signature: string, sessionData?: VerificationSession) => {
    const session = sessionData || verificationSession;
    
    if (!session) {
      console.error('No verification session found', { verificationSession, sessionData });
      toast.error('No verification session found');
      return false;
    }

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-wallet', {
        body: {
          action: 'verifySignature',
          sessionId: session.sessionId,
          signature,
        },
      });

      if (error) throw error;

      if (data.success) {
        localStorage.setItem(
          `wallet_session_${walletAddress?.toLowerCase()}`,
          data.sessionId
        );
        setIsVerified(true);
        toast.success('Wallet verified successfully!');
        return true;
      } else {
        toast.error('Signature verification failed');
        return false;
      }
    } catch (error) {
      console.error('Error verifying signature:', error);
      toast.error('Failed to verify signature');
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  const clearVerification = () => {
    if (walletAddress) {
      localStorage.removeItem(`wallet_session_${walletAddress.toLowerCase()}`);
    }
    setIsVerified(false);
    setVerificationSession(null);
  };

  return {
    isVerified,
    isVerifying,
    verificationSession,
    generateNonce,
    verifySignature,
    checkVerification,
    clearVerification,
  };
};
