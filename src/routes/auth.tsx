import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";

import { doc, setDoc } from "firebase/firestore";

import { firebaseAuth, firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/integrations/firebase/config";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";

/** Firebase errors read like "Firebase: Error (auth/invalid-credential)."; show people something plainer. */
function authErrorMessage(error: unknown, fallback: string): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don't match an account.";
    case "auth/email-already-in-use":
      return "An account with that email already exists. Sign in instead.";
    case "auth/weak-password":
      return "Choose a password of at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/network-request-failed":
      return "No connection. Check your internet and try again.";
    default:
      return fallback;
  }
}

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

    try {
      const auth = firebaseAuth();

      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );

        if (fullName.trim()) {
          await updateProfile(credential.user, {
            displayName: fullName.trim(),
          });
          // useAuth creates the profile as soon as the account exists, which can be before the name
          // is set above, so store the name on the profile here too. Merging makes the order irrelevant.
          await setDoc(
            doc(firestore(), COLLECTIONS.profiles, credential.user.uid),
            { full_name: fullName.trim() },
            { merge: true },
          );
        }

        toast.success("Account created.");
        navigate({ to: "/dashboard" });
        return;
      }

      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      await navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(authErrorMessage(error, "Authentication failed."));
    } finally {
      setBusy(false);
    }
  }

  async function demoLogin(demoEmail: string) {
    setBusy(true);

    try {
      await signInWithEmailAndPassword(
        firebaseAuth(),
        demoEmail,
        DEMO_PASSWORD,
      );
      await navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(authErrorMessage(error, "Demo sign-in failed."));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);

    try {
      const provider = new GoogleAuthProvider();

      await signInWithPopup(
        firebaseAuth(),
        provider,
      );

      navigate({ to: "/dashboard" });
    } catch {
      toast.error("Google sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteLayout>
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <h1 className="text-display text-5xl uppercase text-foreground">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Staff and clients use the same door — your role decides where you land.
        </p>

        <div className="mt-6 rounded-sm border border-border border-t-[5px] border-t-primary bg-card p-6 shadow-panel">
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="a_name" className="text-label text-[11px]">
                  Full name
                </Label>
                <Input
                  id="a_name"
                  required
                  maxLength={120}
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="a_email" className="text-label text-[11px]">
                Email
              </Label>
              <Input
                id="a_email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@prop3000.demo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a_pass" className="text-label text-[11px]">
                Password
              </Label>
              <Input
                id="a_pass"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="font-display w-full font-bold uppercase tracking-wide"
              disabled={busy}
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {mode === "signin" ? "Sign in" : "Sign up"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="font-display w-full bg-card font-bold uppercase tracking-wide"
              disabled={busy}
              onClick={() => void google()}
            >
              Continue with Google
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-divider" aria-hidden="true" />
            <h2 className="text-label text-[11px] text-ink-subtle">Demo accounts</h2>
            <span className="h-px flex-1 bg-divider" aria-hidden="true" />
          </div>

          <ul className="mt-4 space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void demoLogin(account.email)}
                  className="flex w-full items-center justify-between gap-3 rounded-sm border border-border border-l-4 border-l-accent bg-background px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="font-display block text-xl font-bold uppercase leading-tight text-foreground">
                      {account.name}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">{account.email}</span>
                  </span>
                  <span className="font-display flex shrink-0 items-center gap-1 font-bold uppercase text-primary">
                    {account.role}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-sm text-muted-foreground">
            All demo accounts use the password{" "}
            <span className="font-semibold text-foreground">{DEMO_PASSWORD}</span>.
          </p>
        </div>
      </div>
    </SiteLayout>
  );
}