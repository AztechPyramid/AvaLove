import { Button } from '@/components/ui/button';
import { useFollowers } from '@/hooks/useFollowers';
import { Plus, Check } from 'lucide-react';

interface FollowButtonProps {
  userId: string;
  currentUserId: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const FollowButton = ({ userId, currentUserId, variant = 'outline', size = 'sm' }: FollowButtonProps) => {
  const { isFollowing, toggleFollow, loading } = useFollowers(userId, currentUserId);

  return (
    <Button
      variant={isFollowing ? 'outline' : 'default'}
      size={size}
      onClick={(e) => {
        e.stopPropagation();
        toggleFollow();
      }}
      disabled={loading}
      className={`gap-2 cursor-pointer pointer-events-auto ${
        isFollowing 
          ? 'bg-zinc-900 text-white border-zinc-700 hover:border-red-500 hover:text-red-500 hover:bg-red-500/10' 
          : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white'
      }`}
    >
      {isFollowing ? (
        <>
          <Check className="w-4 h-4" />
          {size !== 'icon' && <span className="hidden sm:inline">Following</span>}
        </>
      ) : (
        <>
          <Plus className="w-4 h-4" />
          {size !== 'icon' && <span className="hidden sm:inline">Follow</span>}
        </>
      )}
    </Button>
  );
};
