import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UploadZone } from "@/components/UploadZone";
import { VideoCard } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { Play, LogOut } from "lucide-react";
import { toast } from "sonner";

interface Video {
  id: string;
  title: string;
  filename: string;
  storage_path: string;
  share_id: string;
  views: number;
  created_at: string;
}

export default function Dashboard() {
  const { signOut } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVideos = async () => {
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching videos:", error);
      toast.error("Failed to load videos");
    } else {
      setVideos(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const getVideoUrl = (storagePath: string) => {
    const { data } = supabase.storage.from("videos").getPublicUrl(storagePath);
    return data.publicUrl;
  };

  const deleteVideo = async (id: string, storagePath: string) => {
    const { error: storageError } = await supabase.storage
      .from("videos")
      .remove([storagePath]);

    if (storageError) {
      toast.error("Failed to delete video file");
      return;
    }

    const { error: dbError } = await supabase.from("videos").delete().eq("id", id);

    if (dbError) {
      toast.error("Failed to delete video record");
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Play className="h-5 w-5 fill-primary text-primary" />
            <span>VideoShare</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <UploadZone onUploadComplete={fetchVideos} />

        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading...</div>
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
