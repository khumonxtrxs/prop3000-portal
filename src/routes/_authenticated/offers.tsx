import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Phone, Mail, Gavel } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/integrations/firebase/config";
import { money, prettyStatus, whatsappLink } from "@/lib/prop3000";

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

const TONE: Record<string, string> = {
  pending: "bg-secondary text-foreground",
  approved: "bg-accent/20 text-accent-foreground",
  countered: "bg-brick/15 text-brick",
  declined: "bg-destructive/15 text-destructive",
  withdrawn: "bg-muted text-muted-foreground",
};

function OffersPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["my-offers", user?.uid],
    enabled: !!user?.uid,
    queryFn: async () => {
      const offersQuery = query(
        collection(firestore(), COLLECTIONS.offers),
        where("client_id", "==", user!.uid),
        orderBy("created_at", "desc"),
      );

      const snapshot = await getDocs(offersQuery);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Array<{
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
      }>;
    },
  });

  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl px-4 py-14">
        <h1 className="text-display flex items-center gap-3 text-4xl">
          <Gavel className="size-7 text-accent" /> My offers
        </h1>
        <p className="mt-2 text-muted-foreground">
          Every offer you've submitted, with its live status. Approved offers unlock the agent's direct contact details.
        </p>

        {isError ? (
          <div className="mt-10 rounded-xl border border-destructive bg-card p-6">
            <p className="text-destructive">
              {error instanceof Error ? error.message : String(error)}
            </p>
          </div>
        ) : isLoading ? (
          <Loader2 className="mt-10 size-6 animate-spin text-accent" />
        ) : !data || data.length === 0 ? (
          <div className="mt-10 rounded-xl border border-border bg-card p-10 text-center">
            <p className="text-muted-foreground">You haven't made any offers yet.</p>
            <Button asChild variant="brick" className="mt-4">
              <Link to="/listings">Browse listings</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {data.map((offer) => (
              <li key={offer.id} className="rounded-xl border border-border bg-card p-6 shadow-panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-display text-xl">{offer.listing_title ?? "Listing"}</h2>
                    <p className="text-sm text-muted-foreground">{offer.listing_address}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${TONE[offer.status] ?? "bg-secondary"
                      }`}
                  >
                    {prettyStatus(offer.status)}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-6 text-sm">
                  <span>
                    Asking: <strong>{money(Number(offer.asking_price ?? 0))}</strong>
                  </span>
                  <span>
                    Your offer: <strong>{money(Number(offer.amount))}</strong>
                  </span>
                  {offer.counter_amount ? (
                    <span className="text-brick">
                      Counter: <strong>{money(Number(offer.counter_amount))}</strong>
                    </span>
                  ) : null}
                  <span className="text-muted-foreground">Ref {offer.reference}</span>
                </div>

                {offer.agent_notes && <p className="mt-3 text-sm text-muted-foreground">Agent: {offer.agent_notes}</p>}

                {offer.status === "approved" && (
                  <div className="mt-4 rounded-lg border border-accent/40 bg-accent/10 p-4">
                    <p className="text-sm font-semibold">
                      Approved — deal with {offer.agent_name ?? "your Prop3000 agent"} directly:
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {offer.agent_phone && (
                        <>
                          <Button asChild size="sm" variant="accent">
                            <a href={`tel:${offer.agent_phone}`}>
                              <Phone className="size-4" /> {offer.agent_phone}
                            </a>
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <a
                              href={whatsappLink(`Hi, about offer ${offer.reference} on ${offer.listing_title ?? "Listing"}`)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              WhatsApp
                            </a>
                          </Button>
                        </>
                      )}
                      {offer.agent_email && (
                        <Button asChild size="sm" variant="outline">
                          <a href={`mailto:${offer.agent_email}`}>
                            <Mail className="size-4" /> {offer.agent_email}
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {offer.status === "countered" && (
                  <Button asChild variant="brick" size="sm" className="mt-4">
                    <Link to="/listings/$id" params={{ id: offer.listing_id }}>
                      Respond with a new offer
                    </Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </SiteLayout>
  );
}
