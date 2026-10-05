import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { firebaseAuth, firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/integrations/firebase/config";
import { nowIso } from "@/integrations/firebase/db";

export type AppRole = "admin" | "owner" | "supervisor" | "agent" | "client";

type AuthValue = {
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  isStaff: boolean;
  isOffice: boolean;
  isAgent: boolean;
  isSupervisor: boolean;
  hasRole: (role: AppRole) => boolean;
  refreshRoles: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

/**
 * Reads user_roles/{uid} ({ roles: [...] }). A first sign-in has no document yet, so this creates the
 * profile and the client role, which the Supabase handle_new_user() trigger used to do. The rules only
 * let a user create their own role document with exactly ["client"]; staff roles come from the office.
 */
async function loadOrCreateRoles(user: User): Promise<AppRole[]> {
  const db = firestore();
  const roleRef = doc(db, COLLECTIONS.userRoles, user.uid);
  const snapshot = await getDoc(roleRef);
  if (snapshot.exists()) return (snapshot.data()["roles"] ?? []) as AppRole[];

  const now = nowIso();
  await setDoc(doc(db, COLLECTIONS.profiles, user.uid), {
    full_name: user.displayName,
    email: user.email,
    phone: user.phoneNumber,
    created_at: now,
    updated_at: now,
  });
  await setDoc(roleRef, { roles: ["client"] });
  return ["client"];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = useCallback(async (nextUser: User | null) => {
    setRoles(nextUser ? await loadOrCreateRoles(nextUser) : []);
  }, []);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth(), async (nextUser) => {
      // Back to loading until this user's roles arrive, so nothing (e.g. the /dashboard redirect)
      // acts on the previous user's roles, or on none, when switching accounts.
      setLoading(true);
      setUser(nextUser);
      try {
        await loadRoles(nextUser);
      } catch (error) {
        console.error("[auth] could not load roles", error);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    });
  }, [loadRoles]);

  const value = useMemo<AuthValue>(() => {
    const isStaff = roles.some((r) => r === "admin" || r === "owner" || r === "supervisor" || r === "agent");
    return {
      user,
      roles,
      loading,
      isStaff,
      isOffice: roles.some((r) => r === "admin" || r === "owner"),
      isAgent: roles.some((r) => r === "admin" || r === "owner" || r === "agent"),
      isSupervisor: roles.includes("supervisor"),
      hasRole: (role) => roles.includes(role),
      refreshRoles: () => loadRoles(user),
    };
  }, [user, roles, loading, loadRoles]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
