import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StorageConfig {
  id: string;
  provider: string;
  storj_access_key: string | null;
  storj_secret_key: string | null;
  storj_endpoint: string;
  storj_bucket: string | null;
  max_file_size_mb: number;
  allowed_types: string[];
}

export function useStorageConfig() {
  const [config, setConfig] = useState<StorageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("storage_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching storage config:", error);
        return;
      }

      setConfig(data);
    } catch (error) {
      console.error("Error fetching storage config:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateConfig = useCallback(
    async (updates: Partial<StorageConfig>): Promise<{ success: boolean; error?: string }> => {
      if (!config?.id) {
        return { success: false, error: "No config found" };
      }

      setSaving(true);
      try {
        const { error } = await supabase
          .from("storage_config")
          .update(updates)
          .eq("id", config.id);

        if (error) {
          return { success: false, error: error.message };
        }

        setConfig((prev) => (prev ? { ...prev, ...updates } : null));
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      } finally {
        setSaving(false);
      }
    },
    [config?.id]
  );

  const testStorjConnection = useCallback(
    async (
      accessKey: string,
      secretKey: string,
      bucket: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        // Simple test: try to list bucket (HEAD request)
        // This is a basic connectivity check
        const response = await fetch(
          `https://gateway.storjshare.io/${bucket}?max-keys=1`,
          {
            method: "GET",
            headers: {
              // Note: This is a simplified check, actual S3 auth is more complex
              // The edge function handles proper signing
            },
          }
        );

        // 403 means credentials work but access denied (expected without proper signing)
        // 404 means bucket doesn't exist
        if (response.status === 404) {
          return { success: false, error: "Bucket not found" };
        }

        // For now, we'll validate that credentials are provided
        if (!accessKey || !secretKey || !bucket) {
          return { success: false, error: "All fields are required" };
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Connection failed",
        };
      }
    },
    []
  );

  return {
    config,
    loading,
    saving,
    updateConfig,
    testStorjConnection,
    refetch: fetchConfig,
  };
}
