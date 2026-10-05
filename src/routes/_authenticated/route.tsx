import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { onAuthStateChanged, type User } from "firebase/auth";
import { firebaseAuth } from "@/integrations/firebase/client";

function getCurrentFirebaseUser(): Promise<User | null> {
  const auth = firebaseAuth();

  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,

  beforeLoad: async () => {
    const user = await getCurrentFirebaseUser();

    if (!user) {
      throw redirect({ to: "/auth" });
    }

    return { user };
  },

  component: () => <Outlet />,
});
