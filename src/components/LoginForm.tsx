import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "../hooks/useAuth";
import { Play } from "lucide-react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password);

    if (result.error) {
      setError(result.error.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4 font-sans">
      <div className="w-full max-w-[480px] space-y-8 bg-[#1d1d1f]/80 backdrop-blur-2xl rounded-[10px] p-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5">
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="p-4 rounded-[10px] bg-primary/10">
            <Play className="h-10 w-10 fill-primary text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-center text-white">StreamShare Hub</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <Input
              type="email"
              placeholder="Adam@Von.Enterprises"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/5 border-white/10 h-12 text-center text-lg rounded-[10px] placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/20 text-white"
            />
            <Input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-white/5 border-white/10 h-12 text-center text-lg rounded-[10px] placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/20 text-white"
            />
          </div>

          {error && (
            <p className="text-base text-destructive text-center font-medium">{error}</p>
          )}

          <Button type="submit" className="w-full text-lg h-12 rounded-[10px] font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-[1.01] active:scale-[0.99] bg-primary text-primary-foreground" disabled={loading}>
            {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-center text-base font-medium text-primary hover:underline underline-offset-4 transition-all"
        >
          {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </div>
    </div>
  );
}
