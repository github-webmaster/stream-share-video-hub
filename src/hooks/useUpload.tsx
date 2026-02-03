import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UploadProgress {
  filename: string;
  progress: number;
  status: "pending" | "uploading" | "completed" | "failed";
  error?: string;
}

interface UploadResult {
  success: boolean;
  videoId?: string;
  shareId?: string;
  error?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export function useUpload() {
  const [uploads, setUploads] = useState<Map<string, UploadProgress>>(new Map());
  const [isUploading, setIsUploading] = useState(false);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const updateUpload = useCallback((filename: string, update: Partial<UploadProgress>) => {
    setUploads((prev) => {
      const next = new Map(prev);
      const current = next.get(filename) || { filename, progress: 0, status: "pending" as const };
      next.set(filename, { ...current, ...update });
      return next;
    });
  }, []);

  const removeUpload = useCallback((filename: string) => {
    setUploads((prev) => {
      const next = new Map(prev);
      next.delete(filename);
      return next;
    });
  }, []);

  const uploadFile = useCallback(
    async (file: File, retryCount = 0): Promise<UploadResult> => {
      const filename = file.name;

      try {
        updateUpload(filename, { status: "uploading", progress: 10 });

        // Get session for auth
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error("Not authenticated");
        }

        // Read file as base64
        updateUpload(filename, { progress: 20 });
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ""
          )
        );

        updateUpload(filename, { progress: 40 });

        // Call edge function
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-video`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type,
              fileSize: file.size,
              fileData: base64,
            }),
          }
        );

        updateUpload(filename, { progress: 80 });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Upload failed");
        }

        updateUpload(filename, { status: "completed", progress: 100 });

        return {
          success: true,
          videoId: result.video.id,
          shareId: result.video.share_id,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        // Retry logic
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying upload for ${filename} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          updateUpload(filename, {
            status: "uploading",
            progress: 5,
            error: `Retrying... (${retryCount + 1}/${MAX_RETRIES})`,
          });
          await sleep(RETRY_DELAY * (retryCount + 1));
          return uploadFile(file, retryCount + 1);
        }

        updateUpload(filename, {
          status: "failed",
          error: errorMessage,
        });

        return { success: false, error: errorMessage };
      }
    },
    [updateUpload]
  );

  const uploadFiles = useCallback(
    async (files: File[]): Promise<UploadResult[]> => {
      setIsUploading(true);
      const results: UploadResult[] = [];

      // Initialize all uploads
      for (const file of files) {
        updateUpload(file.name, { status: "pending", progress: 0 });
      }

      // Upload sequentially to avoid overwhelming the server
      for (const file of files) {
        const result = await uploadFile(file);
        results.push(result);
      }

      setIsUploading(false);
      return results;
    },
    [uploadFile, updateUpload]
  );

  const clearUploads = useCallback(() => {
    setUploads(new Map());
  }, []);

  return {
    uploads: Array.from(uploads.values()),
    isUploading,
    uploadFiles,
    removeUpload,
    clearUploads,
  };
}
