import { useCallback } from 'react';
import { useSoundContext } from '@/contexts/SoundContext';

export const useSoundEffects = () => {
  const { soundEnabled, toggleSound, getAudioContext } = useSoundContext();

  const playTipSound = useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const oscillator2 = audioContext.createOscillator();
    const gainNode2 = audioContext.createGain();

    oscillator.connect(gainNode);
    oscillator2.connect(gainNode2);
    gainNode.connect(audioContext.destination);
    gainNode2.connect(audioContext.destination);

    // Magical ascending chimes for tips
    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
    oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
    oscillator2.frequency.setValueAtTime(1046.5, audioContext.currentTime + 0.15); // C6

    oscillator.type = 'sine';
    oscillator2.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    gainNode2.gain.setValueAtTime(0.15, audioContext.currentTime + 0.15);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    oscillator2.start(audioContext.currentTime + 0.15);
    oscillator2.stop(audioContext.currentTime + 0.5);
  }, [getAudioContext]);

  const playBurnSound = useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Explosive fire sound
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.3);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.3);
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  }, [getAudioContext]);

  const playNotificationSound = useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Soft pleasant bell notification
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
    oscillator.frequency.setValueAtTime(1108.73, audioContext.currentTime + 0.08); // C#6

    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.25);
  }, [getAudioContext]);

  const playClickSound = useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Short pop click
    oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.05);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.08);
  }, [getAudioContext]);

  const playSwipeSound = useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Swoosh sound
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.2);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.2);
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  }, [getAudioContext]);

  const playNavigationSound = useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const oscillator2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const gainNode2 = audioContext.createGain();

    oscillator.connect(gainNode);
    oscillator2.connect(gainNode2);
    gainNode.connect(audioContext.destination);
    gainNode2.connect(audioContext.destination);

    // Chord transition sound
    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
    oscillator2.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5
    
    oscillator.type = 'sine';
    oscillator2.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    gainNode2.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
    oscillator2.start(audioContext.currentTime);
    oscillator2.stop(audioContext.currentTime + 0.2);
  }, [getAudioContext]);

  const playLikeSound = useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const oscillator2 = audioContext.createOscillator();
    const gainNode2 = audioContext.createGain();

    oscillator.connect(gainNode);
    oscillator2.connect(gainNode2);
    gainNode.connect(audioContext.destination);
    gainNode2.connect(audioContext.destination);

    // Sweet loving sound
    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5
    oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.08); // G5
    oscillator.frequency.setValueAtTime(1046.5, audioContext.currentTime + 0.16); // C6
    oscillator2.frequency.setValueAtTime(523.25, audioContext.currentTime + 0.08); // C5

    oscillator.type = 'sine';
    oscillator2.type = 'triangle';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    gainNode2.gain.setValueAtTime(0.15, audioContext.currentTime + 0.08);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
    oscillator2.start(audioContext.currentTime + 0.08);
    oscillator2.stop(audioContext.currentTime + 0.4);
  }, [getAudioContext]);

  const playPassSound = useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Descending rejection sound
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
    oscillator.frequency.exponentialRampToValueAtTime(220, audioContext.currentTime + 0.15); // A3
    
    oscillator.type = 'triangle';
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  }, [getAudioContext]);

  const playMatchSound = useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    
    // Create multiple oscillators for a rich match sound
    const frequencies = [523.25, 659.25, 783.99, 1046.5]; // C, E, G, C chord
    
    frequencies.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      osc.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.05);
      osc.type = 'sine';
      
      gain.gain.setValueAtTime(0.25, audioContext.currentTime + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
      
      osc.start(audioContext.currentTime + i * 0.05);
      osc.stop(audioContext.currentTime + 0.8);
    });
  }, [getAudioContext]);

  return {
    playTipSound,
    playBurnSound,
    playNotificationSound,
    playClickSound,
    playSwipeSound,
    playNavigationSound,
    playLikeSound,
    playPassSound,
    playMatchSound,
    soundEnabled,
    toggleSound,
  };
};
