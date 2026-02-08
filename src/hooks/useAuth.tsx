import { useState, useCallback } from "react";
import { authApi, ApiUser } from "../lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function useAuth() {
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  const { data, isLoading: loading, error } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        const result = await authApi.me();
        return { user: result.user, roles: result.roles };
      } catch {
        return { user: null, roles: [] };
      }
    },
    staleTime: 120000, // 2 minutes - auth state is fresh for 2 min
    gcTime: 600000, // 10 minutes
    retry: false, // Don't retry auth failures
  });

  const user = data?.user ?? null;
  const roles = data?.roles ?? [];

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const result = await authApi.signIn(email, password);
      // Update the cache immediately
      queryClient.setQueryData(["auth", "me"], { user: result.user, roles: result.roles });
      window.location.href = '/';
      return { error: null as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  }, [queryClient]);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const result = await authApi.signUp(email, password);
      queryClient.setQueryData(["auth", "me"], { user: result.user, roles: result.roles });
      window.location.href = '/';
      return { error: null as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  }, [queryClient]);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    await authApi.signOut();
    queryClient.setQueryData(["auth", "me"], { user: null, roles: [] });
    queryClient.clear(); // Clear all cached data on logout
    window.location.href = '/';
  }, [queryClient]);

  return { user, roles, loading: loading || signingOut, signIn, signUp, signOut };
}
