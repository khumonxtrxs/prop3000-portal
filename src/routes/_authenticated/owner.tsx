import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Briefcase, Gavel, Loader2, TrendingUp } from "lucide-react";
import { CountBars, MoneyBars, StatusPie, TrendChart } from "@/components/portal/Charts";
import { Empty, Panel, PortalShell, StatCard } from "@/components/portal/PortalShell";
import { useAuth } from "@/hooks/useAuth";
import { allRows } from "@/integrations/firebase/db";
import { countBy, monthlySeries } from "@/lib/portal";
import { money, prettyStatus } from "@/lib/prop3000";

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({
    meta: [
      { title: "Owner Analytics — Prop3000 Portal" },
      {
        name: "description",
        content: "Whole-business analytics for Prop3000: pipeline value, job throughput, lead trends and offer conversion.",
      },
      { property: "og:title", content: "Prop3000 owner analytics" },
      { property: "og:description", content: "Pipeline value, job throughput and lead trends at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerDashboard,
});

function OwnerDashboard() {
  const { isOffice, loading } = useAuth();

  const data = useQuery({
    queryKey: ["owner-analytics"],
    enabled: isOffice,
    queryFn: async () => {
      const [jobs, requests, properties, offers, listings] = await Promise.all([
        allRows("jobs"),
        allRows("service_requests"),
        allRows("property_submissions"),
        allRows("offers"),
        allRows("listings"),
      ]);
      return { jobs, requests, properties, offers, listings };
    },
  });

  if (loading || data.isLoading) {
    return (
      <PortalShell badge="Owner" title="Business analytics" subtitle="Crunching the numbers…">
        <Loader2 className="mx-auto size-6 animate-spin text-accent" />
      </PortalShell>
    );
  }

  if (!isOffice) {
    return (
      <PortalShell badge="Owner" title="Owner view" subtitle="Reserved for the owner and admins.">
        <Empty>Ask an admin to grant you owner access.</Empty>
      </PortalShell>
    );
  }

  const rows = data.data!;
  const quoted = rows.jobs.reduce((s, j) => s + Number(j.quote_amount ?? 0), 0);
  const won = rows.jobs
    .filter((j) => j.status === "in_progress" || j.status === "complete")
    .reduce((s, j) => s + Number(j.quote_amount ?? 0), 0);
  const listingStock = rows.listings.reduce((s, l) => s + Number(l.price ?? 0), 0);
  const acquisitionSpend = rows.properties
    .filter((p) => p.status === "purchased")
    .reduce((s, p) => s + Number(p.offer_amount ?? 0), 0);
  const conversion = rows.requests.length
    ? Math.round((rows.requests.filter((r) => r.status === "converted").length / rows.requests.length) * 100)
    : 0;

  const tradeCounts = countBy(
    rows.jobs.flatMap((j) => j.service_types ?? []),
    (t) => t,
  );

  const revenueByStatus = ["quoted", "approved", "in_progress", "complete"].map((status) => ({
    name: prettyStatus(status),
    value: rows.jobs.filter((j) => j.status === status).reduce((s, j) => s + Number(j.quote_amount ?? 0), 0),
  }));

  return (
    <PortalShell
      badge="Owner / manager"
      title="Business analytics"
      subtitle="Read-only view of the whole business: what's in the pipeline, what's being built, and what the Investments side is holding."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Briefcase} label="Quoted pipeline" value={money(quoted)} hint={`${rows.jobs.length} jobs`} />
        <StatCard icon={TrendingUp} label="Work won" value={money(won)} hint={`${conversion}% lead conversion`} />
        <StatCard icon={Banknote} label="Listing stock value" value={money(listingStock)} hint={`${rows.listings.length} listings`} />
        <StatCard icon={Gavel} label="Acquisition spend" value={money(acquisitionSpend)} hint="Properties purchased" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Lead volume — last 6 months">
          <TrendChart data={monthlySeries([...rows.requests, ...rows.properties])} label="Leads" />
        </Panel>
        <Panel title="Quoted value by job stage">
          <MoneyBars data={revenueByStatus} />
        </Panel>
        <Panel title="Jobs by status">
          <StatusPie data={countBy(rows.jobs, (j) => j.status)} />
        </Panel>
        <Panel title="Offers by status">
          <StatusPie data={countBy(rows.offers, (o) => o.status)} />
        </Panel>
        <Panel title="Demand by trade">
          <CountBars data={tradeCounts} label="Jobs" />
        </Panel>
        <Panel title="Cash-sale pipeline stages">
          <CountBars data={countBy(rows.properties, (p) => p.status)} label="Properties" />
        </Panel>
      </div>
    </PortalShell>
  );
}
