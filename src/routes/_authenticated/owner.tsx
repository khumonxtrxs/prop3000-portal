import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { LeadTrendBars, StageBars, StatusDonut, TradeBars } from "@/components/portal/Charts";
import { Empty, PortalShell, StatCard } from "@/components/portal/PortalShell";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/hooks/useAuth";

import {
  collection,
  getDocs,
} from "firebase/firestore";

import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/integrations/firebase/config";
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

type DateLike =
  | string
  | Date
  | {
    toDate?: () => Date;
    toMillis?: () => number;
  };

type FirestoreRow = {
  id: string;
  created_at?: DateLike;
  status?: string;
  service_types?: string[];
  [key: string]: unknown;
};

async function getCollectionRows(
  collectionName: string,
): Promise<FirestoreRow[]> {
  const snapshot = await getDocs(
    collection(firestore(), collectionName),
  );

  return snapshot.docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  }));
}

const BORDER_TOP: Record<StatusTone, string> = {
  wait: "border-t-status-wait-foreground",
  motion: "border-t-status-motion-foreground",
  good: "border-t-status-good-foreground",
  bad: "border-t-status-bad-foreground",
  neutral: "border-t-status-neutral-foreground",
};

const PANEL =
  "rounded-sm border border-border bg-card p-6";

const PANEL_TITLE =
  "text-display text-2xl uppercase text-foreground";

/** Owner is read-only: this page contains no mutation controls. */

