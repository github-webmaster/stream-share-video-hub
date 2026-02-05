import { useEffect, useState } from "react";
import { authApi, ApiUser } from "../lib/api";

export function useAuth() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    authApi
      .me()
      .then(({ user: currentUser, roles: currentRoles }) => {
        if (!isMounted) return;
        setUser(currentUser);
        setRoles(currentRoles);
      })
      .catch(() => {
        if (!isMounted) return;
        setUser(null);
        setRoles([]);
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const result = await authApi.signIn(email, password);
      setUser(result.user);
      setRoles(result.roles);
      window.location.href = '/';
      return { error: null as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const result = await authApi.signUp(email, password);
      setUser(result.user);
      setRoles(result.roles);
      window.location.href = '/';
      return { error: null as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await authApi.signOut();
    setUser(null);
    setRoles([]);
    window.location.href = '/';
  };

  return { user, roles, loading, signIn, signUp, signOut };
}
