import { useState, useRef, useCallback } from "react";
import { Upload, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../hooks/useAuth";
import { toast } from "sonner";

interface UploadZoneProps {
  onUploadComplete: () => void;
}

interface UploadingFile {
  name: string;
  status: "uploading" | "complete" | "error";
}

export function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const { user } = useAuth();
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const generateShareId = () => {
    return Math.random().toString(36).substring(2, 8);
  };

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error(`${file.name} is not a video file`);
      return;
    }

    if (!user) {
      toast.error("You must be logged in to upload");
      return;
    }

    const fileName = file.name;
    setUploadingFiles((prev) => [...prev, { name: fileName, status: "uploading" }]);

    try {
      // For now, create a blob URL as placeholder
      // In production, this would upload to Storj S3
      const fileUrl = URL.createObjectURL(file);
      const shareId = generateShareId();

      const { error: dbError } = await supabase.from("videos").insert({
        user_id: user.id,
        title: file.name.replace(/\.[^/.]+$/, ""),
        file_url: fileUrl,
        share_id: shareId,
        file_size: file.size,
        mime_type: file.type,
      });

      if (dbError) throw dbError;

      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.name === fileName ? { ...f, status: "complete" } : f
        )
      );

      setTimeout(() => {
        setUploadingFiles((prev) => prev.filter((f) => f.name !== fileName));
      }, 2000);

      onUploadComplete();
    } catch (error) {
      console.error("[v0] Upload error:", error);
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.name === fileName ? { ...f, status: "error" } : f
        )
      );
      toast.error(`Failed to upload ${fileName}`);
      
      setTimeout(() => {
        setUploadingFiles((prev) => prev.filter((f) => f.name !== fileName));
      }, 3000);
    }
  };

  const handleFiles = (files: FileList) => {
    Array.from(files).forEach((file) => uploadFile(file));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [user]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const isUploading = uploadingFiles.some((f) => f.status === "uploading");

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !isUploading && inputRef.current?.click()}
      className={`
        relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors
        ${isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {isUploading ? (
        <Loader2 className="mx-auto h-10 w-10 text-primary animate-spin" />
      ) : (
        <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
      )}

      <p className="mt-3 text-sm text-muted-foreground">
        {isUploading
          ? "Uploading..."
          : "Drag & drop videos or click to browse"}
      </p>

      {uploadingFiles.length > 0 && (
        <div className="mt-4 space-y-2 text-left max-w-sm mx-auto">
          {uploadingFiles.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="flex items-center gap-2 text-sm bg-secondary rounded px-3 py-2"
            >
              {file.status === "uploading" && (
                <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
              )}
              {file.status === "complete" && (
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              )}
              <span className="truncate">{file.name}</span>
              {file.status === "complete" && (
                <span className="text-green-500 ml-auto shrink-0">Done</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
