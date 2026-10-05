import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { LeadTrendBars, StageBars, StatusDonut, TradeBars } from "@/components/portal/Charts";
import { Empty, PortalShell, StatCard } from "@/components/portal/PortalShell";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { countBy, monthlySeries } from "@/lib/portal";
import { money, prettyStatus, shortDate } from "@/lib/prop3000";
import { STATUS_BORDER_LEFT, statusTone, type StatusTone } from "@/lib/status";

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

const BORDER_TOP: Record<StatusTone, string> = {
  wait: "border-t-status-wait-foreground",
  motion: "border-t-status-motion-foreground",
  good: "border-t-status-good-foreground",
  bad: "border-t-status-bad-foreground",
  neutral: "border-t-status-neutral-foreground",
};

const PANEL = "rounded-sm border border-border bg-card p-6";
const PANEL_TITLE = "text-display text-2xl uppercase text-foreground";

/** Owner is read-only: this page contains no mutation controls at all (S7). */
function OwnerDashboard() {
  const { isOffice, loading } = useAuth();

  const data = useQuery({
    queryKey: ["owner-analytics"],
    enabled: isOffice,
    queryFn: async () => {
      const [jobs, requests, properties, offers, listings, history] = await Promise.all([
        supabase.from("jobs").select("*").order("created_at", { ascending: false }),
        supabase.from("service_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("property_submissions").select("id, status, offer_amount, created_at"),
        supabase
          .from("offers")
          .select(
            "id, reference, amount, status, counter_amount, message, client_name, client_phone, client_email, created_at, listings(reference, title, suburb, price), offer_events(id, status, amount, note, created_at)",
          )
          .order("created_at", { ascending: false }),
        supabase.from("listings").select("id, status, price"),
        supabase
          .from("job_status_history")
          .select("id, job_id, status, note, created_at")
          .order("created_at", { ascending: true }),
      ]);
      const firstError =
        jobs.error ?? requests.error ?? properties.error ?? offers.error ?? listings.error ?? history.error;
      if (firstError) throw firstError;
      return {
        jobs: jobs.data ?? [],
        requests: requests.data ?? [],
        properties: properties.data ?? [],
        offers: offers.data ?? [],
        listings: listings.data ?? [],
        history: history.data ?? [],
      };
    },
  });

  if (loading || (isOffice && data.isLoading)) {
    return (
      <PortalShell title="Business summary" subtitle="Crunching the numbers…">
        <Loader2 className="mx-auto size-6 animate-spin text-accent" aria-label="Loading" />
      </PortalShell>
    );
  }

  if (!isOffice || !data.data) {
    return (
      <PortalShell title="Owner view" subtitle="Reserved for the owner and admins.">
        <Empty>Ask an admin to grant you owner access.</Empty>
      </PortalShell>
    );
  }

  const rows = data.data;
  const sum = (values: (number | string | null)[]) => values.reduce<number>((total, v) => total + Number(v ?? 0), 0);

  const quotedJobs = rows.jobs.filter((j) => j.status === "quoted");
  const wonJobs = rows.jobs.filter((j) => ["approved", "in_progress", "complete"].includes(j.status));
  const published = rows.listings.filter((l) => l.status === "published");
  const purchased = rows.properties.filter((p) => p.status === "purchased");
  const conversion = rows.requests.length
    ? Math.round((rows.requests.filter((r) => r.status === "converted").length / rows.requests.length) * 100)
    : 0;

  const stages = ["quoted", "approved", "in_progress", "complete"].map((status) => ({
    status,
    value: sum(rows.jobs.filter((j) => j.status === status).map((j) => j.quote_amount)),
  }));
  const trades = countBy(
    rows.jobs.flatMap((j) => j.service_types ?? []),
    (t) => t,
  )
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const activeJobs = rows.jobs.filter((j) => j.status === "in_progress").length;

  return (
    <PortalShell title="Business summary" subtitle="Read-only analytics across both divisions.">
      {/* Analytics */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
        <StatCard
          tone="primary"
          label="Quoted pipeline"
          value={money(sum(quotedJobs.map((j) => j.quote_amount)))}
          hint={`${quotedJobs.length} job${quotedJobs.length === 1 ? "" : "s"} awaiting client approval`}
        />
        <StatCard
          tone="success"
          label="Work won"
          value={money(sum(wonJobs.map((j) => j.quote_amount)))}
          hint={`${conversion}% lead conversion`}
        />
        <StatCard
          tone="accent"
          label="Listing stock value"
          value={money(sum(published.map((l) => l.price)))}
          hint={`${published.length} published listing${published.length === 1 ? "" : "s"}`}
        />
        <StatCard
          tone="brick"
          label="Acquisition spend"
          value={money(sum(purchased.map((p) => p.offer_amount)))}
          hint={`${purchased.length} propert${purchased.length === 1 ? "y" : "ies"} bought`}
        />
      </div>

      <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-start gap-4">
        <section className={PANEL} aria-labelledby="trend-heading">
          <h2 id="trend-heading" className={PANEL_TITLE}>
            Lead trend · 6 months
          </h2>
          <div className="mt-4">
            <LeadTrendBars data={monthlySeries([...rows.requests, ...rows.properties])} />
          </div>
        </section>
        <section className={PANEL} aria-labelledby="stage-heading">
          <h2 id="stage-heading" className={PANEL_TITLE}>
            Revenue by stage
          </h2>
          <div className="mt-4">
            <StageBars data={stages} />
          </div>
        </section>
        <section className={PANEL} aria-labelledby="mix-heading">
          <h2 id="mix-heading" className={PANEL_TITLE}>
            Job status mix
          </h2>
          <div className="mt-4">
            <StatusDonut data={countBy(rows.jobs, (j) => j.status)} />
          </div>
        </section>
        <section className={PANEL} aria-labelledby="trade-heading">
          <h2 id="trade-heading" className={PANEL_TITLE}>
            Demand by trade
          </h2>
          <div className="mt-4">
            <TradeBars data={trades} />
          </div>
        </section>
      </div>

      {/* Leads (read-only) */}
      <section id="leads" aria-labelledby="leads-heading" className="mt-12 scroll-mt-6">
        <h2 id="leads-heading" className="text-display text-3xl uppercase text-foreground">
          Leads
        </h2>
        {rows.requests.length === 0 ? (
          <div className="mt-4">
            <Empty>No renovation requests yet.</Empty>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.requests.map((lead) => (
              <li
                key={lead.id}
                className={`rounded-sm border border-border border-l-4 bg-card p-5 ${STATUS_BORDER_LEFT[statusTone(lead.status)]}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-label text-[12px] text-ink-subtle">
                      {lead.reference} · {shortDate(lead.created_at)}
                    </p>
                    <h3 className="font-display mt-1 text-2xl font-bold uppercase leading-tight text-foreground">
                      {lead.full_name}
                    </h3>
                    <p className="mt-1 text-muted-foreground">
                      {lead.service_types.map(prettyStatus).join(", ")} · {lead.address}
                    </p>
                  </div>
                  <StatusBadge status={lead.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Offers (read-only) */}
      <section id="offers" aria-labelledby="offers-heading" className="mt-12 scroll-mt-6">
        <h2 id="offers-heading" className="text-display text-3xl uppercase text-foreground">
          Offers
        </h2>
        {rows.offers.length === 0 ? (
          <div className="mt-4">
            <Empty>No offers yet.</Empty>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.offers.map((offer) => {
              const listing = offer.listings;
              const events = [...(offer.offer_events ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
              return (
                <li
                  key={offer.id}
                  className={`rounded-sm border border-border border-l-4 bg-card p-5 ${STATUS_BORDER_LEFT[statusTone(offer.status)]}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-label text-[12px] text-ink-subtle">
                        {offer.reference} · Submitted {shortDate(offer.created_at)}
                      </p>
                      <h3 className="font-display mt-1 text-2xl font-bold uppercase leading-tight text-foreground">
                        {listing ? `${listing.reference} · ${listing.suburb ?? listing.title}` : "Listing"}
                      </h3>
                      <p className="mt-1 text-muted-foreground">
                        {offer.client_name} · {offer.client_phone ?? offer.client_email}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-3xl font-bold leading-none text-foreground">
                        {money(Number(offer.amount))}
                      </p>
                      {listing && (
                        <p className="mt-1 text-sm text-muted-foreground">asking {money(Number(listing.price))}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <StatusBadge status={offer.status} />
                    {offer.status === "countered" && offer.counter_amount !== null && (
                      <span className="text-muted-foreground">
                        countered at <strong className="text-primary">{money(Number(offer.counter_amount))}</strong>
                      </span>
                    )}
                  </div>
                  {events.length > 0 && (
                    <ol className="mt-3 space-y-1 border-t border-divider pt-3 text-sm">
                      {events.map((event) => (
                        <li key={event.id} className="flex flex-wrap justify-between gap-x-4">
                          <span>
                            <span className="font-semibold text-primary">{event.status}</span>
                            {event.amount !== null && (
                              <span className="ml-3 text-muted-foreground">{money(Number(event.amount))}</span>
                            )}
                            {event.note && <span className="ml-3 text-muted-foreground">{event.note}</span>}
                          </span>
                          <span className="text-ink-faint">{shortDate(event.created_at)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Jobs (read-only) */}
      <section id="jobs" aria-labelledby="jobs-heading" className="mt-12 scroll-mt-6">
        <h2 id="jobs-heading" className="text-display text-3xl uppercase text-foreground">
          Jobs
        </h2>
        <p className="mt-1 text-muted-foreground">
          {activeJobs} active job{activeJobs === 1 ? "" : "s"} across the Cape Peninsula.
        </p>
        {rows.jobs.length === 0 ? (
          <div className="mt-4">
            <Empty>No jobs yet.</Empty>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-5">
            {rows.jobs.map((job) => {
              const jobHistory = rows.history.filter((entry) => entry.job_id === job.id);
              return (
                <li
                  key={job.id}
                  className={`rounded-sm border border-border border-t-4 bg-card p-6 ${BORDER_TOP[statusTone(job.status)]}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-label text-[12px] text-ink-subtle">
                        {job.reference} · {job.client_name}
                      </p>
                      <h3 className="font-display mt-1 text-2xl font-bold uppercase leading-tight text-foreground">
                        {job.title}
                      </h3>
                      <p className="mt-1 text-muted-foreground">{job.address}</p>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                  <div className="mt-5 flex items-end justify-between gap-3">
                    <span className="text-label text-[12px] text-ink-subtle">Quote</span>
                    <span className="font-display text-3xl font-bold leading-none text-primary">
                      {money(job.quote_amount)}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-label text-[12px] text-ink-subtle">Progress</span>
                    <span className="text-label text-[12px] text-ink-subtle">{job.progress}%</span>
                  </div>
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-sm bg-secondary"
                    role="progressbar"
                    aria-label={`${job.reference} progress`}
                    aria-valuenow={job.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="h-full bg-accent" style={{ width: `${job.progress}%` }} />
                  </div>
                  {jobHistory.length > 0 && (
                    <div className="mt-4 border-t border-divider pt-4">
                      <h4 className="text-label text-[12px] text-ink-subtle">Status history</h4>
                      <ol className="mt-2 space-y-1.5">
                        {jobHistory.map((entry) => (
                          <li key={entry.id} className="flex justify-between gap-3 text-sm">
                            <span>
                              <span className="font-semibold text-primary">{prettyStatus(entry.status)}</span>
                              {entry.note && <span className="ml-3 text-muted-foreground">{entry.note}</span>}
                            </span>
                            <span className="shrink-0 text-ink-faint">{shortDate(entry.created_at)}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PortalShell>
  );
}