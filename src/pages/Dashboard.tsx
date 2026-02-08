import { useState, useEffect, useRef, useCallback } from "react";
import { Navbar } from "../components/Navbar";
import { VideoCard } from "../components/VideoCard";
import { videoApi, type Video } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useUpload } from "../hooks/useUpload";
import { useUserQuota } from "../hooks/useUserQuota";
import { toast } from "sonner";
import { Loader2, Upload, Play } from "lucide-react";
import { Button } from "../components/ui/button";
import { UploadProgress } from "../components/UploadProgress";
import { StorageQuota } from "../components/StorageQuota";

export default function Dashboard() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [totalVideos, setTotalVideos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const { user } = useAuth();
  const { refetch: refetchQuota } = useUserQuota();
  const { uploads, isUploading, uploadFiles, removeUpload, clearUploads } = useUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const totalPages = Math.ceil(totalVideos / itemsPerPage);

  useEffect(() => {
    if (user) {
      fetchVideos(currentPage, itemsPerPage);
    }
  }, [user, currentPage, itemsPerPage]);

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

  const fetchVideos = async (page: number, limit: number) => {
    setLoading(true);
    try {
      const data = await videoApi.list(page, limit);
      setVideos(data.videos || []);
      setTotalVideos(data.total || 0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch videos";
      toast.error(errorMessage);
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
      // Refresh current page
      await fetchVideos(currentPage, itemsPerPage);
      await refetchQuota();
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

  const deleteVideo = async (id: string) => {
    try {
      await videoApi.remove(id);

      // If we deleted the last item on current page, go back
      if (videos.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        fetchVideos(currentPage, itemsPerPage);
      }

      await refetchQuota();
      toast.success("Video deleted");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete video";
      toast.error(errorMessage);
    }
  };

  const updateTitle = async (id: string, title: string) => {
    try {
      await videoApi.updateTitle(id, title);
      setVideos(videos.map((v) => (v.id === id ? { ...v, title } : v)));
      toast.success("Title updated");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update title";
      toast.error(errorMessage);
    }
  };

  const getVideoUrl = useCallback((video: Video) => {
    // Use mediaUrl if available (contains signed STORJ URLs or ready-to-use paths)
    if (video.mediaUrl) {
      return video.mediaUrl;
    }
    // Fallback to storage_path for backward compatibility
    return videoApi.getMediaUrl(video.storage_path);
  }, []);

  return (
    <div
      className="h-screen flex flex-col relative overflow-hidden"
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {isDragOver && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 pointer-events-none">
          <div className="text-center p-16 bg-white/5 rounded-[20px] shadow-[0_0_100px_rgba(59,130,246,0.15)] border border-white/10 transform scale-110">
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
              className="px-4 sm:px-6 font-semibold text-white/70 hover:text-white"
            >
              <Upload className="h-4 w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">Upload video</span>
              <span className="inline sm:hidden">Upload</span>
            </Button>
          )
        }
      />

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 flex flex-col flex-1 overflow-hidden">
        {isUploading && (
          <UploadProgress
            uploads={uploads}
            onClose={clearUploads}
            onRemove={removeUpload}
          />
        )}
        {loading && videos.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center overflow-hidden">
            <div className="text-center text-muted-foreground py-24 bg-[#1d1d1f]/50 rounded-[10px] border border-white/5">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
              <p className="mt-4 text-xl font-medium">Fetching your storage...</p>
            </div>
          </div>
        ) : videos.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center overflow-hidden">
            <div className="text-center py-24 bg-[#1d1d1f]/30 rounded-[10px] border border-dashed border-white/10">
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
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 overflow-y-auto pb-6">
              {videos.map((video, index) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  videoUrl={getVideoUrl(video)}
                  onDelete={deleteVideo}
                  onUpdateTitle={updateTitle}
                  animationDelay={index * 50}
                  show={true}
                />
              ))}
            </div>

            {/* Footer with Storage Quota and Pagination */}
            <div className="sticky bottom-0 z-40 mt-auto pt-6 pb-4 bg-[#0e0e10] opacity-50 hover:opacity-100 transition-opacity">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Storage Quota - Left Column */}
                <div className="flex items-center">
                  <div className="w-full h-[72px] flex items-center">
                    <StorageQuota />
                  </div>
                </div>

                {/* Pagination Controls - Center Column */}
                {totalPages > 1 ? (
                  <div className="flex items-center justify-center">
                    <div className="h-[72px] flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-md text-white/30 hover:bg-white/5 disabled:opacity-30"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1 || loading}
                      >
                        ‹
                      </Button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <Button
                            key={page}
                            variant="ghost"
                            size="sm"
                            className={`h-8 w-8 p-0 rounded-md text-sm ${currentPage === page
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                              : "text-white/30 hover:bg-white/5"
                              }`}
                            onClick={() => setCurrentPage(page)}
                            disabled={loading}
                          >
                            {page}
                          </Button>
                        ))}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-md text-white/30 hover:bg-white/5 disabled:opacity-30"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || loading}
                      >
                        ›
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <div className="h-[72px] flex items-center justify-center">
                      <p className="text-sm text-white/30">
                        {totalVideos} video{totalVideos !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                )}

                {/* Right Column - Link Blurb */}
                <div className="hidden lg:flex items-center justify-center">
                  <a
                    href="https://1776.cloud/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-[72px] flex flex-col justify-center text-center cursor-pointer"
                  >
                    <p className="text-sm text-white/30">Connect, share and stay updated.</p>
                    <p className="text-sm text-white/30">Be part of Von, browse and join the forum!</p>
                  </a>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <input
        type="file"
        ref={inputRef}
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        className="hidden"
        accept="video/*"
        multiple
      />
    </div>
  );
}
