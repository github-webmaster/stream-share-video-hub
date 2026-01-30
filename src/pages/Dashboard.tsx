import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UploadZone } from "@/components/UploadZone";
import { VideoCard } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { Play, LogOut, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Video {
  id: string;
  title: string;
  filename: string;
  storage_path: string;
  share_id: string;
  views: number;
  created_at: string;
}

export default function Dashboard() {
  const { signOut } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);

  const fetchVideos = async () => {
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching videos:", error);
      toast.error("Failed to load videos");
    } else {
      setVideos(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const getVideoUrl = (storagePath: string) => {
    const { data } = supabase.storage.from("videos").getPublicUrl(storagePath);
    return data.publicUrl;
  };

  const deleteVideo = async (id: string, storagePath: string) => {
    const { error: storageError } = await supabase.storage
      .from("videos")
      .remove([storagePath]);

    if (storageError) {
      toast.error("Failed to delete video file");
      return;
    }

    const { error: dbError } = await supabase.from("videos").delete().eq("id", id);

    if (dbError) {
      toast.error("Failed to delete video record");
      return;
    }

    setVideos((prev) => prev.filter((v) => v.id !== id));
    toast.success("Video deleted");
  };

  const updateTitle = async (id: string, title: string) => {
    const { error } = await supabase
      .from("videos")
      .update({ title })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update title");
      return;
    }

    setVideos((prev) =>
      prev.map((v) => (v.id === id ? { ...v, title } : v))
    );
  };

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error(`${file.name} is not a video file`);
      return;
    }

    const fileName = file.name;
    setUploadingFiles((prev) => [...prev, fileName]);

    try {
      const ext = file.name.split(".").pop();
      const storagePath = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("videos").insert({
        title: file.name.replace(/\.[^/.]+$/, ""),
        filename: file.name,
        storage_path: storagePath,
      });

      if (dbError) throw dbError;

      await fetchVideos();
      toast.success(`${fileName} uploaded`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(`Failed to upload ${fileName}`);
    } finally {
      setUploadingFiles((prev) => prev.filter((f) => f !== fileName));
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
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget === e.target) {
      setIsDragOver(false);
    }
  }, []);

  const isUploading = uploadingFiles.length > 0;

  return (
    <div
      className={`min-h-screen bg-background transition-colors ${
        isDragOver ? "bg-primary/5" : ""
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {isDragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none">
          <div className="text-center">
            <Upload className="mx-auto h-16 w-16 text-primary" />
            <p className="mt-4 text-xl font-medium">Drop videos to upload</p>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Play className="h-5 w-5 fill-primary text-primary" />
            <span>VideoShare</span>
          </div>
          <div className="flex items-center gap-3">
            {isUploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading {uploadingFiles.length} file{uploadingFiles.length > 1 ? 's' : ''}...</span>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <UploadZone onUploadComplete={fetchVideos} />

        {loading ? (
          <div className="text-center text-muted-foreground py-12">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            <p className="mt-2">Loading videos...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            No videos yet. Upload your first video above!
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                videoUrl={getVideoUrl(video.storage_path)}
                onDelete={deleteVideo}
                onUpdateTitle={updateTitle}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
