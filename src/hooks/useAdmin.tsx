import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";

export function useAdmin() {
  const { user, roles, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(roles.includes("admin"));
    setLoading(false);
  }, [user, roles, authLoading]);

  return { isAdmin, loading };
}
