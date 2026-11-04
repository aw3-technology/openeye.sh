import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { authClient, type SessionUser } from "@/lib/auth-client";

const DEMO_USER_KEY = "openeye_demo_user";

/**
 * App-facing user shape. Mirrors the Supabase `User` fields the UI was built
 * against, mapped from the Better Auth session.
 */
export interface AppUser {
  id: string;
  email: string;
  created_at: string;
  user_metadata: { full_name?: string; avatar_url?: string };
  app_metadata: { provider?: string };
}

const DEMO_USER: AppUser = {
  id: "demo-user-000",
  email: "demo@openeye.sh",
  user_metadata: { full_name: "Demo User", avatar_url: "" },
  app_metadata: { provider: "demo" },
  created_at: new Date().toISOString(),
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isDemo: boolean;
  signOut: () => Promise<void>;
  signInAsDemo: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isDemo: false,
  signOut: async () => {},
  signInAsDemo: () => {},
});

function toAppUser(u: SessionUser): AppUser {
  return {
    id: u.id,
    email: u.email,
    created_at: new Date(u.createdAt).toISOString(),
    user_metadata: { full_name: u.name || undefined, avatar_url: u.image || undefined },
    app_metadata: {},
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: sessionData, isPending } = authClient.useSession();
  const [isDemo, setIsDemo] = useState(() => localStorage.getItem(DEMO_USER_KEY) === "true");

  const signInAsDemo = () => {
    localStorage.setItem(DEMO_USER_KEY, "true");
    setIsDemo(true);
  };

  useEffect(() => {
    // Sync demo mode across browser tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === DEMO_USER_KEY) setIsDemo(e.newValue === "true");
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const signOut = async () => {
    try {
      await authClient.signOut();
    } catch {
      // Sign out even if the API call fails
    }
    localStorage.removeItem(DEMO_USER_KEY);
    setIsDemo(false);
  };

  const user = isDemo ? DEMO_USER : sessionData?.user ? toAppUser(sessionData.user) : null;
  const loading = isDemo ? false : isPending;

  return (
    <AuthContext.Provider value={{ user, loading, isDemo, signOut, signInAsDemo }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
