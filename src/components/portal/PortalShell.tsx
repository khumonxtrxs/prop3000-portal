import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useAuth } from "@/hooks/useAuth";
import { portalLinks } from "@/lib/portal";


export function PortalShell({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle: string;
  badge: string;
  children: ReactNode;
}) {
  const { roles } = useAuth();
  const links = portalLinks(roles);

  return (
    <SiteLayout>
      <div className="border-b border-border bg-primary-deep/95">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent">
            {badge}
          </span>
          <h1 className="text-display mt-3 text-4xl text-primary-foreground">{title}</h1>
          <p className="mt-2 max-w-2xl text-primary-foreground/70">{subtitle}</p>
          <nav className="mt-6 flex flex-wrap gap-2">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-full border border-primary-foreground/25 px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary-foreground/75 transition-colors hover:bg-primary-foreground/10"
                activeProps={{ className: "bg-accent text-accent-foreground border-accent" }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-10">{children}</div>
    </SiteLayout>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-panel">
      <Icon className="size-5 text-accent" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-display mt-1 text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}


export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-display text-2xl">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">{children}</p>;
}
