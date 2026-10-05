import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { BedDouble, Bath, Ruler, MapPin as MapPinIcon, Loader2, Gavel, LogIn } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { RouteFinder } from "@/components/site/RouteFinder";
import { LazyMap } from "@/components/LazyMap";
import type { MapPin } from "@/components/MapCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";

import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/integrations/firebase/config";
import { getPublicListing } from "@/lib/listings.functions";
import { COMPANY, money, prettyStatus } from "@/lib/prop3000";

const listingQuery = (id: string) =>
  queryOptions({
    queryKey: ["public-listing", id],
    queryFn: () => getPublicListing({ data: { id } }),
  });

export const Route = createFileRoute("/listings/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(listingQuery(params.id)),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Property"} — Prop3000 Investments` },
      {
        name: "description",
        content: `${loaderData?.title ?? "Distressed property"} in ${loaderData?.suburb ?? "Cape Town"} — asking ${loaderData ? money(Number(loaderData.price)) : "POA"
          }. Submit an offer online with Prop3000 Investments.`,
      },
      { property: "og:title", content: `${loaderData?.title ?? "Property"} — Prop3000 Investments` },
      { property: "og:description", content: loaderData?.description ?? "Distressed property for sale, as-is." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-display text-3xl">Listing unavailable</h1>
        <p className="mt-3 text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      </div>
    </SiteLayout>
  ),
  notFoundComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-display text-3xl">Listing not found</h1>
      </div>
    </SiteLayout>
  ),
  component: ListingDetail,
});

function ListingDetail() {
  const { id } = Route.useParams();
  const { data: listing } = useSuspenseQuery(listingQuery(id));
  const { user } = useAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  if (!listing) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-3xl px-4 py-24 text-center">
          <h1 className="text-display text-3xl">This listing is no longer available</h1>
          <Button asChild variant="accent" className="mt-6">
            <Link to="/listings">Back to listings</Link>
          </Button>
        </div>
      </SiteLayout>
    );
  }

  const pins: MapPin[] = [
    { ...COMPANY.baseCoords, label: "Prop3000 office", kind: "office" },
    ...(listing.latitude !== null && listing.longitude !== null
      ? [{ lat: Number(listing.latitude), lng: Number(listing.longitude), label: listing.address, kind: "listing" as const }]
      : []),
  ];

  async function submitOffer(event: React.FormEvent) {
    event.preventDefault();

    if (!user) {
      toast.error("Sign in to submit an offer.");
      return;
    }

    if (!listing) {
      toast.error("This listing is no longer available.");
      return;
    }

    const value = Number(amount.replace(/[^\d]/g, ""));

    if (!value || value < 1000) {
      toast.error("Enter your offer amount in rands.");
      return;
    }

    setBusy(true);

    try {
      const offerRef = doc(
        collection(firestore(), COLLECTIONS.offers),
      );

      await setDoc(offerRef, {
        reference: offerRef.id,

        listing_id: listing.id,
        listing_title: listing.title,
        listing_address: listing.address,
        asking_price: Number(listing.price),

        client_id: user.uid,
        buyer_name:
          user.displayName ||
          user.email ||
          "Client",
        client_email: user.email ?? "",
        client_phone: phone.trim() || null,

        amount: value,
        message: message.trim() || null,

        status: "pending",
        counter_amount: null,
        agent_notes: null,

        agent_name: listing.agent_name ?? null,

        created_at: serverTimestamp(),
      });

      setSent(offerRef.id);
      toast.success(
        "Offer submitted — the agent has been notified.",
      );
    } catch (error) {
      console.error(error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Could not submit offer.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 py-12">
        <Link to="/listings" className="text-sm font-semibold text-brick hover:underline">
          ← All listings
        </Link>

        <div className="mt-4 grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <span className="rounded-full bg-secondary px-2 py-1 text-xs font-semibold uppercase">
              {prettyStatus(listing.status)} · {listing.reference}
            </span>
            <h1 className="text-display mt-3 text-4xl">{listing.title}</h1>
            <p className="mt-2 flex items-start gap-2 text-muted-foreground">
              <MapPinIcon className="mt-1 size-4 shrink-0 text-brick" />
              {listing.address}
            </p>
            <p className="text-display mt-4 text-3xl text-brick">{money(Number(listing.price))}</p>

            <div className="mt-4 flex flex-wrap gap-5 text-sm text-muted-foreground">
              {listing.bedrooms ? (
                <span className="flex items-center gap-2">
                  <BedDouble className="size-4" /> {listing.bedrooms} bed
                </span>
              ) : null}
              {listing.bathrooms ? (
                <span className="flex items-center gap-2">
                  <Bath className="size-4" /> {listing.bathrooms} bath
                </span>
              ) : null}
              {listing.erf_size ? (
                <span className="flex items-center gap-2">
                  <Ruler className="size-4" /> {listing.erf_size}
                </span>
              ) : null}
              <span>Condition: {prettyStatus(listing.condition)}</span>
              <span>Type: {prettyStatus(listing.property_type)}</span>
            </div>

            {listing.description && <p className="mt-6 leading-relaxed">{listing.description}</p>}

            <div className="mt-8">
              <LazyMap pins={pins} className="h-72 w-full" zoom={13} />
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="sticky top-24 rounded-xl border border-border bg-card p-6 shadow-panel">
              <h2 className="text-display flex items-center gap-2 text-2xl">
                <Gavel className="size-5 text-accent" /> Submit an offer
              </h2>

              {sent ? (
                <div className="mt-4 space-y-3 text-sm">
                  <p className="font-semibold">Offer {sent} is pending review.</p>
                  <p className="text-muted-foreground">
                    An agent will approve, decline or counter it. You'll get an in-app notification, and the agent's
                    contact details are released as soon as your offer is approved.
                  </p>
                  <Button asChild variant="accent" className="w-full">
                    <Link to="/offers">Track my offers</Link>
                  </Button>
                </div>
              ) : user ? (
                <form onSubmit={submitOffer} className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="o_amount">Your offer (R)</Label>
                    <Input
                      id="o_amount"
                      inputMode="numeric"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={String(Math.round(Number(listing.price) * 0.9))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="o_phone">Contact number</Label>
                    <Input id="o_phone" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="o_msg">Message to the agent</Label>
                    <Textarea
                      id="o_msg"
                      rows={3}
                      maxLength={600}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Cash, no bond needed. Available to view this week."
                    />
                  </div>
                  <Button type="submit" variant="brick" size="lg" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    Submit offer
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    No payment or transfer happens here. An approved offer simply puts you in touch with the Prop3000
                    agent to finalise the sale.
                  </p>
                </form>
              ) : (
                <div className="mt-4 space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    Sign in to submit and track an offer on this property. It takes a minute and lets you follow the
                    Pending → Approved status without phoning in.
                  </p>
                  <Button variant="accent" className="w-full" onClick={() => navigate({ to: "/auth" })}>
                    <LogIn className="size-4" /> Sign in to make an offer
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-secondary/40 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <RouteFinder initialAddress={listing.address} />
        </div>
      </section>
    </SiteLayout>
  );
}
