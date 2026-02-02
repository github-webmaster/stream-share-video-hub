import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { Play, Loader2 } from "lucide-react";

interface Video {
  id: string;
  title: string;
  storage_path: string;
  views: number;
}

export default function VideoPlayer() {
  const { shareId } = useParams<{ shareId: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchVideo = async () => {
      if (!shareId) return;

      try {
        const { data, error: fetchError } = await supabase
          .rpc("get_public_video_by_share_id", { p_share_id: shareId })
          .single();

        if (fetchError || !data) {
          console.error("[v0] Error fetching video:", fetchError);
          setError(true);
          setLoading(false);
          return;
        }

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
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !video || !videoUrl) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <Play className="h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-xl font-semibold">Video not found</h1>
        <p className="text-muted-foreground mt-2 max-w-sm">
          This video may have been deleted or the link is invalid.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background pt-4 sm:pt-8 px-0 sm:px-4">
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
        <div className="mt-4 px-4 sm:px-0 pb-12">
          <h1 className="text-xl sm:text-2xl font-bold line-clamp-2 leading-tight">
            {video.title}
          </h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground font-medium">
            <span>{video.views + 1} views</span>
            <span>•</span>
            <span>StreamShare Hub</span>
          </div>

          <div className="mt-4 h-[1px] bg-border w-full" />

          {/* Channel/Description Placeholder for YT look */}
          <div className="mt-6 flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
              S
            </div>
            <div>
              <p className="font-semibold text-sm">StreamShare Hub</p>
              <p className="text-xs text-muted-foreground">Uploaded with simple video upload app</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
