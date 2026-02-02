import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../hooks/useAuth";
import { VideoCard } from "../components/VideoCard";
import { Button } from "../components/ui/button";
import { Play, Loader2, Upload, LogOut, Copy, Check, Trash2, Edit2, User } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

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
      className={`min-h-screen bg-background transition-colors ${isDragOver ? "bg-primary/5" : ""
        }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {isDragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none">
          <div className="text-center">
            <Upload className="mx-auto h-16 w-16 text-primary" />
            <p className="mt-4 text-xl font-medium">Drop videos to upload</p>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-3 items-center px-4 py-3">
          {/* Left: Logo */}
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold w-fit hover:opacity-80 transition-opacity">
            <Play className="h-5 w-5 fill-primary text-primary" />
            <span>VideoShare</span>
          </Link>

          {/* Center: Upload controls */}
          <div className="flex justify-center">
            {isUploading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading {uploadingFiles.length} file{uploadingFiles.length > 1 ? 's' : ''}...</span>
              </div>
            ) : (
              <Button size="sm" onClick={() => inputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Upload video
              </Button>
            )}
          </div>

          {/* Right: User actions */}
          <div className="flex items-center justify-end gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline truncate max-w-[150px] font-medium">
              {user?.email}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  My Account
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center cursor-pointer">
                    <User className="h-4 w-4 mr-2" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {loading ? (
          <div className="text-center text-muted-foreground py-12">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            <p className="mt-2">Loading videos...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            No videos yet. Upload your first video!
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
