import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Upload, X, Camera, ImagePlus, Calendar as CalendarIcon, Check, AlertCircle, MapPin, Award } from 'lucide-react';
import { LocationSearch } from '@/components/LocationSearch';

import { isArenaApp } from '@/lib/arenaDetector';
import { useMilestones } from '@/hooks/useMilestones';

const MAX_PHOTOS = 5;

interface PhotoFile {
  file: File;
  preview: string;
}

export default function ProfileSetup() {
  const { walletAddress, profile, loading: authLoading, refreshProfile, isArena } = useWalletAuth();
  const navigate = useNavigate();
  const { checkProfileCompletion } = useMilestones();
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [coverPhotoFile, setCoverPhotoFile] = useState<File | null>(null);
  const [coverPhotoPreview, setCoverPhotoPreview] = useState<string>('');
  const [photoFiles, setPhotoFiles] = useState<PhotoFile[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameCheckTimeout, setUsernameCheckTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    bio: '',
    gender: '',
    looking_for: [] as string[],
    location: '',
    latitude: null as number | null,
    longitude: null as number | null,
    interests: '',
    date_of_birth: '',
    twitter_username: '',
    instagram_username: '',
    linkedin_username: '',
    arena_username: '',
    min_age_preference: 21,
    max_age_preference: 45,
    max_distance_km: 50,
  });

  useEffect(() => {
    if (!authLoading) {
      if (!walletAddress) {
        navigate('/connect');
      } else if (profile) {
        // Profil zaten varsa, kurulum sayfasında düzenleme moduna geç
        setIsEditMode(true);
        loadProfileData();
      }
    }
  }, [authLoading, walletAddress, profile, navigate]);

  const loadProfileData = () => {
    if (!profile) return;
    
    // For Arena users, use arena_username as the primary username
    const arenaUsername = (profile as any).arena_username || '';
    const effectiveUsername = isArena && arenaUsername ? arenaUsername : profile.username || '';
    
    setFormData({
      username: effectiveUsername,
      display_name: profile.display_name || '',
      bio: profile.bio || '',
      gender: profile.gender || '',
      looking_for: profile.looking_for || [],
      location: profile.location || '',
      latitude: profile.latitude || null,
      longitude: profile.longitude || null,
      interests: profile.interests?.join(', ') || '',
      date_of_birth: profile.date_of_birth || '',
      twitter_username: (profile as any).twitter_username || '',
      instagram_username: (profile as any).instagram_username || '',
      linkedin_username: (profile as any).linkedin_username || '',
      arena_username: arenaUsername,
      min_age_preference: (profile as any).min_age_preference || 21,
      max_age_preference: (profile as any).max_age_preference || 45,
      max_distance_km: (profile as any).max_distance_km || 50,
    });
    
    if (profile.avatar_url) {
      setAvatarPreview(profile.avatar_url);
    }
    
    if ((profile as any).cover_photo_url) {
      setCoverPhotoPreview((profile as any).cover_photo_url);
    }
    
    // In edit mode, username is already valid (especially for Arena users)
    setUsernameStatus('available');
  };

  const handleLocationSelect = async (location: string, latitude: number, longitude: number) => {
    setFormData(prev => ({
      ...prev,
      location,
      latitude,
      longitude,
    }));
  };

  const checkUsernameAvailability = useCallback(async (username: string) => {
    // Clear existing timeout
    if (usernameCheckTimeout) {
      clearTimeout(usernameCheckTimeout);
    }

    // Basic validation
    if (!username || username.length < 3) {
      setUsernameStatus('invalid');
      return;
    }

    // Username format validation (alphanumeric and underscore only)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');

    // Debounce the API call
    const timeout = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Username check error:', error);
          setUsernameStatus('idle');
          return;
        }

        // If in edit mode and the username belongs to current user, it's available
        if (data && isEditMode && data.id === profile?.id) {
          setUsernameStatus('available');
        } else if (data) {
          setUsernameStatus('taken');
        } else {
          setUsernameStatus('available');
        }
      } catch (error) {
        console.error('Username availability check failed:', error);
        setUsernameStatus('idle');
      }
    }, 500); // 500ms debounce

    setUsernameCheckTimeout(timeout);
  }, [usernameCheckTimeout, isEditMode, profile]);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Arena users cannot change their username
    if (isArena && formData.arena_username) return;
    
    const newUsername = e.target.value;
    setFormData({ ...formData, username: newUsername });
    checkUsernameAvailability(newUsername);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (usernameCheckTimeout) {
        clearTimeout(usernameCheckTimeout);
      }
    };
  }, [usernameCheckTimeout]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith('video/');
      const maxSize = isVideo ? 8 * 1024 * 1024 : 3 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error(isVideo ? 'Video size must be less than 8MB' : 'File size must be less than 3MB');
        return;
      }
 
      // Validate video duration (max 5 seconds)
      if (isVideo) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        
        video.onloadedmetadata = () => {
          window.URL.revokeObjectURL(video.src);
          if (video.duration > 5) {
            toast.error('Video must be 5 seconds or less');
            return;
          }
          
          setAvatarFile(file);
          const reader = new FileReader();
          reader.onloadend = () => {
            setAvatarPreview(reader.result as string);
          };
          reader.readAsDataURL(file);
        };
        
        video.src = URL.createObjectURL(file);
      } else {
        setAvatarFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setAvatarPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handlePhotosChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (photoFiles.length + files.length > MAX_PHOTOS) {
      toast.error(`You can only upload up to ${MAX_PHOTOS} additional photos`);
      return;
    }

    const newPhotoFiles: PhotoFile[] = [];
    let processedCount = 0;
    
    for (const file of files) {
      if (file.size > 3 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Max size is 3MB`);
        processedCount++;
        continue;
      }
      
      // Validate video duration (max 5 seconds)
      if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        
        video.onloadedmetadata = () => {
          window.URL.revokeObjectURL(video.src);
          if (video.duration > 5) {
            toast.error(`${file.name} must be 5 seconds or less`);
            processedCount++;
            if (processedCount === files.length && newPhotoFiles.length > 0) {
              setPhotoFiles(prev => [...prev, ...newPhotoFiles]);
            }
            return;
          }
          
          const reader = new FileReader();
          reader.onloadend = () => {
            newPhotoFiles.push({
              file,
              preview: reader.result as string
            });
            processedCount++;
            
            if (processedCount === files.length) {
              setPhotoFiles(prev => [...prev, ...newPhotoFiles]);
            }
          };
          reader.readAsDataURL(file);
        };
        
        video.src = URL.createObjectURL(file);
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPhotoFiles.push({
            file,
            preview: reader.result as string
          });
          processedCount++;
          
          if (processedCount === files.length) {
            setPhotoFiles(prev => [...prev, ...newPhotoFiles]);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removePhoto = (index: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCoverPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        toast.error('File size must be less than 3MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }

      setCoverPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!avatarFile) return null;

    try {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Failed to upload avatar');
      return null;
    }
  };

  const uploadCoverPhoto = async (userId: string): Promise<string | null> => {
    if (!coverPhotoFile) return null;

    try {
      const fileExt = coverPhotoFile.name.split('.').pop();
      const fileName = `cover-${userId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, coverPhotoFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Cover photo upload error:', error);
      toast.error('Failed to upload cover photo');
      return null;
    }
  };

  const uploadPhotos = async (userId: string): Promise<string[]> => {
    if (photoFiles.length === 0) return [];

    const uploadedUrls: string[] = [];

    for (const photoFile of photoFiles) {
      try {
        const fileExt = photoFile.file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(fileName, photoFile.file, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      } catch (error) {
        console.error('Photo upload error:', error);
        toast.error(`Failed to upload photo: ${photoFile.file.name}`);
      }
    }

    return uploadedUrls;
  };

  const handleSkip = async () => {
    if (!walletAddress) return;

    setLoading(true);
    try {
      const profileId = crypto.randomUUID();
      const defaultUsername = `user_${walletAddress.slice(2, 8)}`;

      const { error } = await supabase
        .from('profiles')
        .insert({
          id: profileId,
          username: defaultUsername,
          wallet_address: walletAddress.toLowerCase(),
        });

      if (error) throw error;

      toast.success('Profile created! You can complete it later.');
      await refreshProfile();
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) return;

    // Prevent submission if username is not available
    if (usernameStatus !== 'available') {
      toast.error('Please choose a valid and available username');
      return;
    }

    setLoading(true);

    try {
      // Check if username is already taken to avoid duplicate key errors
      const { data: existingProfile, error: usernameCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', formData.username)
        .maybeSingle();

      if (usernameCheckError && usernameCheckError.code !== 'PGRST116') {
        console.error('Username check error:', usernameCheckError);
        toast.error('Error checking username, please try again.');
        setLoading(false);
        return;
      }

      if (existingProfile && (!isEditMode || existingProfile.id !== profile?.id)) {
        toast.error('This username is already taken, please choose another one.');
        setLoading(false);
        return;
      }

      const profileId = isEditMode ? profile?.id : crypto.randomUUID();
      if (!profileId) throw new Error('Profile ID not found');
      
      // Upload avatar if selected
      let avatarUrl = isEditMode ? profile?.avatar_url : null;
      if (avatarFile) {
        avatarUrl = await uploadAvatar(profileId);
      }

      // Upload cover photo if selected
      let coverPhotoUrl = isEditMode ? (profile as any)?.cover_photo_url : null;
      if (coverPhotoFile) {
        coverPhotoUrl = await uploadCoverPhoto(profileId);
      }

      // Upload additional photos
      const photoUrls = await uploadPhotos(profileId);
      if (photoUrls.length > 0) {
        toast.success(`${photoUrls.length} photo(s) uploaded successfully!`);
      }

      const profileData: any = {
        // For Arena users, use arena_username as the system username
        username: isArena && formData.arena_username ? formData.arena_username : formData.username,
        wallet_address: walletAddress.toLowerCase(),
      };

      // Add optional fields only if provided
      if (formData.display_name) profileData.display_name = formData.display_name;
      if (formData.bio) profileData.bio = formData.bio;
      if (formData.gender) profileData.gender = formData.gender;
      profileData.looking_for = formData.looking_for;
      if (formData.location) {
        profileData.location = formData.location;
        if (formData.latitude) profileData.latitude = formData.latitude;
        if (formData.longitude) profileData.longitude = formData.longitude;
      }
      if (formData.date_of_birth) profileData.date_of_birth = formData.date_of_birth;
      if (formData.interests) profileData.interests = formData.interests.split(',').map(i => i.trim()).filter(i => i);
      if (avatarUrl) profileData.avatar_url = avatarUrl;
      if (coverPhotoUrl) profileData.cover_photo_url = coverPhotoUrl;
      if (formData.twitter_username) profileData.twitter_username = formData.twitter_username;
      if (formData.instagram_username) profileData.instagram_username = formData.instagram_username;
      if (formData.linkedin_username) profileData.linkedin_username = formData.linkedin_username;
      if (formData.arena_username) profileData.arena_username = formData.arena_username;
      profileData.min_age_preference = formData.min_age_preference;
      profileData.max_age_preference = formData.max_age_preference;
      profileData.max_distance_km = formData.max_distance_km;
      
      // Handle photo URLs - preserve existing photos in edit mode
      if (isEditMode) {
        const existingPhotoUrls = profile?.photo_urls || [];
        if (photoUrls.length > 0) {
          // Merge new photos with existing ones
          profileData.photo_urls = [...existingPhotoUrls, ...photoUrls];
        } else {
          // Keep existing photos if no new photos were added
          profileData.photo_urls = existingPhotoUrls;
        }
      } else {
        // New profile - only set if there are photos
        if (photoUrls.length > 0) {
          profileData.photo_urls = photoUrls;
        }
      }

      if (isEditMode) {
        const { error } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', profileId);

        if (error) throw error;
        toast.success('Profile updated successfully!');
      } else {
        profileData.id = profileId;
        const { error } = await supabase
          .from('profiles')
          .insert(profileData);

        if (error) throw error;
        toast.success('Profile created successfully!');
      }

      await refreshProfile();
      
      // Check profile completion milestone
      await checkProfileCompletion();
      
      // Wait for profile to be loaded before navigating
      let attempts = 0;
      const checkProfile = setInterval(() => {
        attempts++;
        if (profile || attempts > 10) {
          clearInterval(checkProfile);
          navigate('/');
        }
      }, 200);
    } catch (error: any) {
      toast.error(error.message || `Failed to ${isEditMode ? 'update' : 'create'} profile`);
      console.error('Profile operation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLookingForChange = (gender: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      looking_for: checked
        ? [...prev.looking_for, gender]
        : prev.looking_for.filter(g => g !== gender)
    }));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-orange-500" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-6 px-4">
      <div className="max-w-3xl mx-auto pt-4">
        <Card className="p-6 shadow-2xl bg-black border-orange-500/30">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2 text-white">
              {isEditMode ? 'Edit Your Profile' : 'Set Up Your Profile'}
            </h1>
            <p className="text-zinc-400 mb-2 text-sm">
              {isEditMode ? 'Update your profile information' : 'Complete your profile to start matching'}
            </p>
            <p className="text-xs text-zinc-500">
              Wallet: {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Photos Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Camera className="text-orange-500" size={18} />
                <h2 className="text-lg font-semibold text-white">Profile Photos</h2>
              </div>

              {/* Cover Photo Upload */}
              <div className="space-y-2">
                <Label className="text-sm text-white">Cover Photo (Banner)</Label>
                <div className="relative h-32 sm:h-40 rounded-lg overflow-hidden bg-zinc-800 border-2 border-zinc-700">
                  {coverPhotoPreview ? (
                    <img src={coverPhotoPreview} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500">
                      <div className="text-center">
                        <Camera size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs">Add a cover photo</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Upload Button - Top Right Corner */}
                  <div className="absolute top-3 right-3 flex gap-2 z-10">
                    <Label htmlFor="cover-upload" className="cursor-pointer">
                      <div className="flex items-center gap-2 px-3 py-2 bg-black/60 backdrop-blur-sm text-white rounded-lg hover:bg-black/80 transition-all shadow-lg border border-zinc-700">
                        <Camera size={16} />
                        <span className="text-sm font-medium hidden sm:inline">
                          {coverPhotoPreview ? 'Change' : 'Upload'}
                        </span>
                      </div>
                      <input
                        id="cover-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleCoverPhotoChange}
                        className="hidden"
                      />
                    </Label>
                    
                    {coverPhotoPreview && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="bg-black/60 backdrop-blur-sm border-zinc-700 text-white hover:bg-black/80 h-auto py-2"
                        onClick={() => {
                          setCoverPhotoFile(null);
                          setCoverPhotoPreview('');
                        }}
                      >
                        <X size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Avatar Upload */}
              <div className="flex flex-col items-center space-y-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                <Label className="text-xs text-zinc-400">Main Profile Picture (Photo, GIF, or 5s Video - Max 8MB)</Label>
                <div className="w-28 h-28 border-4 border-orange-500/20 rounded-full overflow-hidden">
                  {avatarPreview ? (
                    avatarFile?.type.startsWith('video/') ? (
                      <video 
                        src={avatarPreview} 
                        autoPlay 
                        loop 
                        muted 
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-br from-orange-500 to-yellow-500 text-white">
                      {formData.username ? formData.username[0].toUpperCase() : '?'}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Label htmlFor="avatar-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 transition-all hover:shadow-lg">
                      <Upload size={14} />
                      <span className="text-sm font-medium">Upload Media</span>
                    </div>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*,image/gif,video/mp4,video/webm"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </Label>
                  
                  {avatarPreview && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
                      onClick={() => {
                        setAvatarFile(null);
                        setAvatarPreview('');
                      }}
                    >
                      <X size={14} />
                    </Button>
                  )}
                </div>
              </div>

              {/* Additional Photos */}
              <div className="space-y-2">
                <Label className="text-sm text-white">Additional Media (up to {MAX_PHOTOS} - Photos, GIFs, or 5s Videos - Max 8MB)</Label>
                <div className="grid grid-cols-3 gap-2">
                  {photoFiles.map((photo, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden group border border-zinc-700">
                      {photo.file.type.startsWith('video/') ? (
                        <video 
                          src={photo.preview} 
                          autoPlay 
                          loop 
                          muted 
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img src={photo.preview} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                        onClick={() => removePhoto(index)}
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  ))}
                  
                  {photoFiles.length < MAX_PHOTOS && (
                    <Label htmlFor="photos-upload" className="cursor-pointer">
                      <div className="aspect-square border-2 border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center hover:border-orange-500/50 hover:bg-zinc-800/30 transition-all">
                        <ImagePlus className="text-zinc-400 mb-1" size={20} />
                        <span className="text-xs text-zinc-400">Add Media</span>
                      </div>
                      <input
                        id="photos-upload"
                        type="file"
                        accept="image/*,image/gif,video/mp4,video/webm"
                        multiple
                        onChange={handlePhotosChange}
                        className="hidden"
                      />
                    </Label>
                  )}
                </div>
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Basic Information */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-white">Basic Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-white flex items-center gap-2">
                    Username <span className="text-orange-500">*</span>
                    {isArena && formData.arena_username && (
                      <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                        Arena Username
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="username"
                      value={isArena && formData.arena_username ? `@${formData.arena_username}` : formData.username}
                      onChange={handleUsernameChange}
                      placeholder="cool_username"
                      required
                      minLength={3}
                      maxLength={20}
                      pattern="^[a-zA-Z0-9_]{3,20}$"
                      readOnly={isArena && !!formData.arena_username}
                      className={`bg-zinc-800 border-zinc-700 text-white pr-10 ${
                        isArena && formData.arena_username ? 'cursor-not-allowed opacity-75' :
                        usernameStatus === 'available' ? 'border-green-500' :
                        usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-red-500' :
                        ''
                      }`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isArena && formData.arena_username ? (
                        <Check className="text-orange-500" size={14} />
                      ) : usernameStatus === 'checking' ? (
                        <Loader2 className="animate-spin text-zinc-400" size={14} />
                      ) : usernameStatus === 'available' ? (
                        <Check className="text-green-500" size={14} />
                      ) : (usernameStatus === 'taken' || usernameStatus === 'invalid') ? (
                        <AlertCircle className="text-red-500" size={14} />
                      ) : null}
                    </div>
                  </div>
                  {isArena && formData.arena_username && (
                    <p className="text-xs text-orange-400 flex items-center gap-1">
                      <Award size={10} />
                      Your Arena username is automatically synced
                    </p>
                  )}
                  {!isArena && usernameStatus === 'available' && formData.username.length >= 3 && (
                    <p className="text-xs text-green-500 flex items-center gap-1">
                      <Check size={10} />
                      Username is available
                    </p>
                  )}
                  {!isArena && usernameStatus === 'taken' && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle size={10} />
                      Username is already taken
                    </p>
                  )}
                  {!isArena && usernameStatus === 'invalid' && formData.username.length > 0 && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle size={10} />
                      3-20 characters, letters, numbers and underscore only
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display_name" className="text-white">Display Name</Label>
                  <Input
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="Your Name"
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio" className="text-white">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Tell us about yourself..."
                  rows={3}
                  className="resize-none bg-zinc-800 border-zinc-700 text-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-white">Location</Label>
                  <LocationSearch
                    value={formData.location || ''}
                    onLocationSelect={handleLocationSelect}
                    disabled={isSavingLocation}
                  />
                  <p className="text-xs text-zinc-400">
                    Search for your location: Country, City, District
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date_of_birth" className="flex items-center gap-2 text-white">
                    <CalendarIcon size={14} />
                    Date of Birth
                  </Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Dating Preferences */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-white">Dating Preferences</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="gender" className="text-white">My Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => setFormData({ ...formData, gender: value })}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue placeholder="Select your gender" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="non_binary">Non-Binary</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Interested In</Label>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {['male', 'female', 'non_binary', 'other'].map((gender) => (
                      <div key={gender} className="flex items-center space-x-2">
                        <Checkbox
                          id={`looking-${gender}`}
                          checked={formData.looking_for.includes(gender)}
                          onCheckedChange={(checked) => handleLookingForChange(gender, checked as boolean)}
                          className="border-zinc-700"
                        />
                        <Label htmlFor={`looking-${gender}`} className="cursor-pointer capitalize text-sm text-white">
                          {gender.replace('_', ' ')}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Age and Distance Preferences */}
              <div className="space-y-2 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                <Label className="text-sm font-semibold text-white">Search Preferences</Label>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="min_age" className="text-white text-xs">Min Age</Label>
                    <Input
                      id="min_age"
                      type="number"
                      min="18"
                      max="100"
                      value={formData.min_age_preference}
                      onChange={(e) => setFormData({ ...formData, min_age_preference: parseInt(e.target.value) || 21 })}
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_age" className="text-white text-xs">Max Age</Label>
                    <Input
                      id="max_age"
                      type="number"
                      min="18"
                      max="100"
                      value={formData.max_age_preference}
                      onChange={(e) => setFormData({ ...formData, max_age_preference: parseInt(e.target.value) || 45 })}
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_distance" className="text-white text-xs">Max Distance (km)</Label>
                    <Input
                      id="max_distance"
                      type="number"
                      min="1"
                      max="500"
                      value={formData.max_distance_km}
                      onChange={(e) => setFormData({ ...formData, max_distance_km: parseInt(e.target.value) || 50 })}
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                </div>
                
                <p className="text-xs text-zinc-400">
                  Set your preferred age range and maximum distance for potential matches
                </p>
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Interests */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-white">Interests & Hobbies</h2>
              <div className="space-y-2">
                <Label htmlFor="interests" className="text-white">Interests (comma-separated)</Label>
                <Input
                  id="interests"
                  value={formData.interests}
                  onChange={(e) => setFormData({ ...formData, interests: e.target.value })}
                  placeholder="Travel, Music, Cooking, Gaming, Reading"
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
                <p className="text-xs text-zinc-400">
                  Add interests to help find better matches
                </p>
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Social Media */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-white">Social Media</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="twitter_username" className="text-white">X (Twitter) Username</Label>
                  <Input
                    id="twitter_username"
                    value={formData.twitter_username}
                    onChange={(e) => setFormData({ ...formData, twitter_username: e.target.value })}
                    placeholder="@username"
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="instagram_username" className="text-white">Instagram Username</Label>
                  <Input
                    id="instagram_username"
                    value={formData.instagram_username}
                    onChange={(e) => setFormData({ ...formData, instagram_username: e.target.value })}
                    placeholder="@username"
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedin_username" className="text-white">LinkedIn Username</Label>
                  <Input
                    id="linkedin_username"
                    value={formData.linkedin_username}
                    onChange={(e) => setFormData({ ...formData, linkedin_username: e.target.value })}
                    placeholder="username"
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="arena_username" className="text-white">The Arena Username</Label>
                  <Input
                    id="arena_username"
                    value={formData.arena_username}
                    onChange={(e) => setFormData({ ...formData, arena_username: e.target.value })}
                    placeholder="username"
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
              </div>
              <p className="text-xs text-zinc-400">
                Add your social media accounts to help others connect with you
              </p>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-500 hover:to-yellow-500 transition-all h-11 text-base font-semibold text-white"
                disabled={loading || !formData.username}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={18} />
                    {isEditMode ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  isEditMode ? 'Update Profile' : 'Complete Profile'
                )}
              </Button>
              
              {!isEditMode && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSkip}
                  disabled={loading}
                  className="flex-1 h-11 text-base bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
                >
                  Skip for Now
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
