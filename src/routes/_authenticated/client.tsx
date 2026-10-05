import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Check, FileText, Hammer, Home, Loader2, X } from "lucide-react";
import { Empty, Panel, PortalShell, StatCard } from "@/components/portal/PortalShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { markNotificationRead, rowsWhere, updateRow } from "@/integrations/firebase/db";
import { money, prettyStatus, shortDate, whatsappLink } from "@/lib/prop3000";

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

type QuoteLine = { description?: string; qty?: number; amount?: number };

function ClientDashboard() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();

  const data = useQuery({
    queryKey: ["client-portal", user?.uid],
    enabled: !!user?.uid,
    queryFn: async () => {
      const uid = user!.uid;
      const [requests, properties, jobs, quotes, bookings, notifications] = await Promise.all([
        rowsWhere("service_requests", "client_id", uid),
        rowsWhere("property_submissions", "client_id", uid),
        rowsWhere("jobs", "client_id", uid),
        rowsWhere("quotes", "client_id", uid),
        rowsWhere("bookings", "client_id", uid, "scheduled_date", "asc"),
        rowsWhere("notifications", "user_id", uid),
      ]);
      return { requests, properties, jobs, quotes, bookings, notifications: notifications.slice(0, 10) };
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["client-portal"] });

  const decideQuote = useMutation({
    mutationFn: async (input: { id: string; status: "approved" | "declined" }) => {
      await updateRow("quotes", input.id, { status: input.status });
    },
    onSuccess: async (_res, input) => {
      toast.success(input.status === "approved" ? "Quote approved — the office will schedule the work." : "Quote declined.");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await markNotificationRead(id);
    },
    onSuccess: async () => {
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  if (loading || data.isLoading) {
    return (
      <PortalShell badge="Client" title="My portal" subtitle="Loading your requests…">
        <Loader2 className="mx-auto size-6 animate-spin text-accent" />
      </PortalShell>
    );
  }

  const rows = data.data!;
  const unread = rows.notifications.filter((n) => !n.read).length;
  const pendingQuotes = rows.quotes.filter((q) => q.status !== "approved" && q.status !== "declined");

  return (
    <PortalShell
      badge="Client / homeowner"
      title="My portal"
      subtitle="Everything you've sent Prop3000: quote approvals, live job progress, your cash offer and your booked dates."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Hammer} label="My requests" value={String(rows.requests.length)} />
        <StatCard icon={FileText} label="Quotes to approve" value={String(pendingQuotes.length)} />
        <StatCard icon={Home} label="Active jobs" value={String(rows.jobs.filter((j) => j.status !== "complete").length)} />
        <StatCard icon={Bell} label="New notifications" value={String(unread)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Quotes waiting on you">
          {rows.quotes.length === 0 ? (
            <Empty>No quotes yet. Once the office prices your request it appears here to approve.</Empty>
          ) : (
            <ul className="space-y-3">
              {rows.quotes.map((quote) => (
                <li key={quote.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{quote.quote_number}</p>
                      <p className="text-sm text-muted-foreground">
                        Total {money(Number(quote.total))} (incl. VAT {money(Number(quote.vat))}) ·{" "}
                        {quote.valid_until ? `valid to ${shortDate(quote.valid_until)}` : "no expiry"}
                      </p>
                    </div>
                    <StatusBadge status={quote.status} />
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {((quote.line_items as QuoteLine[]) ?? []).map((line, index) => (
                      <li key={index}>
                        {line.description ?? "Item"} — {money(Number(line.amount ?? 0))}
                      </li>
                    ))}
                  </ul>
                  {quote.status !== "approved" && quote.status !== "declined" && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="accent"
                        disabled={decideQuote.isPending}
                        onClick={() => decideQuote.mutate({ id: quote.id, status: "approved" })}
                      >
                        <Check className="size-4" /> Approve quote
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decideQuote.isPending}
                        onClick={() => decideQuote.mutate({ id: quote.id, status: "declined" })}
                      >
                        <X className="size-4" /> Decline
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Notifications">
          {rows.notifications.length === 0 ? (
            <Empty>Nothing yet — we'll ping you when a status changes.</Empty>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {rows.notifications.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className={item.read ? "font-medium text-muted-foreground" : "font-semibold"}>{item.title}</p>
                    {item.body && <p className="text-muted-foreground">{item.body}</p>}
                    <p className="text-xs text-muted-foreground">{shortDate(item.created_at)}</p>
                  </div>
                  {!item.read && (
                    <Button size="sm" variant="outline" onClick={() => markRead.mutate(item.id)}>
                      Mark read
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="My renovation jobs">
          {rows.jobs.length === 0 ? (
            <Empty>No job started yet.</Empty>
          ) : (
            <ul className="space-y-4 text-sm">
              {rows.jobs.map((job) => (
                <li key={job.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{job.title}</p>
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="text-muted-foreground">
                    {job.address} · {job.reference} · {money(job.quote_amount)}
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="gradient-accent h-full transition-all" style={{ width: `${job.progress}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="My cash-sale submissions"
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/sell">Submit another</Link>
            </Button>
          }
        >
          {rows.properties.length === 0 ? (
            <Empty>No property submitted for a cash offer yet.</Empty>
          ) : (
            <ul className="space-y-3 text-sm">
              {rows.properties.map((property) => (
                <li key={property.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{property.address}</p>
                      <p className="text-muted-foreground">
                        {property.reference} · {prettyStatus(property.condition)} · our offer {money(property.offer_amount)}
                      </p>
                    </div>
                    <StatusBadge status={property.status} />
                  </div>
                  {property.offer_amount ? (
                    <Button asChild size="sm" variant="brick" className="mt-3">
                      <a
                        href={whatsappLink(`Hi Prop3000, I'd like to discuss the cash offer on ${property.reference}.`)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Respond to the offer
                      </a>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="My requests"
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/request">New request</Link>
            </Button>
          }
        >
          {rows.requests.length === 0 ? (
            <Empty>No renovation requests yet.</Empty>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {rows.requests.map((request) => (
                <li key={request.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{request.service_types.map(prettyStatus).join(", ")}</p>
                    <p className="text-muted-foreground">
                      {request.address} · {request.reference}
                    </p>
                  </div>
                  <StatusBadge status={request.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="My bookings"
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/book">Book a date</Link>
            </Button>
          }
        >
          {rows.bookings.length === 0 ? (
            <Empty>No dates booked yet.</Empty>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {rows.bookings.map((booking) => (
                <li key={booking.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{prettyStatus(booking.booking_type)}</p>
                    <p className="text-muted-foreground">
                      {shortDate(booking.scheduled_date)} · {booking.scheduled_time.slice(0, 5)}
                    </p>
                  </div>
                  <StatusBadge status={booking.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PortalShell>
  );
}