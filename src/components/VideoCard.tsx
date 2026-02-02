import { useState, useRef } from "react";
import { Copy, Check, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

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

interface VideoCardProps {
  video: Video;
  videoUrl: string;
  onDelete: (id: string, storagePath: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
}

export function VideoCard({ video, videoUrl, onDelete, onUpdateTitle }: VideoCardProps) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(video.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const shareUrl = `${window.location.origin}/v/${video.share_id}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveTitle = () => {
    if (title.trim() && title !== video.title) {
      onUpdateTitle(video.id, title.trim());
    }
    setEditing(false);
  };

  const startEdit = () => {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="group overflow-hidden rounded-lg bg-card border border-border">
      <div
        className="relative aspect-video bg-secondary cursor-pointer"
        onClick={() => window.open(shareUrl, '_blank')}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="h-full w-full object-cover"
          muted
          preload="metadata"
          onMouseEnter={() => videoRef.current?.play()}
          onMouseLeave={() => {
            if (videoRef.current) {
              videoRef.current.pause();
              videoRef.current.currentTime = 0;
            }
          }}
        />
        <div className="absolute right-2 top-2 rounded bg-background/80 px-1.5 py-0.5 text-xs">
          {video.views} views
        </div>
      </div>

      <div className="p-3 space-y-2">
        {editing ? (
          <Input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && saveTitle()}
            className="h-7 text-sm bg-secondary"
          />
        ) : (
          <h3
            className="text-sm font-medium truncate cursor-pointer hover:text-primary"
            onClick={startEdit}
          >
            {video.title}
          </h3>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-7 px-2 text-xs"
            onClick={copyLink}
          >
            {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            {copied ? "Copied" : "Copy Link"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-7 px-2 text-xs"
            onClick={() => window.open(shareUrl, '_blank')}
          >
            Open Video
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-7 px-2 text-xs text-destructive hover:text-destructive"
            onClick={() => onDelete(video.id, video.storage_path)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
