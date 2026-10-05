import type { AppRole } from "@/hooks/useAuth";

export type PortalLink = { to: string; hash?: string; label: string };

/** Highest role wins when a user holds more than one. */
const ROLE_ORDER: AppRole[] = ["admin", "owner", "supervisor", "agent", "client"];

/** The single role the portal is shown as: drives the chip and the tabs. */
export function primaryRole(roles: AppRole[]): AppRole {
  return ROLE_ORDER.find((role) => roles.includes(role)) ?? "client";
}

/** Where each signed-in role lands after login. */
export function roleHome(roles: AppRole[]): string {
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("owner")) return "/owner";
  if (roles.includes("supervisor")) return "/supervisor";
  if (roles.includes("agent")) return "/agent";
  return "/client";
}

/** Portal tabs per role, exactly as listed in the team task doc (S6). */
const TABS: Record<AppRole, PortalLink[]> = {
  client: [
    { to: "/client", label: "My portal" },
    { to: "/offers", label: "My offers" },
  ],
  admin: [
    { to: "/admin", label: "Lead triage" },
    { to: "/admin", hash: "jobs", label: "Jobs" },
    { to: "/admin", hash: "bookings", label: "Bookings" },
  ],
  agent: [
    { to: "/agent", label: "Offer console" },
    { to: "/agent", hash: "listings", label: "Listings" },
  ],
  supervisor: [{ to: "/supervisor", label: "My jobs" }],
  owner: [
    { to: "/owner", label: "Analytics" },
    { to: "/owner", hash: "leads", label: "Leads" },
    { to: "/owner", hash: "offers", label: "Offers" },
    { to: "/owner", hash: "jobs", label: "Jobs" },
  ],
};

/** Portal tabs visible to a given set of roles. Each role sees only its own. */
export function portalLinks(roles: AppRole[]): PortalLink[] {
  return TABS[primaryRole(roles)];
}

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