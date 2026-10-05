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
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";

import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/integrations/firebase/config";
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

// Firebase helper
type FirestoreRow = DocumentData & {
  id: string;
};

function timestampValue(value: unknown): number {
  if (!value) return 0;

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

const LISTING_STATUSES = [
  "draft",
  "published",
  "under_offer",
  "sold",
] as const;

function difference(amount: number, asking: number) {
  const diff = amount - asking;

  if (diff === 0) return "at asking";

  return `${diff < 0 ? "−" : "+"}${money(Math.abs(diff))}`;
}

type Decision =
  | "approved"
  | "countered"
  | "declined";

function AgentConsole() {
  const { isAgent, loading } = useAuth();
  const queryClient = useQueryClient();
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState("");

  const offers = useQuery({
    queryKey: ["offers", "agent"],
    enabled: isAgent,

    queryFn: async () => {
      const snapshot = await getDocs(
        collection(firestore(), COLLECTIONS.offers),
      );

      const rows = await Promise.all(
        snapshot.docs.map(async (offerDoc) => {
          const offer = {
            id: offerDoc.id,
            ...offerDoc.data(),
          } as FirestoreRow;

          let listing: FirestoreRow | null = null;

          const listingId = offer["listing_id"];

          if (listingId) {
            const listingSnapshot = await getDoc(
              doc(
                firestore(),
                COLLECTIONS.listings,
                String(listingId),
              ),
            );

            if (listingSnapshot.exists()) {
              listing = {
                id: listingSnapshot.id,
                ...listingSnapshot.data(),
              };
            }
          }

          return {
            ...offer,
            listing,
          } as FirestoreRow & {
            listing: FirestoreRow | null;
          };
        }),
      );

      rows.sort(
        (a, b) =>
          timestampValue(b["created_at"]) -
          timestampValue(a["created_at"]),
      );

      return rows;
    },
  });

  const listings = useQuery({
    queryKey: ["listings", "agent"],
    enabled: isAgent,

    queryFn: async () => {
      const snapshot = await getDocs(
        collection(firestore(), COLLECTIONS.listings),
      );

      const rows = snapshot.docs.map((listingDoc) => ({
        id: listingDoc.id,
        ...listingDoc.data(),
      })) as FirestoreRow[];

      rows.sort(
        (a, b) =>
          timestampValue(b["created_at"]) -
          timestampValue(a["created_at"]),
      );

      return rows;
    },
  });

  /** Every agent action updates the offer and appends an offer_events row; the offers_notify trigger notifies the buyer. */
  const decide = useMutation({
    mutationFn: async (input: {
      id: string;
      reference: string;
      status: Decision;
      amount: number;
      counter?: number;
    }) => {
      await updateDoc(
        doc(
          firestore(),
          COLLECTIONS.offers,
          input.id,
        ),
        {
          status: input.status,
          counter_amount:
            input.status === "countered"
              ? input.counter ?? null
              : null,
        },
      );
    },

    onSuccess: async (_result, input) => {
      const verb =
        input.status === "countered"
          ? `countered at ${money(
            input.counter ?? 0,
          )}`
          : input.status;

      toast.success(
        `Offer ${input.reference} ${verb} — buyer notified.`,
      );

      setCounterFor(null);
      setCounterAmount("");

      await queryClient.invalidateQueries({
        queryKey: ["offers", "agent"],
      });
    },

    onError: (e: Error) =>
      toast.error(e.message),
  });

  const setListingStatus = useMutation({
    mutationFn: async (input: {
      id: string;
      reference: string;
      status: string;
    }) => {
      await updateDoc(
        doc(
          firestore(),
          COLLECTIONS.listings,
          input.id,
        ),
        {
          status: input.status,
        },
      );
    },

    onSuccess: async (_result, input) => {
      toast.success(
        `Listing ${input.reference} marked ${prettyStatus(
          input.status,
        ).toLowerCase()}.`,
      );

      await queryClient.invalidateQueries({
        queryKey: ["listings", "agent"],
      });
    },

    onError: (e: Error) =>
      toast.error(e.message),
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
  const pending = offerRows.filter((o) => o["status"] === "pending").length;
  const countered = offerRows.filter((o) => o["status"] === "countered").length;
  const approved = offerRows.filter((o) => o["status"] === "approved").length;
  const live = listingRows.filter((l) => l["status"] === "published");
  const stockValue = live.reduce((sum, l) => sum + Number(l["price"] ?? 0), 0);

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
              const listing =
                (offer["listing"] as FirestoreRow | null) ?? null;

              const asking = Number(
                listing?.["price"] ?? 0,
              );

              const amount = Number(
                offer["amount"] ?? 0,
              );

              const status = String(
                offer["status"] ?? "",
              );

              const reference = String(
                offer["reference"] ?? "",
              );

              const isPending =
                status === "pending";

              return (
                <li
                  key={offer.id}
                  className={`rounded-sm border border-border border-l-4 bg-card p-6 ${STATUS_BORDER_LEFT[
                    statusTone(status)
                  ]
                    }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-label text-[12px] text-ink-subtle">
                        {reference} · Submitted{" "}
                        {shortDate(
                          offer["created_at"],
                        )}
                      </p>

                      <h2 className="font-display mt-1 text-3xl font-bold uppercase leading-tight text-foreground">
                        {listing
                          ? `${String(
                            listing["reference"] ?? "",
                          )} · ${String(
                            listing["suburb"] ??
                            listing["title"] ??
                            "Listing",
                          )}`
                          : "Listing"}
                      </h2>

                      <p className="mt-1 text-muted-foreground">
                        {String(
                          offer["client_name"] ?? "",
                        )}{" "}
                        ·{" "}
                        {String(
                          offer["client_phone"] ??
                          offer["client_email"] ??
                          "",
                        )}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-display text-4xl font-bold leading-none tabular-nums text-foreground">
                        {money(amount)}
                      </p>

                      {listing && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          asking {money(asking)} ·{" "}
                          {difference(
                            amount,
                            asking,
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {offer["message"] && (
                    <blockquote className="mt-4 rounded-sm bg-muted px-4 py-3 text-muted-foreground">
                      “{String(offer["message"])}”
                    </blockquote>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
                    <StatusBadge
                      status={status}
                    />

                    {isPending ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="success"
                          className="font-display font-bold uppercase tracking-wide"
                          disabled={decide.isPending}
                          onClick={() =>
                            decide.mutate({
                              id: offer.id,
                              reference,
                              status: "approved",
                              amount,
                            })
                          }
                        >
                          Approve
                        </Button>

                        <Button
                          variant="outlineNavy"
                          className="font-display font-bold uppercase tracking-wide"
                          aria-expanded={
                            counterFor === offer.id
                          }
                          onClick={() => {
                            setCounterFor(
                              counterFor === offer.id
                                ? null
                                : offer.id,
                            );

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
                            decide.mutate({
                              id: offer.id,
                              reference,
                              status: "declined",
                              amount,
                            })
                          }
                        >
                          Decline
                        </Button>
                      </div>
                    ) : status === "declined" ? (
                      <p className="font-semibold text-muted-foreground">
                        Declined and closed
                      </p>
                    ) : status === "countered" &&
                      offer["counter_amount"] !== null &&
                      offer["counter_amount"] !==
                      undefined ? (
                      <p className="text-muted-foreground">
                        Countered at{" "}
                        <strong className="text-primary">
                          {money(
                            Number(
                              offer[
                              "counter_amount"
                              ],
                            ),
                          )}
                        </strong>{" "}
                        · awaiting buyer
                      </p>
                    ) : null}
                  </div>

                  {counterFor === offer.id &&
                    isPending && (
                      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-sm bg-secondary p-4">
                        <label
                          htmlFor={`counter-${offer.id}`}
                          className="text-label text-[12px] text-ink-subtle"
                        >
                          Counter amount
                        </label>

                        <Input
                          id={`counter-${offer.id}`}
                          className="h-11 max-w-[14rem] bg-card"
                          inputMode="numeric"
                          placeholder="e.g. 850000"
                          value={counterAmount}
                          onChange={(e) =>
                            setCounterAmount(
                              e.target.value,
                            )
                          }
                        />

                        <Button
                          className="font-display h-11 font-bold uppercase tracking-wide"
                          disabled={decide.isPending}
                          onClick={() => {
                            const counter = Number(
                              counterAmount.replace(
                                /\D/g,
                                "",
                              ),
                            );

                            if (!counter) {
                              toast.error(
                                "Enter a counter amount first.",
                              );
                              return;
                            }

                            decide.mutate({
                              id: offer.id,
                              reference,
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
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Listings (target of the LISTINGS tab) */}
      <section
        id="listings"
        aria-labelledby="listings-heading"
        className="mt-10 scroll-mt-6"
      >
        <h2
          id="listings-heading"
          className="text-display text-3xl uppercase text-foreground"
        >
          Listings
        </h2>

        {listingRows.length === 0 ? (
          <div className="mt-4">
            <Empty>No listings captured yet.</Empty>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-4">
            {listingRows.map((row) => {
              const reference = String(
                row["reference"] ?? "",
              );

              const status = String(
                row["status"] ?? "",
              );

              return (
                <li
                  key={row.id}
                  className="rounded-sm border border-border bg-card p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-label text-[12px] text-ink-subtle">
                        {reference}
                      </p>

                      <h3 className="font-display mt-1 text-2xl font-bold uppercase leading-tight text-foreground">
                        {String(
                          row["title"] ?? "Listing",
                        )}
                      </h3>
                    </div>

                    <StatusBadge status={status} />
                  </div>

                  <p className="mt-1 text-muted-foreground">
                    {String(
                      row["address"] ?? "",
                    )}{" "}
                    ·{" "}
                    {money(
                      Number(
                        row["price"] ?? 0,
                      ),
                    )}
                  </p>

                  <div
                    className="mt-4 flex flex-wrap gap-2 border-t border-divider pt-4"
                    role="group"
                    aria-label={`Status for ${reference}`}
                  >
                    {LISTING_STATUSES.map(
                      (nextStatus) => (
                        <Button
                          key={nextStatus}
                          size="sm"
                          variant={
                            status === nextStatus
                              ? "default"
                              : "outline"
                          }
                          aria-pressed={
                            status === nextStatus
                          }
                          className="font-display font-bold uppercase tracking-wide"
                          disabled={
                            setListingStatus.isPending
                          }
                          onClick={() =>
                            setListingStatus.mutate({
                              id: row.id,
                              reference,
                              status: nextStatus,
                            })
                          }
                        >
                          {prettyStatus(nextStatus)}
                        </Button>
                      ),
                    )}
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