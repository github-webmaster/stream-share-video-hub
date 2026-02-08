import { useState, useRef, memo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, Trash2, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

import { Video } from "../lib/api";

interface VideoCardProps {
  video: Video;
  videoUrl: string;
  onDelete: (id: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onLoaded?: (videoId: string) => void;
  animationDelay?: number;
  show?: boolean;
}

export const VideoCard = memo(({ video, videoUrl, onDelete, onUpdateTitle, onLoaded, animationDelay = 0, show = false }: VideoCardProps) => {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(video.title);
  const [isLoaded, setIsLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Notify parent when loaded
  useEffect(() => {
    if (isLoaded && onLoaded) {
      onLoaded(video.id);
    }
  }, [isLoaded, onLoaded, video.id]);

  // Fallback to show card if video takes too long to load metadata
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

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

  // Helper to format file size
  function formatFileSize(size?: number | string): string {
    const sizeNum = typeof size === 'string' ? parseInt(size, 10) : size;
    if (typeof sizeNum !== 'number' || isNaN(sizeNum)) return '';
    if (sizeNum < 1024 * 1024) return '>1MB';
    if (sizeNum < 10 * 1024 * 1024) return `${(sizeNum / (1024 * 1024)).toFixed(1)}MB`;
    return `${Math.round(sizeNum / (1024 * 1024))}MB`;
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-[10px] bg-[#1d1d1f]/80 border border-white/5 flex flex-col h-full shadow-[0_10px_30px_rgba(0,0,0,0.2)] will-change-[opacity] ${show ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
    >
      {/* Whole Card Link Layer */}
      <Link
        to={sharePath}
        target="_blank"
        className="absolute inset-0 z-0 cursor-pointer"
        aria-label={`View ${video.title}`}
      />

      {/* Interactive Content Layer */}
      <div className="relative z-10 pointer-events-none flex flex-col h-full">
        <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden pointer-events-auto">
          <Link
            to={sharePath}
            target="_blank"
            className="block h-full w-full"
          >
            <video
              ref={videoRef}
              src={`${videoUrl}#t=0.001`}
              className="h-full w-full object-cover"
              muted
              playsInline
              preload="metadata"
              poster=""
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onLoadedData={() => setIsLoaded(true)}
              onError={() => setIsLoaded(true)}
            />
            {/* Fallback overlay for mobile when video doesn't load thumbnail */}
            {!isLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
                <svg className="w-12 h-12 text-white/30" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            )}
            <div className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white border border-white/10">
              {video.views} views
            </div>
          </Link>
        </div>

        <div className="p-3 space-y-3 flex flex-col flex-1">
          {/* Title and File Size Row */}
          <div
            className="flex items-center justify-center w-full min-h-[2.5rem] pointer-events-auto cursor-pointer hover:bg-white/5 rounded-md px-2 will-change-[background-color]"
            onClick={editing ? undefined : startEdit}
          >
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
                className="h-8 text-sm bg-white/5 border-white/10 focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md text-white flex-1 min-w-0 text-center"
              />
            ) : (
              <>
                <span
                  className="text-sm font-semibold text-white leading-tight hover:text-primary flex-1 min-w-0 truncate text-center will-change-[color]"
                  title={video.title}
                >
                  {video.title}
                </span>
                <span
                  className="text-xs font-medium text-white/70 ml-2 text-right truncate select-none flex-shrink-0"
                  style={{ opacity: 0.5 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                  title={formatFileSize(video.size)}
                >
                  {formatFileSize(video.size)}
                </span>
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5 mt-auto pointer-events-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-0 text-[9px] font-bold uppercase tracking-tight gap-1.5 rounded-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5 will-change-[background-color,color]"
              onClick={copyLink}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-0 text-[9px] font-bold uppercase tracking-tight gap-1.5 rounded-md bg-white/5 hover:bg-white/10 text-primary hover:text-primary border border-white/5 will-change-[background-color]"
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
              className="h-8 px-0 text-[10px] font-bold uppercase tracking-tight text-destructive hover:text-white gap-1.5 rounded-md bg-transparent hover:bg-destructive opacity-30 hover:opacity-100 border border-destructive/50 will-change-[background-color,color,opacity]"
              onClick={() => onDelete(video.id)}
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
