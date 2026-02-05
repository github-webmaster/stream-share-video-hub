import { useUserQuota } from "@/hooks/useUserQuota";
import { HardDrive, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

export function StorageQuota() {
  const { quota, loading, refreshing, formattedUsed, formattedLimit, usedPercentage, refetch } = useUserQuota();

  if (loading) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-sm text-white/30">Loading...</p>
          <HardDrive className="h-4 w-4 text-white/30" />
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/5">
          <div className="h-full bg-primary" style={{ width: "0%" }} />
        </div>
      </div>
    );
  }

  if (!quota || quota.storage_limit_bytes === 0) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-sm text-white/30">Not available</p>
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-white/30" />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-white/10"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                refetch();
              }}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-3 w-3 text-white/30", refreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/5">
          <div className="h-full bg-primary" style={{ width: "0%" }} />
        </div>
      </div>
    );
  }

  const getProgressColor = () => {
    const percentage = usedPercentage || 0;
    if (percentage >= 90) return "bg-destructive";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-primary";
  };

  const displayUsed = formattedUsed || "0 B";
  const displayLimit = formattedLimit || "0 B";
  const displayPercentage = usedPercentage || 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm text-white/30">
          {displayUsed} of {displayLimit} ({displayPercentage}%)
        </p>
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-white/30" />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-white/10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              refetch();
            }}
            disabled={refreshing}
            title="Refresh storage quota"
          >
            <RefreshCw className={cn("h-3 w-3 text-white/30", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={cn("h-full", getProgressColor())}
          style={{ width: `${Math.min(displayPercentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
