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

  // Usage analytics (Viziera): tie page views and errors to the signed-in user.
  // The shared demo account is left anonymous so its visitors aren't merged.
  const sessionUser = isDemo ? null : sessionData?.user ?? null;
  useEffect(() => {
    if (isPending) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = () => {
      const v = (window as unknown as { viziera?: { identify(id: string, t?: Record<string, unknown>): void; reset(): void } }).viziera;
      if (!v) {
        if (++tries < 20) timer = setTimeout(apply, 500);
        return;
      }
      if (sessionUser) v.identify(sessionUser.id, { email: sessionUser.email, name: sessionUser.name || undefined, created_at: new Date(sessionUser.createdAt).toISOString() });
      else v.reset();
    };
    apply();
    return () => clearTimeout(timer);
  }, [sessionUser?.id, isPending]);

  return (
    <AuthContext.Provider value={{ user, loading, isDemo, signOut, signInAsDemo }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
