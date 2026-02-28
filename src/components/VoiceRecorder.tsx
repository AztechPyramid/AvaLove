import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Send, X } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VoiceRecorderProps {
  onVoiceMessageSent: (url: string) => void;
  matchId: string;
}

export const VoiceRecorder = ({ onVoiceMessageSent, matchId }: VoiceRecorderProps) => {
  const { isRecording, audioBlob, startRecording, stopRecording, resetRecording } = useAudioRecorder();
  const [uploading, setUploading] = useState(false);

  const handleStartRecording = async () => {
    try {
      await startRecording();
    } catch (error) {
      toast.error('Microphone access denied');
    }
  };

  const handleSendVoice = async () => {
    if (!audioBlob) return;

    setUploading(true);
    try {
      console.log('Voice blob size:', audioBlob.size, 'type:', audioBlob.type);
      
      const fileName = `${matchId}/${Date.now()}.webm`;
      
      console.log('Uploading to:', fileName);
      
      const { data, error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw uploadError;
      }

      console.log('Upload success:', data);

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(fileName);

      console.log('Public URL:', publicUrl);

      onVoiceMessageSent(publicUrl);
      resetRecording();
      toast.success('Voice message sent');
    } catch (error) {
      console.error('Voice upload error:', error);
      toast.error('Failed to send voice message');
    } finally {
      setUploading(false);
    }
  };

  if (audioBlob) {
    return (
      <div className="flex items-center gap-2 p-3 bg-card rounded-lg border">
        <audio src={URL.createObjectURL(audioBlob)} controls className="flex-1 h-10" />
        <Button
          size="sm"
          onClick={handleSendVoice}
          disabled={uploading}
          className="bg-gradient-to-r from-love-primary to-love-secondary"
        >
          <Send size={16} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={resetRecording}
          disabled={uploading}
        >
          <X size={16} />
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant={isRecording ? "destructive" : "ghost"}
      onClick={isRecording ? stopRecording : handleStartRecording}
      className={`gap-2 ${!isRecording ? 'text-white hover:bg-zinc-800 hover:text-white' : ''}`}
    >
      {isRecording ? (
        <>
          <Square size={18} className="animate-pulse" />
          <span className="text-white">Stop</span>
        </>
      ) : (
        <>
          <Mic size={18} className="text-orange-500" />
          <span className="text-white">Voice</span>
        </>
      )}
    </Button>
  );
};
