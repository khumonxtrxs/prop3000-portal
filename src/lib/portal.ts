import type { AppRole } from "@/hooks/useAuth";

export type PortalLink = { to: string; label: string };

/** Where each signed-in role lands after login. */
export function roleHome(roles: AppRole[]): string {
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("owner")) return "/owner";
  if (roles.includes("supervisor")) return "/supervisor";
  if (roles.includes("agent")) return "/agent";
  return "/client";
}

/** Portal tabs visible to a given set of roles. */
export function portalLinks(roles: AppRole[]): PortalLink[] {
  const links: PortalLink[] = [];
  if (roles.includes("admin") || roles.includes("owner")) links.push({ to: "/admin", label: "Office" });
  if (roles.includes("owner") || roles.includes("admin")) links.push({ to: "/owner", label: "Owner analytics" });
  if (roles.includes("supervisor") || roles.includes("admin") || roles.includes("owner"))
    links.push({ to: "/supervisor", label: "Site supervisor" });
  if (roles.includes("agent") || roles.includes("admin") || roles.includes("owner"))
    links.push({ to: "/agent", label: "Agent console" });
  links.push({ to: "/client", label: "My portal" });
  links.push({ to: "/offers", label: "My offers" });
  return links;
}

export const STATUS_TONE: Record<string, string> = {
  new: "bg-secondary text-foreground",
  contacted: "bg-accent/15 text-accent",
  quoted: "bg-brick/15 text-brick",
  approved: "bg-accent/20 text-accent",
  in_progress: "bg-accent/20 text-accent",
  converted: "bg-accent/20 text-accent",
  complete: "bg-accent/25 text-accent",
  declined: "bg-destructive/15 text-destructive",
  cancelled: "bg-destructive/15 text-destructive",
  on_hold: "bg-muted text-muted-foreground",
};

/** Groups rows into { name, value } counts for charts. */
export function countBy<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value }));
}

type DateLike =
  | string
  | Date
  | {
    toDate?: () => Date;
    toMillis?: () => number;
  };

/** Last `months` month buckets with a count of rows created in each. */
export function monthlySeries<T extends { created_at: DateLike }>(
  rows: T[],
  months = 6,
) {
  const buckets: { name: string; value: number; key: string }[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);

    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      name: d.toLocaleDateString("en-ZA", { month: "short" }),
      value: 0,
    });
  }

  for (const row of rows) {
    let d: Date;

    if (row.created_at instanceof Date) {
      d = row.created_at;
    } else if (typeof row.created_at === "string") {
      d = new Date(row.created_at);
    } else if (typeof row.created_at?.toDate === "function") {
      d = row.created_at.toDate();
    } else if (typeof row.created_at?.toMillis === "function") {
      d = new Date(row.created_at.toMillis());
    } else {
      continue;
    }

    const bucket = buckets.find(
      (b) => b.key === `${d.getFullYear()}-${d.getMonth()}`,
    );

    if (bucket) {
      bucket.value += 1;
    }
  }

  return buckets;
}
