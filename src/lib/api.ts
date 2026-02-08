const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8081";
const MEDIA_URL = import.meta.env.VITE_MEDIA_URL ?? `${API_URL}/media`;
const TOKEN_KEY = "streamshare_token";

export interface ApiUser {
  id: string;
  email: string;
  created_at: string;
}

export interface Video {
  id: string;
  user_id?: string;
  title: string;
  storage_path: string;
  filename?: string;
  share_id: string;
  views: number;
  created_at: string;
  updated_at?: string;
  size?: number | string;
  mediaUrl?: string;
}

export interface StorageConfig {
  provider: string;
  storj_access_key?: string;
  storj_secret_key?: string;
  storj_endpoint?: string;
  storj_bucket?: string;
  max_file_size_mb: number;
  allowed_types: string[];
  default_storage_limit_mb?: number;
}

export interface UserQuota {
  user_id: string;
  used_bytes: number;
  max_bytes: number;
  used_percentage: number;
}

export interface UploadSessionData {
  sessionId: string;
  filename: string;
  fileSize: number;
  uploadedChunks: number[];
  totalChunks: number;
  created_at: string;
}

export interface AuthResponse {
  user: ApiUser;
  roles: string[];
}

export interface User {
  id: string;
  email: string;
  created_at: string;
  storage_used: number;
  storage_limit: number;
  upload_count: number;
  roles: string[];
}

const getToken = () => localStorage.getItem(TOKEN_KEY) || "";
const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const apiFetch = async (path: string, options: RequestInit = {}, auth = false) => {
  const headers = new Headers(options.headers || {});
  if (auth) {
    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = data?.error || "Request failed";
    throw new Error(error);
  }

  return data;
};

export const authApi = {
  async signUp(email: string, password: string): Promise<AuthResponse> {
    const data = await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    return { user: data.user, roles: data.roles || [] };
  },
  async signIn(email: string, password: string): Promise<AuthResponse> {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    return { user: data.user, roles: data.roles || [] };
  },
  async signOut(): Promise<void> {
    clearToken();
  },
  async me(): Promise<AuthResponse> {
    const data = await apiFetch("/api/auth/me", { method: "GET" }, true);
    return { user: data.user, roles: data.roles || [] };
  },
  async updateEmail(email: string, password: string): Promise<void> {
    await apiFetch(
      "/api/auth/email",
      {
        method: "PATCH",
        body: JSON.stringify({ email, password }),
      },
      true
    );
  },
  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiFetch(
      "/api/auth/password",
      {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      },
      true
    );
  },
};

export interface UploadSession {
  sessionId: string;
  shareId: string;
  expiresAt: string;
}

export interface ChunkUploadResult {
  success: boolean;
  chunkNumber: number;
  chunksUploaded: number;
  totalChunks?: number;
}

