import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import { seedDemoAccounts } from "@/lib/admin.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Portal Login — Prop3000" },
      { name: "description", content: "Sign in to the Prop3000 portal to track leads, jobs, quotes and bookings." },
      { property: "og:title", content: "Prop3000 portal login" },
      { property: "og:description", content: "Staff and client access to the Prop3000 lead-to-job portal." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: fullName.trim() } },
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data.session) {
        toast.success("Check your email to confirm your account.");
        return;
      }
      navigate({ to: "/dashboard" });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/dashboard" });
  }

  async function demoLogin(demoEmail: string) {
    setBusy(true);
    try {
      await seedDemoAccounts();
      const { error } = await supabase.auth.signInWithPassword({ email: demoEmail, password: DEMO_PASSWORD });
      if (error) {
        toast.error(error.message);
        return;
      }
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Demo sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error("Google sign-in failed. Please try again.");
    // On success the browser redirects to Google and returns here signed in.
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-md px-4 py-20">
        <h1 className="text-display text-4xl">{mode === "signin" ? "Portal login" : "Create your account"}</h1>
        <p className="mt-2 text-muted-foreground">Staff and clients use the same door — your view depends on your role.</p>

        <form onSubmit={submit} className="mt-8 space-y-4 rounded-xl border border-border bg-card p-6 shadow-panel">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="a_name">Full name</Label>
              <Input id="a_name" required maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="a_email">Email</Label>
            <Input id="a_email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="a_pass">Password</Label>
            <Input id="a_pass" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Sign up"}
          </Button>
          <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => void google()}>
            Continue with Google
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </form>

        <div className="mt-8 rounded-xl border border-dashed border-border p-6">
          <h2 className="text-display text-xl">Try each user story</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One click signs you in as that role so you can walk through its screens.
          </p>
          <div className="mt-4 space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                type="button"
                variant="outline"
                className="h-auto w-full flex-col items-start py-3 text-left"
                disabled={busy}
                onClick={() => void demoLogin(account.email)}
              >
                <span className="font-bold uppercase tracking-wide">{account.role}</span>
                <span className="text-xs font-normal text-muted-foreground">{account.blurb}</span>
              </Button>
            ))}
          </div>
        </div>

      </div>
    </SiteLayout>
  );
}
