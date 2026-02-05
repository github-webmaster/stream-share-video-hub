import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { videoApi, type Video } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { Play, Loader2 } from "lucide-react";
import { Navbar } from "../components/Navbar";

// Debug logging helper - only logs in development
const debugLog = (message: string, ...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log(message, ...args);
  }
};

export default function VideoPlayer() {
  const { user, signOut } = useAuth();
  const { shareId } = useParams<{ shareId: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchVideo = async () => {
      if (!shareId) return;

      try {
        debugLog("[VideoPlayer] Fetching video for shareId:", shareId);

        const videoData = await videoApi.getPublic(shareId);
        debugLog("[VideoPlayer] Video data retrieved:", videoData.title);
        setVideo(videoData);

        // Use mediaUrl if available, otherwise fall back to getMediaUrl
        const url = videoData.mediaUrl || videoApi.getMediaUrl(videoData.storage_path);
        debugLog("[VideoPlayer] Using video URL (sensitive - dev only)");
        setVideoUrl(url);

        setLoading(false);

        // Increment views using security definer function
        await videoApi.incrementViews(shareId);
      } catch (err) {
        debugLog("[VideoPlayer] Error:", err);
        setError(true);
        setLoading(false);
      }
    };

    fetchVideo();
  }, [shareId]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const videoElement = document.querySelector('video');
      if (!videoElement) return;

      // Only handle events if the user isn't typing in an input/textarea
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault(); // Prevent page scroll
          if (videoElement.paused) {
            videoElement.play().catch(() => { });
          } else {
            videoElement.pause();
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          videoElement.currentTime = Math.max(0, videoElement.currentTime - 10);
          break;
        case "ArrowRight":
          e.preventDefault();
          videoElement.currentTime = Math.min(videoElement.duration, videoElement.currentTime + 10);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !video || !videoUrl) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <Play className="h-12 w-12 text-muted-foreground mb-4" />
          <h1 className="text-xl font-semibold">Video not found</h1>
          <p className="text-muted-foreground mt-2 max-w-sm">
            This video may have been deleted or the link is invalid.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#0e0e10]">
      <div className="opacity-25 hover:opacity-100 transition-opacity duration-500 z-50">
        <Navbar />
      </div>

      <main className="flex-1 flex flex-col justify-center relative z-10 mx-auto w-full max-w-7xl px-0 sm:px-4 space-y-4 sm:space-y-6 overflow-hidden">
        <div className="w-full mx-auto flex-1 flex flex-col justify-center">
          {/* Video Container with fluid scaling and max constraints */}
          <div
            className="relative w-full overflow-hidden bg-black shadow-2xl sm:rounded-xl"
            style={{
              maxHeight: '100%',
              aspectRatio: '16 / 9',
              maxWidth: '1280px',
              margin: '0 auto'
            }}
          >
            <video
              src={videoUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
              style={{
                maxWidth: '1280px'
              }}
            />
          </div>

          {/* Video Info Section - YouTube Style */}
          <div className="mt-4 sm:mt-6 px-4 sm:px-0 opacity-25 hover:opacity-100 transition-opacity duration-500">
            <h1 className="text-lg sm:text-2xl font-bold line-clamp-2 leading-tight text-white">
              {video.title}
            </h1>
            <div className="mt-1 sm:mt-2 flex items-center gap-3 text-xs sm:text-sm text-muted-foreground font-medium">
              <span>{video.views + 1} views</span>
              <span>•</span>
              <span>StreamShare Hub</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
