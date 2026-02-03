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

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 9;

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

  // Guard against navigating away during upload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (uploadingFiles.length > 0) {
        e.preventDefault();
        e.returnValue = ""; // Standard way to trigger browser prompt
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [uploadingFiles.length]);

  // Handle internal navigation block
  const isBlocking = uploadingFiles.length > 0;
  useEffect(() => {
    if (isBlocking) {
      const handleBlockedNavigation = () => {
        return !window.confirm("An upload is in progress. Are you sure you want to leave?");
      };
      // Note: React Router 6.4+ useBlocker is the modern way, 
      // but for simplicity and reliability across different router setups, 
      // a simple confirmed-based check or custom hook is often used.
      // However, since we are in a SPA, we'll try to use a standard approach.
    }
  }, [isBlocking]);

  // Pagination calculations
  const totalPages = Math.ceil(videos.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedVideos = videos.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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

      // Adjust page if we deleted the last item on a page
      const newTotalPages = Math.ceil((videos.length - 1) / ITEMS_PER_PAGE);
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages);
      }

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

  const dragCounter = useRef(0);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [user]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const isUploading = uploadingFiles.length > 0;

  const getVideoUrl = (storagePath: string) => {
    const { data } = supabase.storage.from("videos").getPublicUrl(storagePath);
    return data.publicUrl;
  };

  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-2xl pointer-events-none">
          <div className="text-center p-16 bg-white/5 rounded-[20px] shadow-[0_0_100px_rgba(59,130,246,0.15)] border border-white/10 backdrop-blur-3xl transform scale-110">
            <div className="relative mb-8 flex justify-center">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
              <Upload className="relative h-24 w-24 text-primary drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
            </div>
            <p className="text-3xl font-bold tracking-tight text-white mb-2">Release to upload</p>
            <p className="text-white/40 font-medium">Your videos will be ready in seconds</p>
          </div>
        </div>
      )}

      <Navbar
        centerContent={
          isUploading ? (
            <div className="flex flex-col items-center gap-1 group">
              <div className="flex items-center gap-3 px-6 py-2 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-semibold whitespace-nowrap text-white">
                  Uploading {uploadingFiles.length} {uploadingFiles.length > 1 ? 'videos' : 'video'}...
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-primary/60 font-bold animate-pulse">
                Don't close or refresh
              </span>
            </div>
          ) : (
            <Button
              variant="ghost"
              onClick={() => inputRef.current?.click()}
              className="px-6 transition-all font-semibold text-white/70 hover:text-white"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload video
            </Button>
          )
        }
      />

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 flex flex-col min-h-[calc(100vh-64px)]">
        {loading ? (
          <div className="flex-1 flex flex-col justify-center">
            <div className="text-center text-muted-foreground py-24 bg-[#1d1d1f]/50 backdrop-blur-xl rounded-[10px] border border-white/5">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
              <p className="mt-4 text-xl font-medium">Fetching your storage...</p>
            </div>
          </div>
        ) : videos.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center">
            <div className="text-center py-24 bg-[#1d1d1f]/30 backdrop-blur-xl rounded-[10px] border border-dashed border-white/10">
              <div className="max-w-md mx-auto space-y-4">
                <div className="bg-primary/10 w-16 h-16 rounded-[10px] flex items-center justify-center mx-auto mb-6 border border-primary/20">
                  <Play className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-white">Your library is empty</h2>
                <p className="text-muted-foreground text-lg">Upload your first video to start sharing with the world.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-auto">
              {paginatedVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  videoUrl={getVideoUrl(video.storage_path)}
                  onDelete={deleteVideo}
                  onUpdateTitle={updateTitle}
                />
              ))}
            </div>

            {/* Sticky Pagination Controls */}
            {totalPages > 1 && (
              <div className="sticky bottom-0 z-40 mt-12 pt-8 pb-4 bg-[#0e0e10]/80 backdrop-blur-xl border-t border-white/5">
                <div className="flex flex-col items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 px-4 rounded-md text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-30"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant="ghost"
                          size="sm"
                          className={`h-10 w-10 rounded-md transition-all ${currentPage === page
                            ? "bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20"
                            : "text-white/50 hover:text-white hover:bg-white/5"
                            }`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      ))}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 px-4 rounded-md text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-30"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                  <p className="text-sm text-white/30 font-medium">
                    Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, videos.length)} of {videos.length} videos
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
