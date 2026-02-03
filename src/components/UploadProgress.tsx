import { CheckCircle, XCircle, Loader2, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface UploadProgressItem {
  filename: string;
  progress: number;
  status: "pending" | "uploading" | "completed" | "failed";
  error?: string;
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
    (u) => u.status === "pending" || u.status === "uploading"
  ).length;

  const allDone = inProgressCount === 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 bg-[#1d1d1f] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!allDone ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : failedCount > 0 ? (
            <XCircle className="h-4 w-4 text-red-500" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
          <span className="font-medium text-white text-sm">
            {!allDone
              ? `Uploading ${inProgressCount} file${inProgressCount !== 1 ? "s" : ""}...`
              : failedCount > 0
                ? `${failedCount} failed, ${completedCount} completed`
                : `${completedCount} uploaded successfully`}
          </span>
        </div>
        {allDone && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-white"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Upload List */}
      <div className="max-h-64 overflow-y-auto">
        {uploads.map((upload) => (
          <div
            key={upload.filename}
            className="px-4 py-3 border-b border-white/5 last:border-0"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white truncate max-w-[200px]" title={upload.filename}>
                {upload.filename}
              </span>
              <div className="flex items-center gap-2">
                {upload.status === "completed" && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                {upload.status === "failed" && (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-white"
                      onClick={() => onRemove(upload.filename)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                )}
                {(upload.status === "pending" || upload.status === "uploading") && (
                  <span className="text-xs text-muted-foreground">{upload.progress}%</span>
                )}
              </div>
            </div>

            {upload.status === "uploading" || upload.status === "pending" ? (
              <Progress value={upload.progress} className="h-1" />
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
