import { Navigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAdmin();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    toast.error("Access denied. Admin only.");
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
