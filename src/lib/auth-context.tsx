"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase";

type AuthState = {
  user: User | null;
  /** True until Firebase has restored (or rejected) the persisted session. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Fresh ID token for Authorization headers on /api/* calls. */
  getToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Touching Firebase here rather than at module scope keeps it out of the
    // server prerender, where the SDK has no config and no reason to run.
    const auth = getFirebaseAuth();

    // Fires once with the restored session, then on every change. Until it
    // fires we hold `loading`, so a refresh never flashes the login screen.
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(getFirebaseAuth());
  }, []);

  const getToken = useCallback(
    async () => getFirebaseAuth().currentUser?.getIdToken() ?? null,
    [],
  );

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, signOut, getToken }),
    [user, loading, signIn, signOut, getToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
