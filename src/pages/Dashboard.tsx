import { useEffect, useState, useCallback } from "react";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../hooks/useAuth";
import { UploadZone } from "../components/UploadZone";
import { VideoCard } from "../components/VideoCard";
import { Button } from "../components/ui/button";
import { Play, LogOut, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Video {
  id: string;
  user_id: string;
  title: string;
  file_url: string;
  thumbnail_url: string | null;
  share_id: string;
  views: number;
  created_at: string;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
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
      console.error("[v0] Error fetching videos:", error);
      toast.error("Failed to load videos");
    } else {
      setVideos(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const deleteVideo = async (id: string, fileUrl: string) => {
    // Extract storage path from file URL if needed
    const { error: dbError } = await supabase.from("videos").delete().eq("id", id);

    if (dbError) {
      toast.error("Failed to delete video");
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
    setUploadingFiles((prev) => [...prev, fileName]);

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

      await fetchVideos();
      toast.success(`${fileName} uploaded`);
    } catch (error) {
      console.error("[v0] Upload error:", error);
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
  }, [user]);

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
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.email}
            </span>
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
                videoUrl={video.file_url}
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
