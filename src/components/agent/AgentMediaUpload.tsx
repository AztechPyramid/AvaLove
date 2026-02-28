import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Loader2, Upload, User, ImageIcon, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { GifPicker } from '@/components/GifPicker';

interface AgentMediaUploadProps {
  agentId: string;
  type: 'avatar' | 'banner';
  currentUrl: string;
  onChange: (url: string) => void;
  agentName?: string;
}

export const AgentMediaUpload = ({ 
  agentId, 
  type,
  currentUrl, 
  onChange,
  agentName = 'A'
}: AgentMediaUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type - support common image formats
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Supported formats: JPG, PNG, GIF, WebP, AVIF, SVG');
      return;
    }

    // Validate file size (max 5MB for avatar, 10MB for banner)
    const maxSize = type === 'banner' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File size must be less than ${type === 'banner' ? '10MB' : '5MB'}`);
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `agent-${type}-${agentId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { 
          upsert: true,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      onChange(publicUrl);
      toast.success(`${type === 'banner' ? 'Cover photo' : 'Profile picture'} uploaded!`);
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      toast.error(`Failed to upload ${type === 'banner' ? 'cover photo' : 'profile picture'}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (type === 'avatar') {
    return (
      <div className="space-y-3">
        <Label className="text-white flex items-center gap-2">
          <User className="w-4 h-4 text-cyan-400" />
          Profile Picture
        </Label>
        
        <div className="flex items-start gap-4">
          {/* Avatar Preview */}
          <div className="relative group">
            <Avatar className="w-20 h-20 border-2 border-cyan-500/30">
              {currentUrl ? (
                <AvatarImage src={currentUrl} />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-2xl">
                {agentName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif,image/svg+xml"
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
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-cyan-400"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* URL Input + GIF Button */}
          <div className="flex-1 space-y-2">
            <Input
              value={currentUrl}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://pbs.twimg.com/profile_images/..."
              className="bg-zinc-800/50 border-zinc-700 text-white text-sm"
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowGifPicker(!showGifPicker)}
                className="border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 text-cyan-400 text-xs gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Search GIF
              </Button>
              <p className="text-xs text-zinc-500">
                Paste URL, upload, or pick a GIF
              </p>
            </div>
          </div>
        </div>

        {showGifPicker && (
          <GifPicker
            onGifSelected={(gifUrl) => {
              onChange(gifUrl);
              setShowGifPicker(false);
            }}
            onClose={() => setShowGifPicker(false)}
          />
        )}
      </div>
    );
  }

  // Banner type - file upload only
  return (
    <div className="space-y-3">
      <Label className="text-white flex items-center gap-2">
        <ImageIcon className="w-4 h-4 text-cyan-400" />
        Cover Photo
      </Label>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />
      
      {/* Upload Area */}
      <div 
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`
          relative rounded-lg border-2 border-dashed cursor-pointer transition-all
          ${currentUrl 
            ? 'border-cyan-500/30 hover:border-cyan-500/50' 
            : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/30'
          }
        `}
      >
        {currentUrl ? (
          <div className="relative aspect-[3/1] bg-zinc-800 rounded-lg overflow-hidden">
            <img 
              src={currentUrl} 
              alt="Banner preview" 
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              {uploading ? (
                <div className="flex items-center gap-2 text-white">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Uploading...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-white">
                  <Camera className="w-5 h-5" />
                  <span>Change Photo</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="aspect-[3/1] flex flex-col items-center justify-center gap-2 text-zinc-400">
            {uploading ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                <span className="text-sm">Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8" />
                <span className="text-sm">Click to upload banner</span>
                <span className="text-xs text-zinc-500">Recommended: 1500x500px</span>
              </>
            )}
          </div>
        )}
      </div>
      
      <p className="text-xs text-zinc-500">
        Supported: JPG, PNG, GIF, WebP, AVIF (max 10MB)
      </p>
    </div>
  );
};
