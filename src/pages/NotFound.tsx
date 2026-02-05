import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { Play } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center space-y-6 bg-white/5 p-12 rounded-[10px] border border-white/5 max-w-md w-full">
          <div className="bg-primary/10 w-16 h-16 rounded-[10px] flex items-center justify-center mx-auto border border-primary/20">
            <Play className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">404</h1>
            <p className="text-xl text-white/50">Oops! Page not found</p>
          </div>
          <Link to="/" className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:scale-105">
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
