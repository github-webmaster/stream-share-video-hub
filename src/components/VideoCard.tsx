import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, Trash2, ExternalLink } from "lucide-react";
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

  const sharePath = `/v/${video.share_id}`;
  const shareUrl = `${window.location.origin}${sharePath}`;

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
    <div className="group overflow-hidden rounded-[2rem] bg-card/90 backdrop-blur-xl border-none flex flex-col h-full shadow-[0_11px_34px_0_rgba(0,0,0,0.2)] dark:shadow-[0_11px_34px_0_rgba(0,0,0,0.5)] opacity-80 hover:opacity-100 transition-all duration-300 ease-in-out hover:scale-[1.01] hover:-translate-y-1">
      <Link
        to={sharePath}
        target="_blank"
        className="relative aspect-video bg-secondary cursor-pointer block overflow-hidden"
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
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
        <div className="absolute right-3 top-3 rounded-full bg-background/60 backdrop-blur-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
          {video.views} views
        </div>
      </Link>

      <div className="p-8 space-y-4 flex flex-col flex-1">
        <div className="min-h-[2.5rem] flex items-center justify-center">
          {editing ? (
            <Input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === "Enter" && saveTitle()}
              className="h-10 text-center text-base bg-secondary/50 border-none focus-visible:ring-1 focus-visible:ring-primary/20"
            />
          ) : (
            <h3
              className="text-base font-semibold text-center line-clamp-2 cursor-pointer hover:text-primary transition-colors px-2"
              onClick={startEdit}
            >
              {video.title}
            </h3>
          )}
        </div>

        <div className="flex items-center gap-2 mt-auto">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-9 px-3 text-xs gap-2 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
            onClick={copyLink}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy Link"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-9 px-3 text-xs gap-2 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
            asChild
          >
            <Link to={sharePath} target="_blank">
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-9 px-3 text-xs text-destructive hover:text-destructive gap-2 rounded-xl bg-destructive/5 hover:bg-destructive/10 transition-colors"
            onClick={() => onDelete(video.id, video.storage_path)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
