import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchVideo = async () => {
      if (!shareId) return;

      const { data, error } = await supabase
        .from("videos")
        .select("id, title, storage_path, views")
        .eq("share_id", shareId)
        .single();

      if (error || !data) {
        setError(true);
        setLoading(false);
        return;
      }

      setVideo(data);
      setLoading(false);

      // Increment views
      await supabase
        .from("videos")
        .update({ views: data.views + 1 })
        .eq("id", data.id);
    };

    fetchVideo();
  }, [shareId]);

  const getVideoUrl = (storagePath: string) => {
    const { data } = supabase.storage.from("videos").getPublicUrl(storagePath);
    return data.publicUrl;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !video) {
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-4xl">
        <div className="aspect-video overflow-hidden rounded-lg bg-secondary">
          <video
            src={getVideoUrl(video.storage_path)}
            controls
            autoPlay
            className="h-full w-full"
          />
        </div>
        <h1 className="mt-4 text-lg sm:text-xl font-semibold text-center">{video.title}</h1>
        <p className="text-sm text-muted-foreground mt-1 text-center">
          {video.views + 1} views
        </p>
      </div>
    </div>
  );
}
