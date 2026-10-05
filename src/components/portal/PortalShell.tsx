import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { signOut as firebaseSignOut } from "firebase/auth";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { firebaseAuth, firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/integrations/firebase/config";
import { rowsWhere } from "@/integrations/firebase/db";
import { portalLinks, primaryRole } from "@/lib/portal";
import { shortDate } from "@/lib/prop3000";

export function PortalShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  /** Legacy prop from the old shell. Ignored: the role chip now comes from the signed-in user. Removed per screen in S7. */
  badge?: string;
  children: ReactNode;
}) {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const links = portalLinks(roles);
  const role = roles.length > 0 ? primaryRole(roles) : null;
  const fullName = user?.displayName?.trim() ?? "";

  async function signOut() {
    await firebaseSignOut(firebaseAuth());
    queryClient.clear();
    void navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary-deep text-on-navy">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4">
          <Link
            to="/"
            aria-label="Prop3000 home"
            className="font-display text-2xl font-bold uppercase leading-none tracking-wide text-on-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            PROP<span className="text-accent">3000</span>
          </Link>
          {role && (
            <span className="text-label rounded-sm bg-accent px-2.5 py-1 text-[11px] text-accent-foreground">
              {role}
            </span>
          )}
          {user && (
            <p className="min-w-0 truncate text-sm text-on-navy-muted">
              {fullName ? `${fullName} · ` : ""}
              {user.email}
            </p>
          )}
          <div className="ml-auto flex items-center gap-2">
            <AlertsMenu userId={user?.uid} />
            <button
              type="button"
              onClick={() => void signOut()}
              className="font-display rounded-sm border border-navy-hairline px-4 py-2 text-sm font-bold uppercase tracking-wide text-on-navy transition-colors hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sign out
            </button>
          </div>
        </div>

        <nav aria-label="Portal sections" className="mx-auto max-w-7xl overflow-x-auto px-4">
          <ul className="flex gap-1">
            {links.map((link) => (
              <li key={`${link.to}#${link.hash ?? ""}`}>
                <Link
                  to={link.to}
                  hash={link.hash ?? ""}
                  activeOptions={{ exact: true, includeHash: true }}
                  className="font-display inline-block whitespace-nowrap border-b-[3px] px-4 py-3 text-base font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  activeProps={{ className: "border-accent bg-primary text-on-navy" }}
                  inactiveProps={{ className: "border-transparent text-on-navy-muted hover:text-on-navy" }}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-display text-[38px] uppercase leading-none text-foreground">{title}</h1>
        <p className="mt-2 text-muted-foreground">{subtitle}</p>
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}

function AlertsMenu({ userId }: { userId: string | undefined }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const unread = useQuery({
    queryKey: ["notifications", userId, "unread"],
    enabled: !!userId,
    queryFn: async () => {
      const snapshot = await getCountFromServer(
        query(
          collection(firestore(), COLLECTIONS.notifications),
          where("user_id", "==", userId!),
          where("read", "==", false),
        ),
      );
      return snapshot.data().count;
    },
  });

  const list = useQuery({
    queryKey: ["notifications", userId, "list"],
    enabled: !!userId && open,
    queryFn: async () => (await rowsWhere("notifications", "user_id", userId!)).slice(0, 20),
  });

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const count = unread.data ?? 0;
  const items = list.data ?? [];

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={count > 0 ? `Alerts, ${count} unread` : "Alerts"}
        onClick={() => setOpen((value) => !value)}
        className="font-display flex items-center gap-2 rounded-sm border border-navy-hairline px-4 py-2 text-sm font-bold uppercase tracking-wide text-on-navy transition-colors hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Alerts
        {count > 0 && (
          <span
            aria-hidden="true"
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brick px-1.5 text-xs text-brick-foreground"
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-sm border border-border bg-card text-foreground shadow-panel"
        >
          <p className="text-label border-b border-border px-4 py-3 text-[11px] text-ink-subtle">Alerts</p>
          {list.isLoading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No alerts yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className="flex gap-3 px-4 py-3">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read ? "bg-divider" : "bg-accent"}`}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {item.title}
                      {!item.read && <span className="sr-only"> (unread)</span>}
                    </p>
                    {item.body && <p className="text-sm text-muted-foreground">{item.body}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{shortDate(item.created_at)} · Email + in-app</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
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