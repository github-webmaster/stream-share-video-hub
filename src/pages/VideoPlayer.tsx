import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../hooks/useAuth";
import { Play, Loader2 } from "lucide-react";
import { Navbar } from "../components/Navbar";

interface Video {
  id: string;
  title: string;
  storage_path: string;
  views: number;
}

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
        console.log("[v0] Fetching video for shareId:", shareId);

        const { data, error: fetchError } = await supabase
          .rpc("get_public_video_by_share_id", { share_id_param: shareId })
          .single();

        if (fetchError || !data) {
          console.error("[v0] Error fetching video from RPC:", fetchError);
          setError(true);
          setLoading(false);
          return;
        }

        console.log("[v0] Video data retrieved successfully:", data.title);
        setVideo(data);

        // Get public URL for video
        const { data: urlData } = supabase.storage
          .from("videos")
          .getPublicUrl(data.storage_path);
        setVideoUrl(urlData.publicUrl);

        setLoading(false);

        // Increment views using security definer function
        await supabase.rpc("increment_video_views", { video_share_id: shareId });
      } catch (err) {
        console.error("[v0] Error:", err);
        setError(true);
        setLoading(false);
      }
    };

    fetchVideo();
  }, [shareId]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !video || !videoUrl) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
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
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-[1280px] mx-auto">
          {/* Video Container with fluid scaling and max constraints */}
          <div
            className="relative w-full overflow-hidden bg-black shadow-2xl sm:rounded-xl"
            style={{
              maxHeight: '720px',
              height: 'calc(100vw * 9 / 16)', // Maintain aspect ratio fluidly
              maxWidth: '1280px'
            }}
          >
            <video
              src={videoUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              style={{
                maxWidth: '1280px',
                maxHeight: '720px'
              }}
            />
          </div>

          {/* Video Info Section - YouTube Style */}
          <div className="mt-6">
            <h1 className="text-xl sm:text-2xl font-bold line-clamp-2 leading-tight">
              {video.title}
            </h1>
            <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground font-medium">
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
