import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  tokenError: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  tokenError: null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    let listenerFired = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      listenerFired = true;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === "TOKEN_REFRESHED") {
        setTokenError(null);
      } else if (event === "SIGNED_OUT") {
        setTokenError(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!listenerFired) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
      if (error) {
        setTokenError(error.message);
      }
    });

    // Proactively detect expired sessions
    const interval = setInterval(async () => {
      const { data: { session: current }, error } = await supabase.auth.getSession();
      if (error) {
        setTokenError(error.message);
      } else if (!current) {
        // Use functional update to check if user was previously set
        setUser((prev) => {
          if (prev) {
            setTokenError("Session expired. Please sign in again.");
            setSession(null);
          }
          return null;
        });
      }
    }, 60_000);

    // Sync auth state across browser tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.includes("supabase") && e.key?.includes("auth")) {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          setSession(s);
          setUser(s?.user ?? null);
        });
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, tokenError, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
