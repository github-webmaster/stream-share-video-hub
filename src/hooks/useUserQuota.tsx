import { useCallback } from "react";
import { quotaApi } from "@/lib/api";
import { useAuth } from "./useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface UserQuota {
  storage_used_bytes: number;
  storage_limit_bytes: number;
  upload_count: number;
}

const MIN_QUOTA = 536870912; // 512MB
const DEFAULT_LIMIT = 10737418240; // 10GB

export function useUserQuota() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: quota, isLoading: loading, isFetching: refreshing, refetch } = useQuery({
    queryKey: ["user-quota", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      console.log("[useUserQuota] Fetching quota via React Query...");
      const data = await quotaApi.getQuota();
      console.log("[useUserQuota] Quota received:", data);
      return data as UserQuota;
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
  });

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const safeUsed = quota && typeof quota.storage_used_bytes === 'number' && quota.storage_used_bytes >= 0 ? quota.storage_used_bytes : 0;
  const safeLimit = quota && typeof quota.storage_limit_bytes === 'number' && quota.storage_limit_bytes > 0
    ? Math.max(quota.storage_limit_bytes, MIN_QUOTA)
    : DEFAULT_LIMIT;
  
  const usedPercentage = safeLimit > 0 ? Math.round((safeUsed / safeLimit) * 100) : 0;

  return {
    quota: quota ? { ...quota, storage_used_bytes: safeUsed, storage_limit_bytes: safeLimit } : { storage_used_bytes: 0, storage_limit_bytes: DEFAULT_LIMIT, upload_count: 0 },
    loading,
    refreshing,
    refetch,
    formatBytes,
    usedPercentage,
    formattedUsed: formatBytes(safeUsed),
    formattedLimit: formatBytes(safeLimit),
  };
}
