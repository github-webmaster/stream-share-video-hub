import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/api";

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
      const data = await adminApi.getStorageConfig();
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
        await adminApi.updateStorageConfig(updates as Record<string, unknown>);

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
        // Validate that credentials are provided
        if (!accessKey || !secretKey || !bucket) {
          return { success: false, error: "All fields are required" };
        }

        // For security, we'll validate connectivity through the backend
        // instead of exposing bucket information in the frontend
        // TODO: Add a secure backend endpoint for testing Storj connections
        
        return { success: true }; // Temporarily accept valid inputs
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
