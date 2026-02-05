import { CheckCircle, XCircle, Loader2, X, Cloud } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface UploadProgressItem {
  filename: string;
  progress: number;
  status: "pending" | "uploading" | "processing" | "completed" | "failed";
  error?: string;
  statusMessage?: string;
}

interface UploadProgressProps {
  uploads: UploadProgressItem[];
  onClose: () => void;
  onRemove: (filename: string) => void;
}

export function UploadProgress({ uploads, onClose, onRemove }: UploadProgressProps) {
  if (uploads.length === 0) {
    return null;
  }

  const completedCount = uploads.filter((u) => u.status === "completed").length;
  const failedCount = uploads.filter((u) => u.status === "failed").length;
  const inProgressCount = uploads.filter(
    (u) => u.status === "pending" || u.status === "uploading" || u.status === "processing"
  ).length;

  const allDone = inProgressCount === 0;

  return (
    <div className="fixed top-4 right-4 z-[100] w-[calc(100%-2rem)] max-w-[380px] sm:w-96 bg-[#1d1d1f] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 ease-out will-change-transform">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        {/* Header status row, right-aligned when all done */}
        {allDone ? (
          <div className="flex items-center justify-end gap-2 ml-auto text-muted-foreground w-full">
            <span className="font-medium text-sm w-full text-right whitespace-nowrap overflow-visible">{`${completedCount} uploaded successfully`}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-white"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {!allDone ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : failedCount > 0 ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : null}
            <span className="font-medium text-white text-sm">
              {!allDone
                ? `Uploading ${inProgressCount} file${inProgressCount !== 1 ? "s" : ""}...`
                : failedCount > 0
                  ? `${failedCount} failed, ${completedCount} completed`
                  : null}
            </span>
          </div>
        )}
      </div>

      {/* Upload List */}
      <div className="max-h-64 overflow-y-auto">
        {uploads.map((upload) => (
          <div
            key={upload.filename}
            className="px-4 py-3 border-b border-white/5 last:border-0"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0">
                {/* Status icon to the left of filename */}
                {upload.status === "completed" && (
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                )}
                {upload.status === "failed" && (
                  <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                )}
                {upload.status === "processing" && (
                  <Cloud className="h-4 w-4 text-primary animate-pulse flex-shrink-0" />
                )}
                <span className="text-sm text-white truncate max-w-[200px]" title={upload.filename}>
                  {upload.filename}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Only show X button for failed uploads */}
                {upload.status === "failed" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground hover:text-white"
                    onClick={() => onRemove(upload.filename)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
                {(upload.status === "pending" || upload.status === "uploading" || upload.status === "processing") && (
                  <span className="text-xs text-muted-foreground">{upload.progress}%</span>
                )}
              </div>
            </div>

            {/* Status message */}
            {upload.statusMessage && (upload.status === "uploading" || upload.status === "processing") && (
              <p className="text-[10px] text-muted-foreground mb-1 truncate">
                {upload.statusMessage}
              </p>
            )}

            {upload.status === "uploading" || upload.status === "pending" ? (
              <Progress value={upload.progress} className="h-1" />
            ) : upload.status === "processing" ? (
              <Progress value={upload.progress} className="h-1 animate-pulse" />
            ) : upload.status === "failed" && upload.error ? (
              <p className="text-xs text-red-400 truncate" title={upload.error}>
                {upload.error}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {/* Keep window open warning */}
      {!allDone && (
        <div className="px-4 py-2 bg-primary/10 border-t border-primary/20">
          <p className="text-[10px] text-center uppercase tracking-widest text-primary/60 font-bold">
            Keep this window open
          </p>
        </div>
      )}
    </div>
  );
}
