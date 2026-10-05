import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Empty, PortalShell, StatCard } from "@/components/portal/PortalShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { money, prettyStatus, shortDate } from "@/lib/prop3000";
import { STATUS_BORDER_LEFT, statusTone } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/agent")({
  head: () => ({
    meta: [
      { title: "Agent Console — Prop3000 Investments" },
      { name: "description", content: "Review property offers, approve, decline or counter them, and manage listings." },
      { property: "og:title", content: "Prop3000 agent console" },
      { property: "og:description", content: "Offer pipeline and listing management for Prop3000 Investments agents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgentConsole,
});

const LISTING_STATUSES = ["draft", "published", "under_offer", "sold"] as const;

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

type Decision = "approved" | "countered" | "declined";

function AgentConsole() {
  const { user, isAgent, loading } = useAuth();
  const queryClient = useQueryClient();
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState("");

  const offers = useQuery({
    queryKey: ["offers", "agent"],
    enabled: isAgent,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select(
          "id, reference, amount, status, counter_amount, message, client_name, client_email, client_phone, created_at, listings(reference, title, suburb, price), offer_events(id, status, amount, note, created_at)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const listings = useQuery({
    queryKey: ["listings", "agent"],
    enabled: isAgent,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, reference, title, address, suburb, price, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  /** Every agent action updates the offer and appends an offer_events row; the offers_notify trigger notifies the buyer. */
  const decide = useMutation({
    mutationFn: async (input: { id: string; reference: string; status: Decision; amount: number; counter?: number }) => {
      const patch =
        input.status === "countered" ? { status: input.status, counter_amount: input.counter ?? null } : { status: input.status };
      const { error } = await supabase.from("offers").update(patch).eq("id", input.id);
      if (error) throw error;

      const { error: eventError } = await supabase.from("offer_events").insert({
        offer_id: input.id,
        status: input.status,
        amount: input.status === "countered" ? (input.counter ?? null) : input.amount,
        actor_id: user!.id,
      });
      if (eventError) throw eventError;
    },
    onSuccess: async (_res, input) => {
      const verb =
        input.status === "countered" ? `countered at ${money(input.counter ?? 0)}` : input.status;
      toast.success(`Offer ${input.reference} ${verb} — buyer notified.`);
      setCounterFor(null);
      setCounterAmount("");
      await queryClient.invalidateQueries({ queryKey: ["offers"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setListingStatus = useMutation({
    mutationFn: async (input: { id: string; reference: string; status: string }) => {
      const { error } = await supabase.from("listings").update({ status: input.status }).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: async (_res, input) => {
      toast.success(`Listing ${input.reference} marked ${prettyStatus(input.status).toLowerCase()}.`);
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || (isAgent && (offers.isLoading || listings.isLoading))) {
    return (
      <PortalShell title="Offer console" subtitle="Loading offers…">
        <Loader2 className="mx-auto size-6 animate-spin text-accent" aria-label="Loading" />
      </PortalShell>
    );
  }

  if (!isAgent) {
    return (
      <PortalShell title="Agents only" subtitle="This console is for Prop3000 Investments agents, admins and the owner.">
        <Empty>Your account doesn't have agent access.</Empty>
      </PortalShell>
    );
  }

  const offerRows = offers.data ?? [];
  const listingRows = listings.data ?? [];
  const pending = offerRows.filter((o) => o.status === "pending").length;
  const countered = offerRows.filter((o) => o.status === "countered").length;
  const approved = offerRows.filter((o) => o.status === "approved").length;
  const live = listingRows.filter((l) => l.status === "published");
  const stockValue = live.reduce((sum, l) => sum + Number(l.price ?? 0), 0);

  return (
    <PortalShell
      title="Offer console"
      subtitle={`${pending} offer${pending === 1 ? "" : "s"} awaiting approve, counter or decline.`}
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
        <StatCard tone="accent" label="Offers pending" value={String(pending)} hint="needs approve / counter / decline" />
        <StatCard tone="primary" label="Countered" value={String(countered)} hint="awaiting buyer response" />
        <StatCard tone="success" label="Approved" value={String(approved)} hint="buyers connected to agents" />
        <StatCard
          tone="brick"
          label="Stock value"
          value={money(stockValue)}
          hint={`${live.length} listing${live.length === 1 ? "" : "s"} live`}
        />
      </div>

      {/* Offer console */}
      <section aria-label="Offers" className="mt-8">
        {offerRows.length === 0 ? (
          <Empty>No offers yet.</Empty>
        ) : (
          <ul className="space-y-4">
            {offerRows.map((offer) => {
              const listing = offer.listings;
              const asking = Number(listing?.price ?? 0);
              const amount = Number(offer.amount);
              const events = [...(offer.offer_events ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
              const isPending = offer.status === "pending";

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
                        {offer.client_name} · {offer.client_phone ?? offer.client_email}
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
                    {isPending ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="success"
                          className="font-display font-bold uppercase tracking-wide"
                          disabled={decide.isPending}
                          onClick={() =>
                            decide.mutate({ id: offer.id, reference: offer.reference, status: "approved", amount })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outlineNavy"
                          className="font-display font-bold uppercase tracking-wide"
                          aria-expanded={counterFor === offer.id}
                          onClick={() => {
                            setCounterFor(counterFor === offer.id ? null : offer.id);
                            setCounterAmount("");
                          }}
                        >
                          Counter
                        </Button>
                        <Button
                          variant="outlineBrick"
                          className="font-display font-bold uppercase tracking-wide"
                          disabled={decide.isPending}
                          onClick={() =>
                            decide.mutate({ id: offer.id, reference: offer.reference, status: "declined", amount })
                          }
                        >
                          Decline
                        </Button>
                      </div>
                    ) : offer.status === "declined" ? (
                      <p className="font-semibold text-muted-foreground">Declined and closed</p>
                    ) : offer.status === "countered" && offer.counter_amount !== null ? (
                      <p className="text-muted-foreground">
                        Countered at <strong className="text-primary">{money(Number(offer.counter_amount))}</strong> ·
                        awaiting buyer
                      </p>
                    ) : null}
                  </div>

                  {counterFor === offer.id && isPending && (
                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-sm bg-secondary p-4">
                      <label htmlFor={`counter-${offer.id}`} className="text-label text-[12px] text-ink-subtle">
                        Counter amount
                      </label>
                      <Input
                        id={`counter-${offer.id}`}
                        className="h-11 max-w-[14rem] bg-card"
                        inputMode="numeric"
                        placeholder="e.g. 850000"
                        value={counterAmount}
                        onChange={(e) => setCounterAmount(e.target.value)}
                      />
                      <Button
                        className="font-display h-11 font-bold uppercase tracking-wide"
                        disabled={decide.isPending}
                        onClick={() => {
                          const counter = Number(counterAmount.replace(/\D/g, ""));
                          if (!counter) {
                            toast.error("Enter a counter amount first.");
                            return;
                          }
                          decide.mutate({
                            id: offer.id,
                            reference: offer.reference,
                            status: "countered",
                            amount,
                            counter,
                          });
                        }}
                      >
                        Send counter
                      </Button>
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
      </section>

      {/* Listings (target of the LISTINGS tab) */}
      <section id="listings" aria-labelledby="listings-heading" className="mt-10 scroll-mt-6">
        <h2 id="listings-heading" className="text-display text-3xl uppercase text-foreground">
          Listings
        </h2>
        {listingRows.length === 0 ? (
          <div className="mt-4">
            <Empty>No listings captured yet.</Empty>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-4">
            {listingRows.map((row) => (
              <li key={row.id} className="rounded-sm border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-label text-[12px] text-ink-subtle">{row.reference}</p>
                    <h3 className="font-display mt-1 text-2xl font-bold uppercase leading-tight text-foreground">
                      {row.title}
                    </h3>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
                <p className="mt-1 text-muted-foreground">
                  {row.address} · {money(Number(row.price))}
                </p>
                <div
                  className="mt-4 flex flex-wrap gap-2 border-t border-divider pt-4"
                  role="group"
                  aria-label={`Status for ${row.reference}`}
                >
                  {LISTING_STATUSES.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={row.status === status ? "default" : "outline"}
                      aria-pressed={row.status === status}
                      className="font-display font-bold uppercase tracking-wide"
                      disabled={setListingStatus.isPending}
                      onClick={() => setListingStatus.mutate({ id: row.id, reference: row.reference, status })}
                    >
                      {prettyStatus(status)}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PortalShell>
  );
}