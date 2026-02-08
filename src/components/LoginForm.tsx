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
    <div className="flex min-h-screen items-center justify-center p-4 font-sans">
      <div className="w-full max-w-[480px] space-y-8 bg-[#1d1d1f]/80 rounded-[10px] p-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5">
        <div className="flex items-center justify-center gap-4">
          <div className="p-3 rounded-[10px] bg-primary/10">
            <Play className="h-6 w-6 fill-primary text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white m-0">StreamShare Hub</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <Input
              type="email"
              placeholder="bruce@wayne.dev"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/5 border-white/10 h-12 text-center text-sm rounded-[10px] placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/20 text-white"
            />
            <Input
              type="password"
              placeholder="Your secret password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-white/5 border-white/10 h-12 text-center text-sm rounded-[10px] placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/20 text-white"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive text-center font-medium">{error}</p>
          )}

          <div className="flex flex-col gap-6">
            <div className={`transition-all duration-500 ease-in-out ${email.includes('@') ? 'opacity-100 translate-y-0 h-12 visible' : 'opacity-0 -translate-y-4 h-0 invisible'}`}>
              <Button
                type="submit"
                className="w-full text-sm h-12 rounded-[10px] font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-[1.01] active:scale-[0.99] bg-primary text-primary-foreground"
                disabled={loading}
              >
                {loading ? "Loading..." : isSignUp ? "Create Account" : "Login"}
              </Button>
            </div>

            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full text-center text-sm font-medium text-primary hover:underline underline-offset-4 transition-all"
            >
              {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
