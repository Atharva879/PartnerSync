import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";

import { firebaseAuth } from "@/lib/firebase";
import { ensureFirebaseUserProfile } from "@/lib/firebase-repository";

export type FirebaseIdentity = Pick<User, "uid" | "email" | "displayName" | "emailVerified">;

type FirebaseAuthContextValue = {
  user: FirebaseIdentity | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
};

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | null>(null);

function toIdentity(user: User | null): FirebaseIdentity | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
  };
}

export function FirebaseAuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<FirebaseIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(toIdentity(nextUser));
      setLoading(false);
      if (nextUser) {
        void ensureFirebaseUserProfile(nextUser).catch((error) => {
          console.error("Unable to initialize the Firebase profile:", error);
        });
      }
    });
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(firebaseAuth, email.trim());
  }, []);

  const logout = useCallback(async () => {
    await signOut(firebaseAuth);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signInWithEmail, signUpWithEmail, resetPassword, logout }),
    [loading, logout, resetPassword, signInWithEmail, signUpWithEmail, user],
  );

  return <FirebaseAuthContext.Provider value={value}>{children}</FirebaseAuthContext.Provider>;
}

export function useFirebaseAuth() {
  const context = useContext(FirebaseAuthContext);
  if (!context) {
    throw new Error("useFirebaseAuth must be used within FirebaseAuthProvider");
  }
  return context;
}
