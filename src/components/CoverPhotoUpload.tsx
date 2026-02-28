import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CoverPhotoUploadProps {
  userId: string;
  onUploadComplete: (url: string) => void;
}

export const CoverPhotoUpload = ({ userId, onUploadComplete }: CoverPhotoUploadProps) => {
  const [uploading, setUploading] = useState(false);

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
      const fileName = `cover-${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ cover_photo_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      onUploadComplete(publicUrl);
      toast.success('Cover photo updated successfully');
    } catch (error) {
      console.error('Error uploading cover photo:', error);
      toast.error('Failed to upload cover photo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative">
      <input
        type="file"
        id="cover-upload"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => document.getElementById('cover-upload')?.click()}
        disabled={uploading}
        className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white border-zinc-700 backdrop-blur-sm z-10 pointer-events-auto"
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Camera className="w-4 h-4 mr-2" />
            Change Cover
          </>
        )}
      </Button>
    </div>
  );
};
