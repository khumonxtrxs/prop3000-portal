import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Empty, PortalShell } from "@/components/portal/PortalShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { money, prettyStatus, shortDate, whatsappLink } from "@/lib/prop3000";
import { STATUS_BORDER_LEFT, statusTone } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/client")({
  head: () => ({
    meta: [
      { title: "My Prop3000 Portal — Requests, Quotes & Progress" },
      {
        name: "description",
        content: "Homeowner portal: approve quotes, follow live job progress, track your cash offer and manage bookings.",
      },
      { property: "og:title", content: "My Prop3000 portal" },
      { property: "og:description", content: "Approve quotes and watch your renovation progress without a phone call." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientDashboard,
});

type QuoteLine = Record<string, unknown>;

function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

function lineLabel(line: QuoteLine): string {
  const label = line["description"] ?? line["label"] ?? line["item"] ?? line["name"];
  return typeof label === "string" && label.trim() ? label : "Item";
}

/** Reads a line item's price whichever field name the data uses. */
function lineAmount(line: QuoteLine): number {
  const direct =
    asNumber(line["amount"]) ?? asNumber(line["total"]) ?? asNumber(line["line_total"]) ?? asNumber(line["price_total"]);
  if (direct !== null) return direct;
  const qty = asNumber(line["qty"]) ?? asNumber(line["quantity"]) ?? 1;
  const unit =
    asNumber(line["unit_price"]) ?? asNumber(line["rate"]) ?? asNumber(line["price"]) ?? asNumber(line["unit_cost"]);
  return unit !== null ? qty * unit : 0;
}

function quoteLines(value: unknown): QuoteLine[] {
  if (!Array.isArray(value)) return [];
  return value.filter((line): line is QuoteLine => typeof line === "object" && line !== null && !Array.isArray(line));
}

function ClientDashboard() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();

  const data = useQuery({
    queryKey: ["client-portal", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const uid = user!.id;
      const [requests, jobs, quotes, bookings] = await Promise.all([
        supabase.from("service_requests").select("*").eq("client_id", uid).order("created_at", { ascending: false }),
        supabase.from("jobs").select("*").eq("client_id", uid).order("created_at", { ascending: false }),
        supabase.from("quotes").select("*").eq("client_id", uid).order("created_at", { ascending: false }),
        supabase.from("bookings").select("*").eq("client_id", uid).order("scheduled_date", { ascending: true }),
      ]);
      return {
        requests: requests.data ?? [],
        jobs: jobs.data ?? [],
        quotes: quotes.data ?? [],
        bookings: bookings.data ?? [],
      };
    },
  });

  const decideQuote = useMutation({
    mutationFn: async (input: { id: string; number: string; status: "approved" | "declined" }) => {
      const { error } = await supabase.from("quotes").update({ status: input.status }).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: async (_res, input) => {
      toast.success(
        input.status === "approved"
          ? `Quote ${input.number} approved — the office has been notified and will schedule the work.`
          : `Quote ${input.number} declined — the office has been notified.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["client-portal"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || data.isLoading || !data.data) {
    return (
      <PortalShell title="My portal" subtitle="Loading your quotes and requests…">
        <Loader2 className="mx-auto size-6 animate-spin text-accent" aria-label="Loading" />
      </PortalShell>
    );
  }

  const rows = data.data;
  const jobsById = new Map(rows.jobs.map((job) => [job.id, job]));
  const requestsById = new Map(rows.requests.map((request) => [request.id, request]));
  const waiting = rows.quotes.filter((quote) => quote.status === "sent").length;

  return (
    <PortalShell
      title="My portal"
      subtitle={
        waiting > 0
          ? `${waiting} quote${waiting === 1 ? "" : "s"} waiting on your approval.`
          : "Quotes, jobs, requests and notifications in one place."
      }
    >
      <section aria-labelledby="quotes-heading">
        <h2 id="quotes-heading" className="text-display text-3xl uppercase text-foreground">
          My quotes
        </h2>

        {rows.quotes.length === 0 ? (
          <div className="mt-4">
            <Empty>No quotes yet. Once the office prices your request it appears here to approve.</Empty>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {rows.quotes.map((quote) => {
              const job = quote.job_id ? jobsById.get(quote.job_id) : undefined;
              const request = quote.service_request_id ? requestsById.get(quote.service_request_id) : undefined;
              const title =
                job?.title ?? (request ? request.service_types.map(prettyStatus).join(", ") : "Renovation quote");
              const lines = quoteLines(quote.line_items);
              const canDecide = quote.status === "sent";

              return (
                <li
                  key={quote.id}
                  className={`rounded-sm border border-border border-l-4 bg-card p-6 ${STATUS_BORDER_LEFT[statusTone(quote.status)]}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-label text-[12px] text-ink-subtle">
                        {quote.quote_number}
                        {job ? ` · ${job.reference}` : ""}
                        {quote.valid_until ? ` · valid to ${shortDate(quote.valid_until)}` : ""}
                      </p>
                      <h3 className="font-display mt-1 text-3xl font-bold uppercase leading-tight text-foreground">
                        {title}
                      </h3>
                    </div>
                    <StatusBadge status={quote.status} />
                  </div>

                  <dl className="mt-4">
                    {lines.map((line, index) => (
                      <div key={index} className="flex justify-between gap-4 py-1 text-muted-foreground">
                        <dt>{lineLabel(line)}</dt>
                        <dd className="shrink-0 font-semibold tabular-nums text-foreground">{money(lineAmount(line))}</dd>
                      </div>
                    ))}
                    <div className="mt-2 flex justify-between gap-4 border-t border-divider pt-3 text-muted-foreground">
                      <dt>VAT 15%</dt>
                      <dd className="shrink-0 font-semibold tabular-nums text-foreground">{money(Number(quote.vat))}</dd>
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-4">
                      <dt className="text-label text-[12px] text-ink-subtle">Total</dt>
                      <dd className="font-display shrink-0 text-[30px] font-bold leading-none tabular-nums text-primary">
                        {money(Number(quote.total))}
                      </dd>
                    </div>
                  </dl>

                  {canDecide && (
                    <div className="mt-5 flex flex-wrap gap-3 border-t border-divider pt-5">
                      <Button
                        variant="success"
                        size="lg"
                        className="font-display font-bold uppercase tracking-wide"
                        disabled={decideQuote.isPending}
                        onClick={() => decideQuote.mutate({ id: quote.id, number: quote.quote_number, status: "approved" })}
                      >
                        Approve quote
                      </Button>
                      <Button
                        variant="outlineBrick"
                        size="lg"
                        className="font-display font-bold uppercase tracking-wide"
                        disabled={decideQuote.isPending}
                        onClick={() => decideQuote.mutate({ id: quote.id, number: quote.quote_number, status: "declined" })}
                      >
                        Decline
                      </Button>
                      <Button asChild variant="whatsapp" size="lg" className="font-display font-bold uppercase tracking-wide">
                        <a
                          href={whatsappLink(`Hi Prop3000, I have a question about quote ${quote.quote_number}.`)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Query on WhatsApp
                        </a>
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="requests-heading" className="mt-10">
        <h2 id="requests-heading" className="text-display text-3xl uppercase text-foreground">
          My requests &amp; bookings
        </h2>

        {rows.requests.length === 0 && rows.bookings.length === 0 ? (
          <div className="mt-4">
            <Empty>No requests or bookings yet.</Empty>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-4">
            {rows.requests.map((request) => (
              <li key={`request-${request.id}`} className="rounded-sm border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-label text-[12px] text-ink-subtle">
                    {request.reference} · {shortDate(request.created_at)}
                  </p>
                  <StatusBadge status={request.status} />
                </div>
                <h3 className="font-display mt-2 text-2xl font-bold uppercase leading-tight text-foreground">
                  {request.service_types.map(prettyStatus).join(", ")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{request.address}</p>
              </li>
            ))}
            {rows.bookings.map((booking) => (
              <li key={`booking-${booking.id}`} className="rounded-sm border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-label text-[12px] text-ink-subtle">
                    {shortDate(booking.scheduled_date)} · {booking.scheduled_time.slice(0, 5)}
                  </p>
                  <StatusBadge status={booking.status} />
                </div>
                <h3 className="font-display mt-2 text-2xl font-bold uppercase leading-tight text-foreground">
                  {prettyStatus(booking.booking_type)}
                </h3>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PortalShell>
  );
}