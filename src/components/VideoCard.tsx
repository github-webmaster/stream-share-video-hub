import { useState, useRef, memo } from "react";
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

export const VideoCard = memo(({ video, videoUrl, onDelete, onUpdateTitle }: VideoCardProps) => {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(video.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleMouseEnter = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      videoRef.current?.play().catch(() => { });
    }, 100);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-[10px] bg-[#1d1d1f]/80 backdrop-blur-xl border border-white/5 flex flex-col h-full shadow-[0_10px_30px_rgba(0,0,0,0.2)] opacity-80 hover:opacity-100">
      {/* Whole Card Link Layer */}
      <Link
        to={sharePath}
        target="_blank"
        className="absolute inset-0 z-0 cursor-pointer"
        aria-label={`View ${video.title}`}
      />

      {/* Interactive Content Layer */}
      <div className="relative z-10 pointer-events-none flex flex-col h-full">
        <div className="relative aspect-[16/8.5] bg-black/20 overflow-hidden pointer-events-auto">
          <Link
            to={sharePath}
            target="_blank"
            className="block h-full w-full"
          >
            <video
              ref={videoRef}
              src={videoUrl}
              className="h-full w-full object-cover"
              muted
              preload="metadata"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            />
            <div className="absolute right-2 top-2 rounded-md bg-black/60 backdrop-blur-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white border border-white/10">
              {video.views} views
            </div>
          </Link>
        </div>

        <div className="p-3 space-y-3 flex flex-col flex-1">
          <div className="h-[2.5rem] flex items-center justify-center pointer-events-auto">
            {editing ? (
              <Input
                ref={inputRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="h-8 text-center text-sm bg-white/5 border-white/10 focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md text-white"
              />
            ) : (
              <h3
                className="text-sm font-semibold text-center line-clamp-2 cursor-pointer hover:text-primary transition-colors px-2 text-white leading-tight"
                onClick={startEdit}
              >
                {video.title}
              </h3>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5 mt-auto pointer-events-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-0 text-[9px] font-bold uppercase tracking-tight gap-1.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors text-white/70 hover:text-white border border-white/5"
              onClick={copyLink}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-0 text-[9px] font-bold uppercase tracking-tight gap-1.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors text-primary hover:text-primary border border-white/5"
              asChild
            >
              <Link to={sharePath} target="_blank">
                <ExternalLink className="h-3 w-3" />
                Open
              </Link>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-0 text-[9px] font-bold uppercase tracking-tight text-destructive hover:text-destructive gap-1.5 rounded-md bg-destructive/10 hover:bg-destructive/20 transition-colors border border-white/5"
              onClick={() => onDelete(video.id, video.storage_path)}
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

VideoCard.displayName = "VideoCard";