function OwnerDashboard() {
  const { isOffice, loading } = useAuth();

  const data = useQuery({
    queryKey: ["owner-analytics"],
    enabled: isOffice,

    queryFn: async () => {
      const [
        jobs,
        requests,
        properties,
        offers,
        listings,
      ] = await Promise.all([
        getCollectionRows(COLLECTIONS.jobs),
        getCollectionRows(COLLECTIONS.serviceRequests),
        getCollectionRows(COLLECTIONS.propertySubmissions),
        getCollectionRows(COLLECTIONS.offers),
        getCollectionRows(COLLECTIONS.listings),
      ]);

      return {
        jobs,
        requests,
        properties,
        offers,
        listings,
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

  if (!isOffice) {
    return (
      <PortalShell title="Owner view" subtitle="Reserved for the owner and admins.">
        <Empty>Ask an admin to grant you owner access.</Empty>
      </PortalShell>
    );
  }

  if (data.isError) {
    return (
      <PortalShell
        badge="Owner"
        title="Business analytics"
        subtitle="We couldn't load the analytics dashboard."
      >
        <p className="text-destructive">
          {data.error instanceof Error
            ? data.error.message
            : String(data.error)}
        </p>
      </PortalShell>
    );
  }

  if (!data.data) {
    return (
      <PortalShell
        badge="Owner"
        title="Business analytics"
        subtitle="No analytics data was returned."
      >
        <Empty>No analytics data is available.</Empty>
      </PortalShell>
    );
  }

  const rows = data.data;

  const sum = (
    values: Array<number | string | null | undefined>,
  ) =>
    values.reduce<number>(
      (total, value) =>
        total + Number(value ?? 0),
      0,
    );

  const quotedJobs = rows.jobs.filter(
    (job) => job["status"] === "quoted",
  );

  const wonJobs = rows.jobs.filter((job) =>
    [
      "approved",
      "in_progress",
      "complete",
    ].includes(String(job["status"])),
  );

  const published = rows.listings.filter(
    (listing) =>
      listing["status"] === "published",
  );

  const purchased = rows.properties.filter(
    (property) =>
      property["status"] === "purchased",
  );

  const conversion = rows.requests.length
    ? Math.round(
      (rows.requests.filter(
        (request) =>
          request["status"] === "converted",
      ).length /
        rows.requests.length) *
      100,
    )
    : 0;

  const stages = [
    "quoted",
    "approved",
    "in_progress",
    "complete",
  ].map((status) => ({
    status,
    value: sum(
      rows.jobs
        .filter(
          (job) =>
            job["status"] === status,
        )
        .map(
          (job) =>
            job["quote_amount"] as
            | number
            | string
            | null
            | undefined,
        ),
    ),
  }));

  const trades = countBy(
    rows.jobs.flatMap((job) =>
      Array.isArray(job["service_types"])
        ? job["service_types"].filter(
          (trade): trade is string =>
            typeof trade === "string",
        )
        : [],
    ),
    (trade) => trade,
  )
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const activeJobs = rows.jobs.filter(
    (job) =>
      job["status"] === "in_progress",
  ).length;

  return (
    <PortalShell title="Business summary" subtitle="Read-only analytics across both divisions.">
      {/* Analytics */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
        <StatCard
          tone="primary"
          label="Quoted pipeline"
          value={money(
            sum(
              quotedJobs.map(
                (job) =>
                  job["quote_amount"] as
                  | number
                  | string
                  | null
                  | undefined,
              ),
            ),
          )}
          hint={`${quotedJobs.length} job${quotedJobs.length === 1 ? "" : "s"} awaiting client approval`}
        />
        <StatCard
          tone="success"
          label="Work won"
          value={money(
            sum(
              wonJobs.map(
                (job) =>
                  job["quote_amount"] as
                  | number
                  | string
                  | null
                  | undefined,
              ),
            ),
          )}
          hint={`${conversion}% lead conversion`}
        />
        <StatCard
          tone="accent"
          label="Listing stock value"
          value={money(
            sum(
              published.map(
                (listing) =>
                  listing["price"] as
                  | number
                  | string
                  | null
                  | undefined,
              ),
            ),
          )}
          hint={`${published.length} published listing${published.length === 1 ? "" : "s"}`}
        />
        <StatCard
          tone="brick"
          label="Acquisition spend"
          value={money(
            sum(
              purchased.map(
                (property) =>
                  property["offer_amount"] as
                  | number
                  | string
                  | null
                  | undefined,
              ),
            ),
          )}
          hint={`${purchased.length} propert${purchased.length === 1 ? "y" : "ies"} bought`}
        />
      </div>

      <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-start gap-4">
        <section className={PANEL} aria-labelledby="trend-heading">
          <h2 id="trend-heading" className={PANEL_TITLE}>
            Lead trend · 6 months
          </h2>
          <div className="mt-4">
            <LeadTrendBars
              data={monthlySeries(
                [
                  ...rows.requests,
                  ...rows.properties,
                ].map((row) => ({
                  ...row,
                  created_at: row["created_at"] ?? "",
                })),
              )}
            />
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
            <StatusDonut
              data={countBy(
                rows.jobs,
                (job) =>
                  String(job["status"] ?? "unknown"),
              )}
            />
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
                className={`rounded-sm border border-border border-l-4 bg-card p-5 ${STATUS_BORDER_LEFT[
                  statusTone(String(lead["status"] ?? ""))
                ]
                  }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-label text-[12px] text-ink-subtle">
                      {String(lead["reference"] ?? "")} ·{" "}
                      {shortDate(lead["created_at"] ?? "")}
                    </p>

                    <h3 className="font-display mt-1 text-2xl font-bold uppercase leading-tight text-foreground">
                      {String(lead["full_name"] ?? "")}
                    </h3>

                    <p className="mt-1 text-muted-foreground">
                      {Array.isArray(lead["service_types"])
                        ? lead["service_types"]
                          .filter(
                            (service): service is string =>
                              typeof service === "string",
                          )
                          .map(prettyStatus)
                          .join(", ")
                        : ""}
                      {" · "}
                      {String(lead["address"] ?? "")}
                    </p>
                  </div>

                  <StatusBadge
                    status={String(lead["status"] ?? "")}
                  />
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
              return (
                <li
                  key={offer.id}
                  className={`rounded-sm border border-border border-l-4 bg-card p-5 ${STATUS_BORDER_LEFT[statusTone(offer.status)]}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-label text-[12px] text-ink-subtle">
                        {String(offer["reference"] ?? "")} · Submitted{" "}
                        {shortDate(offer["created_at"] ?? "")}
                      </p>
                      <h3 className="font-display mt-1 text-2xl font-bold uppercase leading-tight text-foreground">
                        {String(offer["listing_title"] ?? "Listing")}
                      </h3>
                      <p className="mt-1 text-muted-foreground">
                        {String(offer["listing_address"] ?? "")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-3xl font-bold leading-none text-foreground">
                        {money(Number(offer["amount"]))}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        asking {money(Number(offer["asking_price"] ?? 0))}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <StatusBadge status={String(offer["status"] ?? "")} />
                    {offer["status"] === "countered" &&
                      offer["counter_amount"] != null && (
                        <span className="text-muted-foreground">
                          countered at <strong className="text-primary">{money(Number(offer["counter_amount"]))}</strong>
                        </span>
                      )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Jobs (read-only) */}
      <section
        id="jobs"
        aria-labelledby="jobs-heading"
        className="mt-12 scroll-mt-6"
      >
        <h2
          id="jobs-heading"
          className="text-display text-3xl uppercase text-foreground"
        >
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
              const progress = Number(job["progress"] ?? 0);

              return (
                <li
                  key={job.id}
                  className={`rounded-sm border border-border border-t-4 bg-card p-6 ${BORDER_TOP[
                    statusTone(String(job["status"] ?? ""))
                  ]
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-label text-[12px] text-ink-subtle">
                        {String(job["reference"] ?? "")} ·{" "}
                        {String(job["client_name"] ?? "")}
                      </p>

                      <h3 className="font-display mt-1 text-2xl font-bold uppercase leading-tight text-foreground">
                        {String(job["title"] ?? "")}
                      </h3>

                      <p className="mt-1 text-muted-foreground">
                        {String(job["address"] ?? "")}
                      </p>
                    </div>

                    <StatusBadge
                      status={String(job["status"] ?? "")}
                    />
                  </div>

                  <div className="mt-5 flex items-end justify-between gap-3">
                    <span className="text-label text-[12px] text-ink-subtle">
                      Quote
                    </span>

                    <span className="font-display text-3xl font-bold leading-none text-primary">
                      {money(Number(job["quote_amount"] ?? 0))}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-label text-[12px] text-ink-subtle">
                      Progress
                    </span>

                    <span className="text-label text-[12px] text-ink-subtle">
                      {progress}%
                    </span>
                  </div>

                  <div
                    className="mt-2 h-2 overflow-hidden rounded-sm bg-secondary"
                    role="progressbar"
                    aria-label={`${String(job["reference"] ?? "")} progress`}
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PortalShell>
  );
}