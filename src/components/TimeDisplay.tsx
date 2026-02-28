import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TimePopup } from '@/components/TimePopup';

export const TimeDisplay = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 py-1 hover:bg-zinc-800 flex items-center justify-center"
        onClick={() => setShowPopup(true)}
      >
        <Clock className="w-4 h-4 text-cyan-500" />
      </Button>

      <TimePopup 
        open={showPopup} 
        onOpenChange={setShowPopup} 
      />
    </>
  );
};
