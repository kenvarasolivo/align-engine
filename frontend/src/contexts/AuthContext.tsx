import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { authEnabled, supabase } from "../lib/supabase";

const GUEST_FLAG = "align_guest";

interface SignUpOutcome {
  error: string | null;
  needsConfirmation: boolean;
}

interface AuthContextValue {
  /** False when Supabase env vars are missing — app runs guest-only. */
  authEnabled: boolean;
  /** True while the initial session is being restored. */
  initializing: boolean;
  session: Session | null;
  user: User | null;
  isGuest: boolean;
  continueAsGuest: () => void;
  /** Leave guest mode and show the login page again. */
  exitGuest: () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<SignUpOutcome>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(authEnabled);
  const [isGuest, setIsGuest] = useState(
    () => !authEnabled || localStorage.getItem(GUEST_FLAG) === "1"
  );

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const continueAsGuest = () => {
    localStorage.setItem(GUEST_FLAG, "1");
    setIsGuest(true);
  };

  const exitGuest = () => {
    localStorage.removeItem(GUEST_FLAG);
    setIsGuest(false);
  };

  const signIn = async (email: string, password: string): Promise<string | null> => {
    if (!supabase) return "Authentication is not configured.";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    localStorage.removeItem(GUEST_FLAG);
    setIsGuest(false);
    return null;
  };

  const signUp = async (email: string, password: string): Promise<SignUpOutcome> => {
    if (!supabase) return { error: "Authentication is not configured.", needsConfirmation: false };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message, needsConfirmation: false };
    // When email confirmation is enabled, no session is returned until the
    // user clicks the link in their inbox.
    if (!data.session) return { error: null, needsConfirmation: true };
    localStorage.removeItem(GUEST_FLAG);
    setIsGuest(false);
    return { error: null, needsConfirmation: false };
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        authEnabled,
        initializing,
        session,
        user: session?.user ?? null,
        isGuest,
        continueAsGuest,
        exitGuest,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
