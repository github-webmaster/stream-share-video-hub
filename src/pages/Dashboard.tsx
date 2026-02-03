import { useState, useEffect, useRef, useCallback } from "react";
import { Navbar } from "../components/Navbar";
import { VideoCard } from "../components/VideoCard";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../hooks/useAuth";
import { useUpload } from "../hooks/useUpload";
import { useAdmin } from "../hooks/useAdmin";
import { toast } from "sonner";
import { Loader2, Upload, Play, Settings } from "lucide-react";
import { Button } from "../components/ui/button";
import { UploadProgress } from "../components/UploadProgress";
import { StorageQuota } from "../components/StorageQuota";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { uploads, isUploading, uploadFiles, removeUpload, clearUploads } = useUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    if (user) {
      fetchVideos();
    }
  }, [user]);

  // Adaptive Grid Density
  useEffect(() => {
    const updateDensity = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Target: 2560x1440 screens (or similar high-res)
      // If we have enough vertical space for 3 rows and horizontal for 3 columns
      if (width >= 2000 && height >= 1100) {
        setItemsPerPage(9); // 3x3 grid
      } else {
        setItemsPerPage(6); // 3x2 grid
      }
    };

    updateDensity();
    window.addEventListener("resize", updateDensity);
    return () => window.removeEventListener("resize", updateDensity);
  }, []);

  // Data Safety: Warn user if leaving during upload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isUploading]);

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from("videos")
        .select("id, title, filename, storage_path, share_id, views, created_at, size")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFiles = async (files: FileList) => {
    const fileArray = Array.from(files);
    
    // Validate file types
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
      await fetchVideos();
      toast.success(`${successCount} video${successCount !== 1 ? "s" : ""} uploaded successfully!`);
    }

    if (failCount > 0) {
      toast.error(`${failCount} upload${failCount !== 1 ? "s" : ""} failed`);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const deleteVideo = async (id: string, storagePath: string) => {
    try {
      const { error: storageError } = await supabase.storage
        .from("videos")
        .remove([storagePath]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("videos")
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;

      setVideos(videos.filter((v) => v.id !== id));

      // If we deleted the last item on current page, go back
      if (paginatedVideos.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }

      toast.success("Video deleted");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const updateTitle = async (id: string, title: string) => {
    try {
      const { error } = await supabase
        .from("videos")
        .update({ title })
        .eq("id", id);

      if (error) throw error;
      setVideos(videos.map((v) => (v.id === id ? { ...v, title } : v)));
      toast.success("Title updated");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const totalPages = Math.ceil(videos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedVideos = videos.slice(startIndex, startIndex + itemsPerPage);

  const getVideoUrl = useCallback((path: string) => {
    const { data } = supabase.storage.from("videos").getPublicUrl(path);
    return data.publicUrl;
  }, []);

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

      {/* Upload Progress Component */}
      <UploadProgress
        uploads={uploads}
        onClose={clearUploads}
        onRemove={removeUpload}
      />

      {/* Centered Drag-and-Drop Overlay */}
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
          !isUploading && (
            <Button
              variant="ghost"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className="px-4 sm:px-6 transition-all font-semibold text-white/70 hover:text-white"
            >
              <Upload className="h-4 w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">Upload video</span>
              <span className="inline sm:hidden">Upload</span>
            </Button>
          )
        }
        rightContent={
          <div className="flex items-center gap-4">
            <StorageQuota />
            {isAdmin && (
              <Link to="/admin">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
                  <Settings className="h-5 w-5" />
                </Button>
              </Link>
            )}
          </div>
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
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, videos.length)} of {videos.length} videos
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
