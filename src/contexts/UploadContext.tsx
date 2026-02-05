import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { videoApi } from "@/lib/api";

interface UploadProgress {
    filename: string;
    progress: number;
    status: "pending" | "uploading" | "processing" | "completed" | "failed";
    error?: string;
    sessionId?: string;
    isChunked?: boolean;
    statusMessage?: string;
}

interface UploadResult {
    success: boolean;
    videoId?: string;
    shareId?: string;
    error?: string;
}

interface UploadContextType {
    uploads: UploadProgress[];
    isUploading: boolean;
    uploadFiles: (files: File[]) => Promise<UploadResult[]>;
    removeUpload: (filename: string) => void;
    cancelUpload: (filename: string) => Promise<void>;
    clearUploads: () => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const CHUNKED_UPLOAD_THRESHOLD = 100 * 1024 * 1024; // Use chunked upload for files > 100MB
const STORAGE_KEY_PREFIX = "upload_session_";

interface StoredSession {
    sessionId: string;
    filename: string;
    fileSize: number;
    uploadedChunks: number[];
    totalChunks: number;
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
    const [uploads, setUploads] = useState<Map<string, UploadProgress>>(new Map());
    const [isUploading, setIsUploading] = useState(false);

    // Track processing animation intervals
    const processingIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

