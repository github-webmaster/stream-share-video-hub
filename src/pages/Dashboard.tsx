import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../hooks/useAuth";
import { Navbar } from "../components/Navbar";
import { VideoCard } from "../components/VideoCard";
import { Button } from "../components/ui/button";
import { Play, Loader2, Upload, LogOut, Copy, Check, Trash2, Edit2, User } from "lucide-react";
import { toast } from "sonner";

interface Video {
  id: string;
  user_id: string;
  title: string;
  storage_path: string;
  filename: string;
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
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchVideos = async () => {
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[v0] Error fetching videos:", error);
      toast.error("Failed to load videos");
    } else {
      setVideos((data as Video[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const deleteVideo = async (id: string, storagePath: string) => {
    try {
      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from("videos")
        .remove([storagePath]);

      if (storageError) {
        console.error("[v0] Storage delete error:", storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase.from("videos").delete().eq("id", id);

      if (dbError) {
        toast.error("Failed to delete video");
        return;
      }

      setVideos((prev) => prev.filter((v) => v.id !== id));
      toast.success("Video deleted");
    } catch (error) {
      console.error("[v0] Delete error:", error);
      toast.error("Failed to delete video");
    }
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

    if (!user) {
      toast.error("You must be logged in to upload");
      return;
    }

    const fileName = file.name;
    setUploadingFiles((prev) => [...prev, fileName]);

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const storagePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Insert into database
      const { error: dbError } = await supabase.from("videos").insert({
        user_id: user.id,
        title: file.name.replace(/\.[^/.]+$/, ""),
        filename: file.name,
        storage_path: storagePath,
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

  const getVideoUrl = (storagePath: string) => {
    const { data } = supabase.storage.from("videos").getPublicUrl(storagePath);
    return data.publicUrl;
  };

  return (
    <div
      className={`min-h-screen bg-[#f5f5f7] dark:bg-[#000000] relative overflow-x-hidden ${isDragOver ? "bg-primary/5" : ""
        }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Dynamic iCloud-style Background Shapes */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-gradient-to-br from-blue-600/20 to-purple-600/30 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-tr from-cyan-400/10 to-blue-500/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {isDragOver && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white/40 dark:bg-black/40 backdrop-blur-md pointer-events-none">
          <div className="text-center p-12 bg-white/80 dark:bg-black/80 rounded-[3rem] shadow-2xl border border-white/20">
            <Upload className="mx-auto h-20 w-20 text-primary animate-bounce" />
            <p className="mt-6 text-2xl font-bold tracking-tight">Release to upload</p>
          </div>
        </div>
      )}

      <Navbar
        centerContent={
          isUploading ? (
            <div className="flex items-center gap-3 px-6 py-2 bg-secondary/50 rounded-full backdrop-blur-md animate-in fade-in zoom-in duration-200">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-semibold whitespace-nowrap">
                Uploading {uploadingFiles.length} {uploadingFiles.length > 1 ? 'videos' : 'video'}...
              </span>
            </div>
          ) : (
            <Button
              onClick={() => inputRef.current?.click()}
              className="rounded-full px-6 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-105 active:scale-95"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload video
            </Button>
          )
        }
      />

      <main className="relative z-10 mx-auto max-w-[1600px] px-8 sm:px-12 lg:px-16 py-12 space-y-12">
        {loading ? (
          <div className="text-center text-muted-foreground py-24 bg-white/10 dark:bg-black/10 backdrop-blur-xl rounded-[3rem] border border-white/10">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-xl font-medium">Fetching your storage...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-24 bg-white/10 dark:bg-black/10 backdrop-blur-xl rounded-[3rem] border border-dashed border-white/20">
            <div className="max-w-md mx-auto space-y-4">
              <div className="bg-primary/10 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Play className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Your library is empty</h2>
              <p className="text-muted-foreground text-lg">Upload your first video to start sharing with the world.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
