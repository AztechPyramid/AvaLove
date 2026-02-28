import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getDefaultAvatarForUser } from "@/lib/defaultAvatars";
import { cn } from "@/lib/utils";

interface AnimatedAvatarProps {
  userId?: string;
  avatarUrl?: string | null;
  username?: string;
  displayName?: string | null;
  className?: string;
  fallbackClassName?: string;
  showVideo?: boolean;
}

// Helper to check if URL is a video
const isVideoUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
};

export const AnimatedAvatar = ({
  userId,
  avatarUrl,
  username,
  displayName,
  className,
  fallbackClassName,
  showVideo = true,
}: AnimatedAvatarProps) => {
  // ALWAYS use default avatar if no custom avatar URL is provided and userId exists
  const effectiveAvatarUrl = avatarUrl || (userId ? getDefaultAvatarForUser(userId) : null);
  const fallbackChar = (displayName || username)?.[0]?.toUpperCase() || '?';

  // Debug log to help troubleshoot
  if (!avatarUrl && userId) {
    console.log('AnimatedAvatar: Using default avatar for user', userId, effectiveAvatarUrl);
  }

  return (
    <Avatar className={cn(
      "overflow-hidden transition-transform duration-300 hover:scale-105",
      className
    )}>
      {effectiveAvatarUrl ? (
        showVideo && isVideoUrl(effectiveAvatarUrl) ? (
          <video
            src={effectiveAvatarUrl}
            className="w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <AvatarImage 
            src={effectiveAvatarUrl} 
            alt={displayName || username || 'User avatar'}
            className="object-cover animate-fade-in"
          />
        )
      ) : (
        <AvatarFallback className={cn(
          "bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold",
          fallbackClassName
        )}>
          {fallbackChar}
        </AvatarFallback>
      )}
    </Avatar>
  );
};