export const videoApi = {
  async list(page = 1, limit = 12): Promise<{ videos: Video[]; total: number }> {
    const data = await apiFetch(`/api/videos?page=${page}&limit=${limit}`, { method: "GET" }, true);
    return { videos: data.videos || [], total: data.total || 0 };
  },
  async updateTitle(id: string, title: string): Promise<void> {
    await apiFetch(
      `/api/videos/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ title }),
      },
      true
    );
  },
  async remove(id: string): Promise<void> {
    await apiFetch(`/api/videos/${id}`, { method: "DELETE" }, true);
  },
  async upload(file: File): Promise<{ success: boolean; videoId?: string; shareId?: string }> {
    const formData = new FormData();
    formData.append("file", file);

    const data = await apiFetch(
      "/api/upload",
      {
        method: "POST",
        body: formData,
      },
      true
    );

    return {
      success: true,
      videoId: data.video?.id,
      shareId: data.video?.share_id,
    };
  },

  // Chunked upload API
  async startChunkedUpload(
    filename: string,
    fileSize: number,
    mimetype: string,
    totalChunks: number
  ): Promise<UploadSession> {
    const data = await apiFetch(
      "/api/upload/start",
      {
        method: "POST",
        body: JSON.stringify({ filename, fileSize, mimetype, totalChunks }),
      },
      true
    );
    return {
      sessionId: data.sessionId,
      shareId: data.shareId,
      expiresAt: data.expiresAt,
    };
  },

  async uploadChunk(
    sessionId: string,
    chunkNumber: number,
    chunkBlob: Blob
  ): Promise<ChunkUploadResult> {
    const formData = new FormData();
    formData.append("chunk", chunkBlob);
    formData.append("chunkNumber", chunkNumber.toString());

    const data = await apiFetch(
      `/api/upload/chunk/${sessionId}`,
      {
        method: "POST",
        body: formData,
      },
      true
    );

    return {
      success: data.success,
      chunkNumber: data.chunkNumber,
      chunksUploaded: data.chunksUploaded,
      totalChunks: data.totalChunks,
    };
  },

  async getChunkUploadUrl(sessionId: string, chunkNumber: number): Promise<{ url: string; key: string }> {
    const data = await apiFetch(
      `/api/upload/chunk-url/${sessionId}/${chunkNumber}`,
      { method: "POST" },
      true
    );
    return { url: data.url, key: data.key };
  },

  async notifyChunkComplete(sessionId: string, chunkNumber: number, key: string, size: number): Promise<{ success: boolean; chunksUploaded: number }> {
    const data = await apiFetch(
      `/api/upload/chunk-complete/${sessionId}/${chunkNumber}`,
      {
        method: "POST",
        body: JSON.stringify({ key, size }),
      },
      true
    );
    return { success: data.success, chunksUploaded: data.chunksUploaded };
  },

  async completeChunkedUpload(
    sessionId: string
  ): Promise<{ success: boolean; videoId?: string; shareId?: string }> {
    const data = await apiFetch(
      `/api/upload/complete/${sessionId}`,
      {
        method: "POST",
      },
      true
    );

    return {
      success: data.success,
      videoId: data.videoId,
      shareId: data.shareId,
    };
  },

  async cancelChunkedUpload(sessionId: string): Promise<void> {
    await apiFetch(`/api/upload/cancel/${sessionId}`, { method: "DELETE" }, true);
  },

  async getUploadSession(sessionId: string): Promise<UploadSessionData | null> {
    const data = await apiFetch(`/api/upload/status/${sessionId}`, { method: "GET" }, true);
    return data.session;
  },

  async getPublic(shareId: string): Promise<Video> {
    const data = await apiFetch(`/api/public/videos/${shareId}`, { method: "GET" });
    return data.video;
  },
  async incrementViews(shareId: string): Promise<void> {
    await apiFetch(`/api/public/videos/${shareId}/views`, { method: "POST" });
  },
  getMediaUrl(storagePath: string): string {
    // If it's already a URL (http/https or signed URL), return as-is
    if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
      return storagePath;
    }
    // Local file path
    return `${MEDIA_URL}/${storagePath}`;
  },
};

export const adminApi = {
  async isAdmin(): Promise<boolean> {
    const data = await apiFetch("/api/admin/status", { method: "GET" }, true);
    return !!data.isAdmin;
  },
  async getStorageConfig(): Promise<StorageConfig | null> {
    const data = await apiFetch("/api/storage-config", { method: "GET" }, true);
    return data.config || null;
  },
  async updateStorageConfig(updates: Record<string, unknown>): Promise<void> {
    await apiFetch(
      "/api/storage-config",
      {
        method: "PUT",
        body: JSON.stringify(updates),
      },
      true
    );
  },
  async reconcileStorage(): Promise<{ success: boolean; message: string }> {
    const data = await apiFetch("/api/admin/reconcile-storage", { method: "GET" }, true);
    return data;
  },
  async getDebugStatus(): Promise<{ debugEnabled: boolean }> {
    const data = await apiFetch("/api/admin/debug-status", { method: "GET" }, true);
    return data;
  },
  async toggleDebug(enabled: boolean): Promise<{ debugEnabled: boolean }> {
    const data = await apiFetch(
      "/api/admin/toggle-debug",
      {
        method: "POST",
        body: JSON.stringify({ enabled }),
      },
      true
    );
    return data;
  },
  async getUsers(): Promise<User[]> {
    const data = await apiFetch("/api/admin/users", { method: "GET" }, true);
    return data.users || [];
  },
  async updateUserPassword(userId: string, password: string): Promise<void> {
    await apiFetch(
      `/api/admin/users/${userId}/password`,
      {
        method: "PATCH",
        body: JSON.stringify({ password }),
      },
      true
    );
  },
  async deleteUser(userId: string): Promise<void> {
    await apiFetch(`/api/admin/users/${userId}`, { method: "DELETE" }, true);
  },
  async updateUserQuota(userId: string, storageLimitBytes: number): Promise<void> {
    await apiFetch(
      `/api/admin/users/${userId}/quota`,
      {
        method: "PATCH",
        body: JSON.stringify({ storageLimitBytes }),
      },
      true
    );
  },
  async clearCache(): Promise<{ success: boolean; message: string }> {
    const data = await apiFetch("/api/admin/cache/clear", { method: "POST" }, true);
    return data;
  },
  async getBackupConfig(): Promise<{ config: any; files: any[] }> {
    return apiFetch("/api/admin/backups", { method: "GET" }, true);
  },
  async updateBackupConfig(config: { enabled: boolean; schedule: string; retentionDays: number }): Promise<void> {
    await apiFetch("/api/admin/backups/config", {
      method: "POST",
      body: JSON.stringify(config),
    }, true);
  },
  async runBackup(): Promise<{ success: boolean; file: string }> {
    return apiFetch("/api/admin/backups/run", { method: "POST" }, true);
  },
};

export const quotaApi = {
  async getQuota(): Promise<UserQuota | null> {
    const data = await apiFetch("/api/user-quota", { method: "GET" }, true);
    return data.quota || null;
  },
};
