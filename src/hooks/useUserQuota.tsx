import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface UserQuota {
  storage_used_bytes: number;
  storage_limit_bytes: number;
  upload_count: number;
}

export function useUserQuota() {
  const { user } = useAuth();
  const [quota, setQuota] = useState<UserQuota | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQuota = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_quotas")
        .select("storage_used_bytes, storage_limit_bytes, upload_count")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching quota:", error);
        return;
      }

      setQuota(data);
    } catch (error) {
      console.error("Error fetching quota:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const usedPercentage = quota
    ? Math.round((quota.storage_used_bytes / quota.storage_limit_bytes) * 100)
    : 0;

  return {
    quota,
    loading,
    refetch: fetchQuota,
    formatBytes,
    usedPercentage,
    formattedUsed: quota ? formatBytes(quota.storage_used_bytes) : "0 B",
    formattedLimit: quota ? formatBytes(quota.storage_limit_bytes) : "5 GB",
  };
}
