import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, Repeat, Loader2, Home, Gavel } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PortalShell } from "@/components/portal/PortalShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { collection, orderBy, query } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/integrations/firebase/config";
import { listRows, updateRow } from "@/integrations/firebase/db";
import type { Tables } from "@/lib/db-types";
import { decideOffer } from "@/lib/offers";
import { money, prettyStatus, shortDate } from "@/lib/prop3000";
import { StatusBadge } from "@/components/StatusBadge";

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

function AgentConsole() {
  const { isAgent, loading } = useAuth();
  const queryClient = useQueryClient();
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState("");
  const [note, setNote] = useState("");

  const offers = useQuery({
    queryKey: ["agent-offers"],
    enabled: isAgent,
    queryFn: async () => {
      const rows = await listRows<Tables<"offers">>(
        query(collection(firestore(), COLLECTIONS.offers), orderBy("created_at", "desc")),
      );
      return rows.map((offer) => ({
        ...offer,
        listings: { title: offer.listing_title, address: offer.listing_address, price: offer.asking_price },
      }));
    },
  });

  const listings = useQuery({
    queryKey: ["agent-listings"],
    enabled: isAgent,
    queryFn: () =>
      listRows<Tables<"listings">>(query(collection(firestore(), COLLECTIONS.listings), orderBy("created_at", "desc"))),
  });

  const decide = useMutation({
    mutationFn: async (input: { id: string; status: string; counter?: number | null; note?: string }) => {
      const offer = offers.data?.find((o) => o.id === input.id);
      if (!offer) throw new Error("Offer not found");
      await decideOffer({
        offer,
        status: input.status,
        counter: input.counter ?? null,
        note: input.note?.trim() ? input.note.trim() : null,
      });
    },
    onSuccess: async () => {
      toast.success("Offer updated — the client has been notified.");
      setCounterFor(null);
      setCounterAmount("");
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["agent-offers"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setListingStatus = useMutation({
    mutationFn: async (input: { id: string; status: string }) => {
      await updateRow("listings", input.id, { status: input.status });
    },
    onSuccess: async () => {
      toast.success("Listing updated.");
      await queryClient.invalidateQueries({ queryKey: ["agent-listings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading) {
    return (
      <SiteLayout>
        <div className="px-4 py-24 text-center">
          <Loader2 className="mx-auto size-6 animate-spin text-accent" />
        </div>
      </SiteLayout>
    );
  }

  if (!isAgent) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-2xl px-4 py-24 text-center">
          <h1 className="text-display text-3xl">Agents only</h1>
          <p className="mt-3 text-muted-foreground">
            This console is for Prop3000 Investments agents, admins and the owner.
          </p>
        </div>
      </SiteLayout>
    );
  }

  return (
    <PortalShell
      badge="Investments agent"
      title="Agent console"
      subtitle="Offers land here the moment a client submits one. Approve to release your contact details, counter to keep negotiating, or decline."
    >
      <div>
        <h2 className="text-display mt-2 flex items-center gap-2 text-2xl">
          <Gavel className="size-5 text-accent" /> Offer pipeline
        </h2>
        {offers.isLoading ? (
          <Loader2 className="mt-6 size-5 animate-spin text-accent" />
        ) : !offers.data || offers.data.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
            No offers yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {offers.data.map((offer) => (
              <li key={offer.id} className="rounded-xl border border-border bg-card p-5 shadow-panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-display text-lg">{offer.listings?.title ?? "Listing"}</p>
                    <p className="text-sm text-muted-foreground">{offer.listings?.address}</p>
                  </div>
                  <StatusBadge status={offer.status} />
                </div>

                <div className="mt-3 flex flex-wrap gap-5 text-sm">
                  <span>
                    Asking <strong>{money(Number(offer.listings?.price ?? 0))}</strong>
                  </span>
                  <span>
                    Offered <strong>{money(Number(offer.amount))}</strong>
                  </span>
                  {offer.counter_amount ? <span className="text-brick">Counter {money(Number(offer.counter_amount))}</span> : null}
                  <span className="text-muted-foreground">
                    {offer.client_name} · {offer.client_phone ?? offer.client_email}
                  </span>
                  <span className="text-muted-foreground">{shortDate(offer.created_at)}</span>
                </div>

                {offer.message && <p className="mt-2 text-sm text-muted-foreground">“{offer.message}”</p>}

                {counterFor === offer.id ? (
                  <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
                    <Input
                      inputMode="numeric"
                      placeholder="Counter amount (R)"
                      value={counterAmount}
                      onChange={(e) => setCounterAmount(e.target.value)}
                    />
                    <Textarea
                      rows={2}
                      maxLength={500}
                      placeholder="Note to the client"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="brick"
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate({
                            id: offer.id,
                            status: "countered",
                            counter: Number(counterAmount.replace(/\D/g, "")) || null,
                            note,
                          })
                        }
                      >
                        Send counter
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setCounterFor(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="accent"
                      disabled={decide.isPending || offer.status === "approved"}
                      onClick={() => decide.mutate({ id: offer.id, status: "approved" })}
                    >
                      <Check className="size-4" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCounterFor(offer.id)}>
                      <Repeat className="size-4" /> Counter
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={decide.isPending || offer.status === "declined"}
                      onClick={() => decide.mutate({ id: offer.id, status: "declined" })}
                    >
                      <X className="size-4" /> Decline
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <h2 className="text-display mt-14 flex items-center gap-2 text-2xl">
          <Home className="size-5 text-brick" /> Listings
        </h2>
        {listings.isLoading ? (
          <Loader2 className="mt-6 size-5 animate-spin text-accent" />
        ) : !listings.data || listings.data.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
            No listings captured yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {listings.data.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div>
                  <p className="font-semibold">{row.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {row.address} · {money(Number(row.price))} · {row.reference}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["draft", "published", "under_offer", "sold"].map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={row.status === status ? "accent" : "outline"}
                      disabled={setListingStatus.isPending}
                      onClick={() => setListingStatus.mutate({ id: row.id, status })}
                    >
                      {prettyStatus(status)}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalShell>
  );
}
