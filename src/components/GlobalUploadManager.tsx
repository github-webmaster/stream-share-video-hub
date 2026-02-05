import { useState, useEffect, useRef, useCallback } from "react";
import { Upload } from "lucide-react";
import { useUploadContext } from "../contexts/UploadContext";
import { UploadProgress } from "./UploadProgress";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
import { useUserQuota } from "../hooks/useUserQuota";

declare global {
    interface Window {
        triggerGlobalUpload?: () => void;
    }
}

export function GlobalUploadManager() {
    const { uploads, isUploading, uploadFiles, removeUpload, clearUploads } = useUploadContext();
    const { user } = useAuth();
    const { refetch: refetchQuota } = useUserQuota();
    const [isDragOver, setIsDragOver] = useState(false);
    const dragCounter = useRef(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Define handleFiles BEFORE any useEffect that references it
    const handleFiles = useCallback(async (files: FileList) => {
        const fileArray = Array.from(files);
        const validFiles = fileArray.filter((file) => file.type.startsWith("video/"));
        
        if (validFiles.length !== fileArray.length) {
            toast.error("Some files were skipped - only video files are allowed");
        }

        if (validFiles.length === 0) {
            toast.error("No valid video files selected");
            return;
        }

        const results = await uploadFiles(validFiles);
        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;

        if (successCount > 0) {
            await refetchQuota();
            toast.success(`${successCount} video${successCount !== 1 ? "s" : ""} uploaded successfully!`);
        }

        if (failCount > 0) {
            toast.error(`${failCount} upload${failCount !== 1 ? "s" : ""} failed`);
        }
    }, [uploadFiles, refetchQuota]);

    // Global drag handlers
    useEffect(() => {
        if (!user) return;

        const handleDragEnter = (e: DragEvent) => {
            e.preventDefault();
            dragCounter.current++;
            if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
                setIsDragOver(true);
            }
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            dragCounter.current--;
            if (dragCounter.current === 0) {
                setIsDragOver(false);
            }
        };

        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
        };

        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            setIsDragOver(false);
            dragCounter.current = 0;
            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                handleFiles(e.dataTransfer.files);
            }
        };

        window.addEventListener("dragenter", handleDragEnter);
        window.addEventListener("dragleave", handleDragLeave);
        window.addEventListener("dragover", handleDragOver);
        window.addEventListener("drop", handleDrop);

        return () => {
            window.removeEventListener("dragenter", handleDragEnter);
            window.removeEventListener("dragleave", handleDragLeave);
            window.removeEventListener("dragover", handleDragOver);
            window.removeEventListener("drop", handleDrop);
        };
    }, [user, handleFiles]);

    // Expose the trigger to window for Navbar to use
    useEffect(() => {
        window.triggerGlobalUpload = () => {
            inputRef.current?.click();
        };
        return () => {
            delete window.triggerGlobalUpload;
        };
    }, []);

    if (!user) return null;

    return (
        <>
            {isDragOver && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 pointer-events-none animate-in fade-in duration-75 ease-out">
                    <div className="text-center p-16 bg-white/10 rounded-[40px] shadow-[0_0_100px_rgba(59,130,246,0.1)] border border-white/20 transform will-change-transform">
                        <div className="relative mb-6 flex justify-center">
                            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                            <Upload className="relative h-20 w-20 text-primary drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                        </div>
                        <p className="text-5xl font-black tracking-tighter text-white mb-2">Drop to Upload</p>
                        <p className="text-white/60 font-medium text-xl">Instant video processing</p>
                    </div>
                </div>
            )}

            {isUploading && (
                <UploadProgress
                    uploads={uploads}
                    onClose={clearUploads}
                    onRemove={removeUpload}
                />
            )}

            <input
                type="file"
                ref={inputRef}
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                className="hidden"
                accept="video/*"
                multiple
            />
        </>
    );
}
