import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappLink } from "@/lib/prop3000";

/** Shared layout for the three public forms (S3): eyebrow, H1, intro, then the fields. */
export function FormShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[820px] px-4 py-14">
      <p className="text-label text-[12px] text-ink-subtle">{eyebrow}</p>
      <h1 className="text-display mt-3 text-5xl uppercase text-foreground sm:text-6xl">{title}</h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">{intro}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

/** Label + control + inline error, wired with aria-describedby. */
export function FormField({
  id,
  label,
  error,
  children,
  className = "",
}: {
  id: string;
  label: string;
  error?: string | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-label mb-2 block text-[12px] text-ink-subtle">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-semibold text-brick">
          Error: {error}
        </p>
      )}
    </div>
  );
}

/** Replaces the form after a successful submit (S3, step 6). */
export function ConfirmationCard({
  reference,
  nextStep,
  whatsappMessage,
}: {
  reference: string;
  nextStep: string;
  whatsappMessage: string;
}) {
  return (
    <div className="rounded-sm border border-border border-t-4 border-t-success bg-card p-8" role="status">
      <p className="text-label flex items-center gap-2 text-[12px] text-success">
        <CheckCircle2 className="size-4" aria-hidden="true" /> Submitted · Status new
      </p>
      <p className="text-display mt-3 text-4xl uppercase text-foreground">{reference}</p>
      <p className="mt-3 max-w-xl text-muted-foreground">{nextStep}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild variant="success" size="xl" className="font-display font-bold uppercase tracking-wide">
          <a href={whatsappLink(whatsappMessage)} target="_blank" rel="noreferrer">
            Send it on WhatsApp too
          </a>
        </Button>
        <Button asChild variant="outlineNavy" size="xl" className="font-display font-bold uppercase tracking-wide">
          <Link to="/client">Track it in my portal</Link>
        </Button>
      </div>
    </div>
  );
}

/** The reassurance line under every submit button. */
export function Reassurance() {
  return (
    <p className="text-sm font-semibold text-muted-foreground">No account needed · No agent fees · No obligation</p>
  );
}