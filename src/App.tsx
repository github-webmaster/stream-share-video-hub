import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import VideoPlayer from "./pages/VideoPlayer";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import ChangePassword from "./pages/ChangePassword";
import Admin from "./pages/Admin";
import { AdminRoute } from "./components/AdminRoute";
import { UploadProvider } from "./contexts/UploadContext";
import { GlobalUploadManager } from "./components/GlobalUploadManager";

// Optimized QueryClient with better caching defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000, // 1 minute - data is fresh for 1 min
      gcTime: 300000, // 5 minutes - cache kept for 5 min
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
      retry: 1, // Only retry once on failure
    },
  },
});

const App = () => (
    <QueryClientProvider client={queryClient}>
        <UploadProvider>
            <TooltipProvider>
                <Toaster />
                <Sonner position="top-center" />
                <GlobalUploadManager />
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/v/:shareId" element={<VideoPlayer />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/password" element={<ChangePassword />} />
                        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </BrowserRouter>
            </TooltipProvider>
        </UploadProvider>
    </QueryClientProvider>
);

export default App;
