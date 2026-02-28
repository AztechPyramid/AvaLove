import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CopyableAddressProps {
  label: string;
  address: string;
  icon?: React.ReactNode;
  className?: string;
}

export const CopyableAddress = ({ label, address, icon, className }: CopyableAddressProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success(`${label} copied!`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "flex items-center gap-2 bg-zinc-800/50 hover:bg-zinc-700/50 px-3 py-2 rounded-lg transition-all group",
        className
      )}
    >
      {icon}
      <div className="text-left min-w-0 flex-1">
        <p className="text-[10px] text-zinc-500 uppercase">{label}</p>
        <p className="text-xs text-zinc-300 font-mono truncate">
          {address.slice(0, 10)}...{address.slice(-8)}
        </p>
      </div>
      {copied ? (
        <Check className="w-4 h-4 text-green-500 shrink-0" />
      ) : (
        <Copy className="w-4 h-4 text-zinc-500 group-hover:text-orange-500 transition-colors shrink-0" />
      )}
    </button>
  );
};
