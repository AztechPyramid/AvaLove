import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

interface SoundContextType {
  soundEnabled: boolean;
  toggleSound: () => void;
  getAudioContext: () => AudioContext | null;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('soundEnabled');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    // Suspend audio context when sound is disabled
    if (!soundEnabled && audioContextRef.current) {
      audioContextRef.current.suspend();
    } else if (soundEnabled && audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, [soundEnabled]);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const newValue = !prev;
      localStorage.setItem('soundEnabled', String(newValue));
      return newValue;
    });
  }, []);

  const getAudioContext = useCallback(() => {
    if (!soundEnabled) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, [soundEnabled]);

  // Resume audio context on user interaction
  useEffect(() => {
    const resumeContext = () => {
      if (audioContextRef.current?.state === 'suspended' && soundEnabled) {
        audioContextRef.current.resume();
      }
    };
    document.addEventListener('click', resumeContext, { once: true });
    return () => document.removeEventListener('click', resumeContext);
  }, [soundEnabled]);

  return (
    <SoundContext.Provider value={{ soundEnabled, toggleSound, getAudioContext }}>
      {children}
    </SoundContext.Provider>
  );
};

export const useSoundContext = () => {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSoundContext must be used within a SoundProvider');
  }
  return context;
};
