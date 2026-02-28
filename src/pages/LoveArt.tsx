import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PixelCanvas } from '@/components/loveart/PixelCanvas';
import { useWalletAuth } from '@/contexts/WalletAuthContext';

const LoveArt = () => {
  const navigate = useNavigate();
  const { profile, isConnected } = useWalletAuth();

  useEffect(() => {
    if (!isConnected || !profile) {
      navigate('/connect');
    }
  }, [isConnected, profile, navigate]);

  // Prevent body scroll when on this page
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!isConnected || !profile) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black text-white z-50"
      onContextMenu={(e) => e.preventDefault()}
      style={{ top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <PixelCanvas />
    </div>
  );
};

export default LoveArt;