    // Upload serialization queue (global for this browser session)
    const uploadQueue = useRef<Promise<void>>(Promise.resolve());

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
        const interval = processingIntervals.current.get(filename);
        if (interval) {
            clearInterval(interval);
            processingIntervals.current.delete(filename);
        }
        setUploads((prev) => {
            const next = new Map(prev);
            next.delete(filename);
            return next;
        });
    }, []);

    const startProcessingAnimation = useCallback((filename: string, startProgress: number, maxProgress: number) => {
        const existing = processingIntervals.current.get(filename);
        if (existing) clearInterval(existing);

        let currentProgress = startProgress;
        const interval = setInterval(() => {
            const remaining = maxProgress - currentProgress;
            const increment = Math.max(0.1, remaining * 0.05);
            currentProgress = Math.min(maxProgress, currentProgress + increment);
            updateUpload(filename, { progress: Math.round(currentProgress) });
        }, 500);

        processingIntervals.current.set(filename, interval);
    }, [updateUpload]);

    const stopProcessingAnimation = useCallback((filename: string) => {
        const interval = processingIntervals.current.get(filename);
        if (interval) {
            clearInterval(interval);
            processingIntervals.current.delete(filename);
        }
    }, []);

    const saveSession = (filename: string, session: StoredSession) => {
        try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}${filename}`, JSON.stringify(session));
        } catch (e) {
            console.warn("Failed to save upload session:", e);
        }
    };

    const loadSession = (filename: string): StoredSession | null => {
        try {
            const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${filename}`);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    };

    const clearSession = (filename: string) => {
        try {
            localStorage.removeItem(`${STORAGE_KEY_PREFIX}${filename}`);
        } catch (e) {
            console.warn("Failed to clear upload session:", e);
        }
    };

    const uploadFileChunked = useCallback(
        async (file: File, retryCount = 0): Promise<UploadResult> => {
            const filename = file.name;
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            let session: StoredSession | null = null;

            try {
                updateUpload(filename, {
                    status: "uploading",
                    progress: 0,
                    isChunked: true,
                    statusMessage: "Starting upload..."
                });

                session = loadSession(filename);
                let sessionId = session?.sessionId;
                let uploadedChunks = session?.uploadedChunks || [];

                if (!session || session.fileSize !== file.size || session.totalChunks !== totalChunks) {
                    const startResult = await videoApi.startChunkedUpload(
                        filename,
                        file.size,
                        file.type,
                        totalChunks
                    );
                    sessionId = startResult.sessionId;
                    uploadedChunks = [];
                    session = { sessionId, filename, fileSize: file.size, uploadedChunks, totalChunks };
                    saveSession(filename, session);
                }

                updateUpload(filename, { sessionId });

                for (let i = 0; i < totalChunks; i++) {
                    if (uploadedChunks.includes(i)) {
                        const progress = Math.round(((i + 1) / totalChunks) * 80);
                        updateUpload(filename, { progress, statusMessage: `Uploading chunk ${i + 1}/${totalChunks}...` });
                        continue;
                    }

                    const start = i * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, file.size);
                    const chunkBlob = file.slice(start, end);

                    let chunkRetries = 0;
                    let chunkUploaded = false;

                    while (chunkRetries < MAX_RETRIES && !chunkUploaded) {
                        try {
                            updateUpload(filename, { statusMessage: `Uploading chunk ${i + 1}/${totalChunks}...` });
                            try {
                                const { url, key } = await videoApi.getChunkUploadUrl(sessionId!, i);
                                const putResponse = await fetch(url, {
                                    method: 'PUT',
                                    body: chunkBlob,
                                    headers: { 'Content-Type': 'application/octet-stream' },
                                });
                                if (!putResponse.ok) throw new Error(`Direct upload failed: ${putResponse.status}`);
                                await videoApi.notifyChunkComplete(sessionId!, i, key, chunkBlob.size);
                            } catch (directUploadError) {
                                await videoApi.uploadChunk(sessionId!, i, chunkBlob);
                            }
                            chunkUploaded = true;
                            uploadedChunks.push(i);
                            session!.uploadedChunks = uploadedChunks;
                            saveSession(filename, session!);
                            const progress = Math.round(((i + 1) / totalChunks) * 80);
                            updateUpload(filename, { progress });
                        } catch (chunkError) {
                            chunkRetries++;
                            if (chunkRetries < MAX_RETRIES) {
                                await sleep(RETRY_DELAY * chunkRetries);
                            } else {
                                throw new Error(`Failed to upload chunk ${i} after ${MAX_RETRIES} retries`);
                            }
                        }
                    }
                }

                updateUpload(filename, { status: "processing", progress: 80, statusMessage: "Processing video..." });
                startProcessingAnimation(filename, 80, 99);
                const result = await videoApi.completeChunkedUpload(sessionId!);
                stopProcessingAnimation(filename);
                clearSession(filename);
                updateUpload(filename, { status: "completed", progress: 100, statusMessage: "Upload complete!" });

                return { success: true, videoId: result.videoId, shareId: result.shareId };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                stopProcessingAnimation(filename);
                if (session?.sessionId) {
                    try { 
                        await videoApi.cancelChunkedUpload(session.sessionId); 
                    } catch (cancelError) {
                        console.warn('Failed to cancel chunked upload:', cancelError);
                    }
                    clearSession(filename);
                }
                if (retryCount < MAX_RETRIES) {
                    await sleep(RETRY_DELAY * (retryCount + 1));
                    return uploadFileChunked(file, retryCount + 1);
                }
                updateUpload(filename, { status: "failed", error: errorMessage, statusMessage: "Upload failed" });
                return { success: false, error: errorMessage };
            }
        },
        [updateUpload, startProcessingAnimation, stopProcessingAnimation]
    );

    const uploadFileSingleShot = useCallback(
        async (file: File, retryCount = 0): Promise<UploadResult> => {
            const filename = file.name;
            try {
                updateUpload(filename, { status: "uploading", progress: 0, isChunked: false, statusMessage: "Uploading..." });
                let currentProgress = 0;
                const progressSimulation = setInterval(() => {
                    currentProgress += Math.random() * 3 + 1;
                    if (currentProgress > 90) currentProgress = 90;
                    updateUpload(filename, { progress: Math.floor(currentProgress) });
                }, 150);

                try {
                    const result = await videoApi.upload(file);
                    clearInterval(progressSimulation);
                    updateUpload(filename, { progress: 95, statusMessage: "Finalizing..." });
                    await new Promise(resolve => setTimeout(resolve, 200));
                    updateUpload(filename, { status: "completed", progress: 100, statusMessage: "Upload complete!" });
                    return { success: true, videoId: result.videoId, shareId: result.shareId };
                } catch (error) {
                    clearInterval(progressSimulation);
                    throw error;
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                if (retryCount < MAX_RETRIES) {
                    await sleep(RETRY_DELAY * (retryCount + 1));
                    return uploadFileSingleShot(file, retryCount + 1);
                }
                updateUpload(filename, { status: "failed", error: errorMessage, statusMessage: "Upload failed" });
                return { success: false, error: errorMessage };
            }
        },
        [updateUpload]
    );

    const uploadFile = useCallback(
        async (file: File): Promise<UploadResult> => {
            const useChunked = file.size > CHUNKED_UPLOAD_THRESHOLD;
            if (useChunked) return uploadFileChunked(file);
            return uploadFileSingleShot(file);
        },
        [uploadFileChunked, uploadFileSingleShot]
    );

    const uploadFiles = useCallback(
        async (files: File[]): Promise<UploadResult[]> => {
            for (const file of files) {
                updateUpload(file.name, { status: "pending", progress: 0 });
            }

            const task = async () => {
                setIsUploading(true);
                const results: UploadResult[] = [];
                for (const file of files) {
                    const result = await uploadFile(file);
                    results.push(result);
                }
                setIsUploading(false);
                return results;
            };

            const previous = uploadQueue.current;
            const chained = previous.catch(() => undefined).then(() => task());
            uploadQueue.current = chained.then(() => undefined).catch(() => undefined);
            return (await chained) as UploadResult[];
        },
        [uploadFile, updateUpload]
    );

    const clearUploads = useCallback(() => {
        processingIntervals.current.forEach((interval) => clearInterval(interval));
        processingIntervals.current.clear();
        setUploads(new Map());
    }, []);

    const cancelUpload = useCallback(
        async (filename: string) => {
            const upload = uploads.get(filename);
            stopProcessingAnimation(filename);
            if (upload?.sessionId && upload.isChunked) {
                try {
                    await videoApi.cancelChunkedUpload(upload.sessionId);
                    clearSession(filename);
                } catch (cancelError) {
                    console.warn('Failed to cancel upload session:', cancelError);
                }
            }
            removeUpload(filename);
        },
        [uploads, removeUpload, stopProcessingAnimation]
    );

    const value = {
        uploads: Array.from(uploads.values()),
        isUploading,
        uploadFiles,
        removeUpload,
        cancelUpload,
        clearUploads,
    };

    return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

export function useUploadContext() {
    const context = useContext(UploadContext);
    if (context === undefined) {
        throw new Error("useUploadContext must be used within an UploadProvider");
    }
    return context;
}
