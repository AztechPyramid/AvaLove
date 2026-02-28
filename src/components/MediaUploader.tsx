import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Image, Video, X, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MediaUploaderProps {
  onMediaSelected: (url: string, type: 'image' | 'video') => void;
  matchId: string;
}

export const MediaUploader = ({ onMediaSelected, matchId }: MediaUploaderProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      return;
    }

    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      toast.error('Unsupported file format');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
  };

  const uploadFile = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      console.log('Media file size:', selectedFile.size, 'type:', selectedFile.type);
      
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${matchId}/${Date.now()}.${fileExt}`;
      
      console.log('Uploading to:', fileName);

      const { data, error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(fileName, selectedFile, {
          contentType: selectedFile.type,
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

      const mediaType = selectedFile.type.startsWith('image/') ? 'image' : 'video';
      onMediaSelected(publicUrl, mediaType);
      
      resetUploader();
      toast.success('Media uploaded');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload media');
    } finally {
      setUploading(false);
    }
  };

  const resetUploader = () => {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (preview) {
    return (
      <div className="flex items-center gap-2 p-3 bg-card rounded-lg border">
        <div className="relative w-16 h-16 rounded overflow-hidden">
          {selectedFile?.type.startsWith('image/') ? (
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <video src={preview} className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 text-sm truncate">
          {selectedFile?.name}
        </div>
        <Button
          size="sm"
          onClick={uploadFile}
          disabled={uploading}
          className="bg-gradient-to-r from-love-primary to-love-secondary"
        >
          <Upload size={16} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={resetUploader}
          disabled={uploading}
        >
          <X size={16} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => fileInputRef.current?.click()}
        className="gap-2 text-white hover:bg-zinc-800 hover:text-white"
      >
        <Image size={18} className="text-orange-500" />
        <span className="text-white">Photo</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => fileInputRef.current?.click()}
        className="gap-2 text-white hover:bg-zinc-800 hover:text-white"
      >
        <Video size={18} className="text-orange-500" />
        <span className="text-white">Video</span>
      </Button>
    </div>
  );
};
