import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Mail, Phone } from "lucide-react";
import { Empty, PortalShell } from "@/components/portal/PortalShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { money, shortDate, whatsappLink } from "@/lib/prop3000";
import { STATUS_BORDER_LEFT, statusTone } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/offers")({
  head: () => ({
    meta: [
      { title: "My Offers — Prop3000 Investments" },
      { name: "description", content: "Track the status of every offer you've made on a Prop3000 property listing." },
      { property: "og:title", content: "My property offers — Prop3000" },
      { property: "og:description", content: "Pending, approved, countered and declined offers in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OffersPage,
});

/** Date plus time, e.g. "02 Sep 2026 10:12". Dates still go through shortDate(). */
function when(value: string) {
  const time = new Date(value).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
  return `${shortDate(value)} ${time}`;
}

/** "−R 70 000" or "+R 15 000" against the asking price. */
function difference(amount: number, asking: number) {
  const diff = amount - asking;
  if (diff === 0) return "at asking";
  return `${diff < 0 ? "−" : "+"}${money(Math.abs(diff))}`;
}

function OffersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const offers = useQuery({
    queryKey: ["my-offers", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select(
          "id, reference, amount, status, counter_amount, message, agent_notes, created_at, listing_id, client_name, client_phone, listings(reference, title, suburb, price, agent_name, agent_phone, agent_email), offer_events(id, status, amount, note, created_at)",
        )
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const respond = useMutation({
    mutationFn: async (input: { id: string; reference: string; decision: "accept" | "decline"; counter: number }) => {
      const update =
        input.decision === "accept" ? { status: "approved", amount: input.counter } : { status: "declined" };
      const { error } = await supabase.from("offers").update(update).eq("id", input.id);
      if (error) throw error;

      const { error: eventError } = await supabase.from("offer_events").insert({
        offer_id: input.id,
        status: input.decision === "accept" ? "accepted" : "declined",
        amount: input.counter,
        note: input.decision === "accept" ? "Buyer accepted the counter-offer" : "Buyer declined the counter-offer",
        actor_id: user!.id,
      });
      if (eventError) throw eventError;
    },
    onSuccess: async (_res, input) => {
      toast.success(
        input.decision === "accept"
          ? `Offer ${input.reference} accepted at ${money(input.counter)} — the agent has been notified.`
          : `Counter-offer on ${input.reference} declined — the agent has been notified.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["my-offers"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (offers.isLoading || !offers.data) {
    return (
      <PortalShell title="My offers" subtitle="Loading your offers…">
        <Loader2 className="mx-auto size-6 animate-spin text-accent" aria-label="Loading" />
      </PortalShell>
    );
  }

  const rows = offers.data;
  const countered = rows.filter((offer) => offer.status === "countered").length;

  return (
    <PortalShell
      title="My offers"
      subtitle={
        countered > 0
          ? `${countered} counter-offer${countered === 1 ? "" : "s"} waiting on your answer.`
          : "Every offer you have put on a Prop3000 listing."
      }
    >
      {rows.length === 0 ? (
        <div className="space-y-4">
          <Empty>You haven't made any offers yet.</Empty>
          <Button asChild variant="brick" className="font-display font-bold uppercase tracking-wide">
            <Link to="/listings">Browse listings</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((offer) => {
            const listing = offer.listings;
            const asking = Number(listing?.price ?? 0);
            const amount = Number(offer.amount);
            const counter = offer.counter_amount === null ? null : Number(offer.counter_amount);
            const events = [...(offer.offer_events ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));

            return (
              <li
                key={offer.id}
                className={`rounded-sm border border-border border-l-4 bg-card p-6 ${STATUS_BORDER_LEFT[statusTone(offer.status)]}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-label text-[12px] text-ink-subtle">
                      {offer.reference} · Submitted {shortDate(offer.created_at)}
                    </p>
                    <h2 className="font-display mt-1 text-3xl font-bold uppercase leading-tight text-foreground">
                      {listing ? `${listing.reference} · ${listing.suburb ?? listing.title}` : "Listing"}
                    </h2>
                    <p className="mt-1 text-muted-foreground">
                      {offer.client_name}
                      {offer.client_phone ? ` · ${offer.client_phone}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-4xl font-bold leading-none tabular-nums text-foreground">
                      {money(amount)}
                    </p>
                    {listing && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        asking {money(asking)} · {difference(amount, asking)}
                      </p>
                    )}
                  </div>
                </div>

                {offer.message && (
                  <blockquote className="mt-4 rounded-sm bg-muted px-4 py-3 text-muted-foreground">
                    “{offer.message}”
                  </blockquote>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
                  <StatusBadge status={offer.status} />
                  {offer.status === "countered" && counter !== null && (
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-muted-foreground">
                        Agent countered at <strong className="text-primary">{money(counter)}</strong>
                      </p>
                      <Button
                        variant="success"
                        className="font-display font-bold uppercase tracking-wide"
                        disabled={respond.isPending}
                        onClick={() =>
                          respond.mutate({ id: offer.id, reference: offer.reference, decision: "accept", counter })
                        }
                      >
                        Accept
                      </Button>
                      <Button
                        variant="outlineBrick"
                        className="font-display font-bold uppercase tracking-wide"
                        disabled={respond.isPending}
                        onClick={() =>
                          respond.mutate({ id: offer.id, reference: offer.reference, decision: "decline", counter })
                        }
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                </div>

                {offer.status === "approved" && listing?.agent_name && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-sm bg-status-good px-4 py-3 text-status-good-foreground">
                    <p className="font-semibold">Approved — deal with {listing.agent_name} directly:</p>
                    {listing.agent_phone && (
                      <a className="inline-flex items-center gap-1 underline" href={`tel:${listing.agent_phone}`}>
                        <Phone className="size-4" aria-hidden="true" /> {listing.agent_phone}
                      </a>
                    )}
                    {listing.agent_email && (
                      <a className="inline-flex items-center gap-1 underline" href={`mailto:${listing.agent_email}`}>
                        <Mail className="size-4" aria-hidden="true" /> {listing.agent_email}
                      </a>
                    )}
                    <a
                      className="underline"
                      href={whatsappLink(`Hi, about offer ${offer.reference} on ${listing.title}`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                  </div>
                )}

                {events.length > 0 && (
                  <div className="mt-4 border-t border-divider pt-4">
                    <h3 className="text-label text-[12px] text-ink-subtle">Offer events</h3>
                    <ol className="mt-2 space-y-1">
                      {events.map((event) => (
                        <li key={event.id} className="flex flex-wrap justify-between gap-x-4 text-sm">
                          <span>
                            <span className="font-semibold text-primary">{event.status}</span>
                            {event.amount !== null && (
                              <span className="ml-3 text-muted-foreground">{money(Number(event.amount))}</span>
                            )}
                            {event.note && <span className="ml-3 text-muted-foreground">{event.note}</span>}
                          </span>
                          <span className="text-ink-faint">{when(event.created_at)}</span>
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
    </PortalShell>
  );
}