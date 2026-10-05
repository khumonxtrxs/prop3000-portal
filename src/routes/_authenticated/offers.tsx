import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Mail, Phone } from "lucide-react";

import {
  Empty,
  PortalShell,
} from "@/components/portal/PortalShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/integrations/firebase/config";

import {
  money,
  shortDate,
  whatsappLink,
} from "@/lib/prop3000";

import {
  STATUS_BORDER_LEFT,
  statusTone,
} from "@/lib/status";

export const Route = createFileRoute("/_authenticated/offers")({
  head: () => ({
    meta: [
      {
        title: "My Offers — Prop3000 Investments",
      },
      {
        name: "description",
        content:
          "Track the status of every offer you've made on a Prop3000 property listing.",
      },
      {
        property: "og:title",
        content: "My property offers — Prop3000",
      },
      {
        property: "og:description",
        content:
          "Pending, approved, countered and declined offers in one place.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary",
      },
    ],
  }),

  component: OffersPage,
});

function difference(
  amount: number,
  asking: number,
) {
  const diff = amount - asking;

  if (diff === 0) {
    return "at asking";
  }

  return `${diff < 0 ? "−" : "+"}${money(
    Math.abs(diff),
  )}`;
}

type OfferRow = {
  id: string;
  reference: string;
  listing_id: string;
  listing_title: string;
  listing_address: string;
  asking_price: number;
  amount: number;
  status: string;
  counter_amount: number | null;
  message: string | null;
  agent_notes: string | null;
  agent_name: string | null;
  agent_phone?: string | null;
  agent_email?: string | null;
  created_at?: Parameters<typeof shortDate>[0];
};

function OffersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const offers = useQuery({
    queryKey: ["my-offers", user?.uid],
    enabled: !!user?.uid,

    queryFn: async () => {
      const offersQuery = query(
        collection(
          firestore(),
          COLLECTIONS.offers,
        ),
        where(
          "client_id",
          "==",
          user!.uid,
        ),
        orderBy(
          "created_at",
          "desc",
        ),
      );

      const snapshot =
        await getDocs(offersQuery);

      return snapshot.docs.map(
        (snapshot) => ({
          id: snapshot.id,
          ...snapshot.data(),
        }),
      ) as OfferRow[];
    },
  });

  const respond = useMutation({
    mutationFn: async (input: {
      id: string;
      reference: string;
      decision: "accept" | "decline";
      counter: number;
    }) => {
      const offerRef = doc(
        firestore(),
        COLLECTIONS.offers,
        input.id,
      );

      if (input.decision === "accept") {
        await updateDoc(offerRef, {
          status: "approved",
          amount: input.counter,
        });
      } else {
        await updateDoc(offerRef, {
          status: "declined",
        });
      }
    },

    onSuccess: async (_res, input) => {
      toast.success(
        input.decision === "accept"
          ? `Offer ${input.reference} accepted at ${money(
            input.counter,
          )}.`
          : `Counter-offer on ${input.reference} declined.`,
      );

      await queryClient.invalidateQueries({
        queryKey: ["my-offers"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
    },

    onError: (e: Error) =>
      toast.error(e.message),
  });

  if (offers.isLoading) {
    return (
      <PortalShell
        title="My offers"
        subtitle="Loading your offers…"
      >
        <Loader2
          className="mx-auto size-6 animate-spin text-accent"
          aria-label="Loading"
        />
      </PortalShell>
    );
  }

  if (offers.isError) {
    return (
      <PortalShell
        title="My offers"
        subtitle="We couldn't load your offers."
      >
        <p className="text-destructive">
          {offers.error instanceof Error
            ? offers.error.message
            : String(offers.error)}
        </p>
      </PortalShell>
    );
  }

  const rows = offers.data ?? [];

  const countered = rows.filter(
    (offer) =>
      offer.status === "countered",
  ).length;

  return (
    <PortalShell
      title="My offers"
      subtitle={
        countered > 0
          ? `${countered} counter-offer${countered === 1 ? "" : "s"
          } waiting on your answer.`
          : "Every offer you have put on a Prop3000 listing."
      }
    >
      {rows.length === 0 ? (
        <div className="space-y-4">
          <Empty>
            You haven't made any offers yet.
          </Empty>

          <Button
            asChild
            variant="brick"
            className="font-display font-bold uppercase tracking-wide"
          >
            <Link to="/listings">
              Browse listings
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((offer) => {
            const asking = Number(
              offer.asking_price ?? 0,
            );

            const amount = Number(
              offer.amount ?? 0,
            );

            const counter =
              offer.counter_amount == null
                ? null
                : Number(
                  offer.counter_amount,
                );

            return (
              <li
                key={offer.id}
                className={`rounded-sm border border-border border-l-4 bg-card p-6 ${STATUS_BORDER_LEFT[
                  statusTone(
                    offer.status,
                  )
                  ]
                  }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-label text-[12px] text-ink-subtle">
                      {offer.reference}
                      {offer.created_at
                        ? ` · Submitted ${shortDate(
                          offer.created_at,
                        )}`
                        : ""}
                    </p>

                    <h2 className="font-display mt-1 text-3xl font-bold uppercase leading-tight text-foreground">
                      {offer.listing_title ??
                        "Listing"}
                    </h2>

                    <p className="mt-1 text-muted-foreground">
                      {offer.listing_address}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-display text-4xl font-bold leading-none tabular-nums text-foreground">
                      {money(amount)}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      asking{" "}
                      {money(asking)} ·{" "}
                      {difference(
                        amount,
                        asking,
                      )}
                    </p>
                  </div>
                </div>

                {offer.message && (
                  <blockquote className="mt-4 rounded-sm bg-muted px-4 py-3 text-muted-foreground">
                    “{offer.message}”
                  </blockquote>
                )}

                {offer.agent_notes && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Agent:{" "}
                    {offer.agent_notes}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
                  <StatusBadge
                    status={offer.status}
                  />

                  {offer.status ===
                    "countered" &&
                    counter !== null && (
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-muted-foreground">
                          Agent countered at{" "}
                          <strong className="text-primary">
                            {money(
                              counter,
                            )}
                          </strong>
                        </p>

                        <Button
                          variant="success"
                          className="font-display font-bold uppercase tracking-wide"
                          disabled={
                            respond.isPending
                          }
                          onClick={() =>
                            respond.mutate({
                              id: offer.id,
                              reference:
                                offer.reference,
                              decision:
                                "accept",
                              counter,
                            })
                          }
                        >
                          Accept
                        </Button>

                        <Button
                          variant="outlineBrick"
                          className="font-display font-bold uppercase tracking-wide"
                          disabled={
                            respond.isPending
                          }
                          onClick={() =>
                            respond.mutate({
                              id: offer.id,
                              reference:
                                offer.reference,
                              decision:
                                "decline",
                              counter,
                            })
                          }
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                </div>

                {offer.status ===
                  "approved" &&
                  offer.agent_name && (
                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-sm bg-status-good px-4 py-3 text-status-good-foreground">
                      <p className="font-semibold">
                        Approved — deal
                        with{" "}
                        {
                          offer.agent_name
                        }{" "}
                        directly:
                      </p>

                      {offer.agent_phone && (
                        <a
                          className="inline-flex items-center gap-1 underline"
                          href={`tel:${offer.agent_phone}`}
                        >
                          <Phone
                            className="size-4"
                            aria-hidden="true"
                          />
                          {
                            offer.agent_phone
                          }
                        </a>
                      )}

                      {offer.agent_email && (
                        <a
                          className="inline-flex items-center gap-1 underline"
                          href={`mailto:${offer.agent_email}`}
                        >
                          <Mail
                            className="size-4"
                            aria-hidden="true"
                          />
                          {
                            offer.agent_email
                          }
                        </a>
                      )}

                      {offer.agent_phone && (
                        <a
                          className="underline"
                          href={whatsappLink(
                            `Hi, about offer ${offer.reference} on ${offer.listing_title ?? "Listing"}`,
                          )}
                          target="_blank"
                          rel="noreferrer"
                        >
                          WhatsApp
                        </a>
                      )}
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