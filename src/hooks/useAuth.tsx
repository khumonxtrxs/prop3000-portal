import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
// import type { Session, User } from "@supabase/supabase-js";
// import { supabase } from "@/integrations/supabase/client";

import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  firebaseAuth,
  firestore,
} from "@/integrations/firebase/client";

import {
  COLLECTIONS,
} from "@/integrations/firebase/config";

export type AppRole = "admin" | "owner" | "supervisor" | "agent" | "client";

type AuthValue = {
  // session: Session | null;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  // const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  // const loadRoles = useCallback(async (userId: string | undefined) => {
  //   if (!userId) {
  //     setRoles([]);
  //     return;
  //   }
  //   const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  //   setRoles((data ?? []).map((r) => r.role as AppRole));
  // }, []);

  const loadRoles = useCallback(async (userId?: string) => {
    if (!userId) {
      setRoles([]);
      return;
    }

    const roleRef = doc(
      firestore(),
      COLLECTIONS.userRoles,
      userId,
    );

    const snapshot = await getDoc(roleRef);

    if (!snapshot.exists()) {
      setRoles([]);
      return;
    }

    const data = snapshot.data();

    // setRoles(
    //   data.role
    //     ? [data.role as AppRole]
    //     : [],
    // );
    
    setRoles(
      data["role"]
        ? [data["role"] as AppRole]
        : [],
    );
  }, []);

  // useEffect(() => {
  //   let active = true;

  //   const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
  //     if (!active) return;
  //     setSession(nextSession);
  //     void loadRoles(nextSession?.user?.id);
  //   });

  //   void supabase.auth.getSession().then(({ data }) => {
  //     if (!active) return;
  //     setSession(data.session);
  //     void loadRoles(data.session?.user?.id).finally(() => setLoading(false));
  //   });

  //   return () => {
  //     active = false;
  //     sub.subscription.unsubscribe();
  //   };
  // }, [loadRoles]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      firebaseAuth(),
      async (nextUser) => {
        setUser(nextUser);

        try {
          await loadRoles(nextUser?.uid);
        } finally {
          setLoading(false);
        }
      },
    );

    return unsubscribe;
  }, [loadRoles]);

  const value = useMemo<AuthValue>(() => {
    const isStaff = roles.some((r) => r === "admin" || r === "owner" || r === "supervisor" || r === "agent");
    return {
      // session,
      // user: session?.user ?? null,
      user,
      refreshRoles: () => loadRoles(user?.uid),
      roles,
      loading,
      isStaff,
      isOffice: roles.some((r) => r === "admin" || r === "owner"),
      isAgent: roles.some((r) => r === "admin" || r === "owner" || r === "agent"),
      isSupervisor: roles.includes("supervisor"),
      hasRole: (role) => roles.includes(role),
    };
    // }, [session, roles, loading, loadRoles]);
  }, [user, roles, loading, loadRoles]);


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
