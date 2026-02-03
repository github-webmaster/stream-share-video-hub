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
    <div className="group overflow-hidden rounded-[10px] bg-[#1d1d1f]/80 backdrop-blur-2xl border border-white/5 flex flex-col h-full shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:shadow-[0_30px_60px_rgba(0,0,0,0.6)] transition-all duration-200 cubic-bezier(0.4, 0, 0.2, 1) hover:scale-[1.01] hover:-translate-y-1">
      <Link
        to={sharePath}
        target="_blank"
        className="relative aspect-video bg-black/20 cursor-pointer block overflow-hidden"
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
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
        <div className="absolute right-3 top-3 rounded-md bg-black/60 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white border border-white/10">
          {video.views} views
        </div>
      </Link>

      <div className="p-8 space-y-6 flex flex-col flex-1">
        <div className="min-h-[2.5rem] flex items-center justify-center">
          {editing ? (
            <Input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === "Enter" && saveTitle()}
              className="h-10 text-center text-lg bg-white/5 border-white/10 focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md text-white"
            />
          ) : (
            <h3
              className="text-lg font-semibold text-center line-clamp-2 cursor-pointer hover:text-primary transition-colors px-2 text-white"
              onClick={startEdit}
            >
              {video.title}
            </h3>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-auto">
          <Button
            variant="ghost"
            size="sm"
            className="h-10 px-0 text-[10px] font-bold uppercase tracking-tight gap-2 rounded-md bg-white/5 hover:bg-white/10 transition-colors text-white/70 hover:text-white"
            onClick={copyLink}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-10 px-0 text-[10px] font-bold uppercase tracking-tight gap-2 rounded-md bg-white/5 hover:bg-white/10 transition-colors text-primary hover:text-primary"
            asChild
          >
            <Link to={sharePath} target="_blank">
              <ExternalLink className="h-4 w-4" />
              Open
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-10 px-0 text-[10px] font-bold uppercase tracking-tight text-destructive hover:text-destructive gap-2 rounded-md bg-destructive/10 hover:bg-destructive/20 transition-colors"
            onClick={() => onDelete(video.id, video.storage_path)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
