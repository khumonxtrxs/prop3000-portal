import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useAuth } from "@/hooks/useAuth";
import { firebaseAuth } from "@/integrations/firebase/client";
import { roleHome } from "@/lib/portal";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Prop3000 Portal — Your Dashboard" },
      { name: "description", content: "Sign-in landing that sends each Prop3000 role to its own dashboard." },
      { property: "og:title", content: "Prop3000 portal" },
      { property: "og:description", content: "Role-aware entry point for the Prop3000 portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardRedirect,
});

function DashboardRedirect() {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();
  // Right after a sign-in, Firebase knows the new user a moment before useAuth does. Wait until
  // they agree, or the redirect would use the previous user's roles (or none) and land on /client.
  const signedInUid = firebaseAuth().currentUser?.uid ?? null;
  const ready = !loading && user?.uid === signedInUid;

  useEffect(() => {
    if (!ready) return;
    void navigate({ to: roleHome(roles), replace: true });
  }, [ready, roles, navigate]);

  return (
    <SiteLayout>
      <div className="px-4 py-32 text-center">
        <Loader2 className="mx-auto size-6 animate-spin text-accent" />
        <p className="mt-4 text-sm text-muted-foreground">Opening your dashboard…</p>
      </div>
    </SiteLayout>
  );
}
