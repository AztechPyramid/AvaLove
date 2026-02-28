import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

interface AgentBannerUploadProps {
  agentId: string;
  currentBannerUrl: string | null;
  onBannerChange: (url: string) => void;
  isEditing: boolean;
}

export const AgentBannerUpload = ({ 
  agentId, 
  currentBannerUrl, 
  onBannerChange,
  isEditing 
}: AgentBannerUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState(currentBannerUrl || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setUploading(true);

    try {
      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `agent-banner-${agentId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setUrlInput(publicUrl);
      onBannerChange(publicUrl);
      toast.success('Banner uploaded successfully');
    } catch (error) {
      console.error('Error uploading banner:', error);
      toast.error('Failed to upload banner');
    } finally {
      setUploading(false);
    }
  };

  const handleUrlChange = (url: string) => {
    setUrlInput(url);
    onBannerChange(url);
  };

  if (!isEditing) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ImageIcon className="w-4 h-4 text-zinc-400" />
        <span className="text-sm font-medium text-white">Cover Photo URL</span>
      </div>
      
      <div className="flex gap-2">
        <Input
          value={urlInput}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://example.com/banner.png"
          className="bg-zinc-800/50 border-zinc-700 text-white flex-1"
        />
        
        <input
          ref={fileInputRef}
          type="file"
          id={`banner-upload-${agentId}`}
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
        
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white shrink-0"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
        </Button>
      </div>
      
      <p className="text-xs text-zinc-500">
        Recommended size: 1500x500px. Enter URL or upload an image.
      </p>

      {urlInput && (
        <div className="relative rounded-lg overflow-hidden border border-zinc-700">
          <div className="aspect-[3/1] bg-zinc-800">
            <img 
              src={urlInput} 
              alt="Banner preview" 
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <span className="absolute bottom-2 right-2 text-xs bg-black/70 text-zinc-300 px-2 py-1 rounded">
            Preview
          </span>
        </div>
      )}
    </div>
  );
};
