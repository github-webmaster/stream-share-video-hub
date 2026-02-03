import { useUserQuota } from "@/hooks/useUserQuota";
import { HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

export function StorageQuota() {
  const { quota, loading, formattedUsed, formattedLimit, usedPercentage } = useUserQuota();

  if (loading || !quota) {
    return null;
  }

  const getProgressColor = () => {
    if (usedPercentage >= 90) return "bg-destructive";
    if (usedPercentage >= 70) return "bg-yellow-500";
    return "bg-primary";
  };

  return (
    <div className="w-full max-w-xs">
      <div className="flex items-center gap-2 mb-2">
        <HardDrive className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Storage</span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary mb-1">
        <div
          className={cn("h-full transition-all", getProgressColor())}
          style={{ width: `${Math.min(usedPercentage, 100)}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {formattedUsed} of {formattedLimit} used
      </p>
    </div>
  );
}
