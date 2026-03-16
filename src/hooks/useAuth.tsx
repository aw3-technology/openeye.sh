import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

const DEMO_USER_KEY = "openeye_demo_user";

const DEMO_USER = {
  id: "demo-user-000",
  email: "demo@openeye.sh",
  user_metadata: { full_name: "Demo User", avatar_url: "" },
  app_metadata: { provider: "demo" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
} as unknown as User;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  tokenError: string | null;
  isDemo: boolean;
  signOut: () => Promise<void>;
  signInAsDemo: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  tokenError: null,
  isDemo: false,
  signOut: async () => {},
  signInAsDemo: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const signInAsDemo = () => {
    localStorage.setItem(DEMO_USER_KEY, "true");
    setUser(DEMO_USER);
    setSession(null);
    setLoading(false);
  };

  useEffect(() => {
    // Restore demo session from localStorage
    if (localStorage.getItem(DEMO_USER_KEY) === "true") {
      setUser(DEMO_USER);
      setLoading(false);
      return;
    }

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
      if (localStorage.getItem(DEMO_USER_KEY) === "true") return;
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
      if (e.key === DEMO_USER_KEY) {
        if (e.newValue === "true") {
          setUser(DEMO_USER);
        } else {
          setUser(null);
          setSession(null);
        }
        return;
      }
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
    localStorage.removeItem(DEMO_USER_KEY);
    setUser(null);
    setSession(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, tokenError, isDemo: localStorage.getItem(DEMO_USER_KEY) === "true", signOut, signInAsDemo }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
