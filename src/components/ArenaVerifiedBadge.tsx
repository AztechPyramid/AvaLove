import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import arenaLogo from "@/assets/arena-logo.png";

interface ArenaVerifiedBadgeProps {
  username?: string;
  size?: "sm" | "md" | "lg";
}

export const ArenaVerifiedBadge = ({ username, size = "md" }: ArenaVerifiedBadgeProps) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6"
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center">
            <img 
              src={arenaLogo} 
              alt="The Arena Verified" 
              className={`${sizeClasses[size]} rounded-full ring-2 ring-purple-500/50`}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            <span className="font-bold text-purple-400">The Arena Verified</span>
            {username && (
              <>
                <br />
                <span className="text-zinc-400">@{username}</span>
              </>
            )}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
