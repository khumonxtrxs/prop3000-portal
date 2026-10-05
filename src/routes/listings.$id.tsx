import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { RouteFinder } from "@/components/site/RouteFinder";
import { LazyMap } from "@/components/LazyMap";
import type { MapPin } from "@/components/MapCanvas";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getPublicListing } from "@/lib/listings.functions";
import { money, prettyStatus, whatsappLink } from "@/lib/prop3000";

const listingQuery = (id: string) =>
  queryOptions({
    queryKey: ["public-listing", id],
    queryFn: () => getPublicListing({ data: { id } }),
  });

export const Route = createFileRoute("/listings/$id")({
  /** ?offer=820000 pre-fills the offer (MAKE AN OFFER on the listings page sends 92% of asking). */
  validateSearch: (search: Record<string, unknown>): { offer?: number } => {
    const value = Number(search["offer"]);
    return Number.isFinite(value) && value > 0 ? { offer: Math.round(value) } : {};
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(listingQuery(params.id)),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Property"} — Prop3000 Investments` },
      {
        name: "description",
        content: `${loaderData?.title ?? "Distressed property"} in ${loaderData?.suburb ?? "Cape Town"} — asking ${
          loaderData ? money(Number(loaderData.price)) : "POA"
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
  const { offer: suggested } = Route.useSearch();
  const { data: listing } = useSuspenseQuery(listingQuery(id));
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const asking = Number(listing?.price ?? 0);
  const [amount, setAmount] = useState(String(suggested ?? Math.round(asking * 0.92)));
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ reference: string; amount: number } | null>(null);

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

  const pins: MapPin[] =
    listing.latitude !== null && listing.longitude !== null
      ? [{ lat: Number(listing.latitude), lng: Number(listing.longitude), label: listing.address, kind: "site" }]
      : [];

  const specs = [
    { label: "Type", value: prettyStatus(listing.property_type) },
    { label: "Stand", value: listing.erf_size ?? "—" },
    { label: "Beds", value: listing.bedrooms ?? "—" },
    { label: "Baths", value: listing.bathrooms ?? "—" },
  ];

  async function submitOffer(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount.replace(/\D/g, ""));
    if (!value || value < 1000) {
      setAmountError("Enter your offer amount in rands, e.g. 820000.");
      return;
    }
    setAmountError(null);
    setBusy(true);
    const { data, error } = await supabase
      .from("offers")
      .insert({
        listing_id: listing!.id,
        client_id: user!.id,
        client_name: (user!.user_metadata?.["full_name"] as string) || user!.email || "Client",
        client_email: user!.email ?? "",
        client_phone: phone.trim() || null,
        amount: value,
        message: message.trim() || null,
      })
      .select("id, reference")
      .single();
    if (error) {
      setBusy(false);
      setAmountError(error.message);
      return;
    }
    // Start the audit trail; the offers_notify trigger handles the notification.
    await supabase.from("offer_events").insert({ offer_id: data.id, status: "submitted", amount: value, actor_id: user!.id });
    setBusy(false);
    setSent({ reference: data.reference, amount: value });
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-12">
        <Link to="/listings" className="text-label text-[12px] text-primary hover:underline">
          ← All listings
        </Link>

        <div className="mt-6 grid items-start gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* Left: photos, map, route */}
          <div className="space-y-4">
            <div className="hatch-fill aspect-[4/3] w-full rounded-sm" aria-hidden="true" />
            <div className="grid grid-cols-3 gap-3" aria-hidden="true">
              <div className="hatch-fill aspect-[4/3] rounded-sm" />
              <div className="hatch-fill aspect-[4/3] rounded-sm" />
              <div className="hatch-fill aspect-[4/3] rounded-sm" />
            </div>
            {pins.length > 0 && <LazyMap pins={pins} className="h-[300px] w-full" zoom={14} />}
            <div className="rounded-sm border border-border bg-card p-5">
              <RouteFinder initialAddress={listing.address} />
            </div>
          </div>

          {/* Right: facts and the offer card */}
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-label text-[12px] text-ink-subtle">
                {listing.reference} · {listing.suburb ?? listing.city ?? "Cape Town"}
              </p>
              <StatusBadge status={listing.status} />
            </div>
            <h1 className="text-display text-4xl uppercase leading-tight text-foreground sm:text-5xl">{listing.title}</h1>
            <p className="text-muted-foreground">{listing.address}</p>

            <div>
              <p className="text-label text-[12px] text-ink-subtle">Asking</p>
              <p className="font-display text-[42px] font-bold leading-none text-brick">{money(asking)}</p>
            </div>

            <dl className="grid grid-cols-2 border-l border-t border-border bg-card sm:grid-cols-4">
              {specs.map((spec) => (
                <div key={spec.label} className="border-b border-r border-border p-4">
                  <dt className="text-label text-[11px] text-ink-subtle">{spec.label}</dt>
                  <dd className="font-display mt-1 text-2xl font-bold text-foreground">{spec.value}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-sm border-l-4 border-l-accent bg-status-wait p-4 text-status-wait-foreground">
              <p className="font-display text-lg font-bold uppercase">Condition: {prettyStatus(listing.condition)}</p>
              {listing.description && <p className="mt-1">{listing.description}</p>}
            </div>

            <section aria-labelledby="offer-heading" className="rounded-sm border-2 border-primary bg-card p-6">
              {sent ? (
                <div role="status">
                  <p className="text-label flex items-center gap-2 text-[12px] text-success">
                    <CheckCircle2 className="size-4" aria-hidden="true" /> Offer submitted
                  </p>
                  <h2 id="offer-heading" className="font-display mt-2 text-4xl font-bold text-foreground">
                    {money(sent.amount)}
                  </h2>
                  <p className="mt-1 text-muted-foreground">
                    {sent.reference} on {listing.reference}
                  </p>
                  <div className="mt-3">
                    <StatusBadge status="pending" />
                  </div>
                  <p className="mt-4 text-foreground">
                    The agent will approve, decline or counter your offer. You'll get an alert in your portal the moment it
                    changes.
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Prop3000 never takes payment or handles transfer on the portal.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button asChild variant="default" size="lg" className="font-display font-bold uppercase tracking-wide">
                      <Link to="/offers">Track my offer</Link>
                    </Button>
                    <Button asChild variant="whatsapp" size="lg" className="font-display font-bold uppercase tracking-wide">
                      <a
                        href={whatsappLink(`Hi, about my offer ${sent.reference} on ${listing.reference}.`)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        WhatsApp the agent
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 id="offer-heading" className="text-display text-3xl uppercase text-foreground">
                    Make an offer
                  </h2>
                  {session ? (
                    <form onSubmit={submitOffer} noValidate className="mt-4 space-y-4">
                      <div>
                        <label htmlFor="o_amount" className="text-label mb-2 block text-[12px] text-ink-subtle">
                          Your offer (R)
                        </label>
                        <Input
                          id="o_amount"
                          inputMode="numeric"
                          className="h-12 bg-card"
                          value={amount}
                          aria-invalid={!!amountError}
                          aria-describedby={amountError ? "o_amount-error" : undefined}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                        {amountError && (
                          <p id="o_amount-error" role="alert" className="mt-1.5 text-sm font-semibold text-brick">
                            Error: {amountError}
                          </p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="o_phone" className="text-label mb-2 block text-[12px] text-ink-subtle">
                          Contact number
                        </label>
                        <Input
                          id="o_phone"
                          type="tel"
                          autoComplete="tel"
                          className="h-12 bg-card"
                          value={phone}
                          maxLength={20}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="o_msg" className="text-label mb-2 block text-[12px] text-ink-subtle">
                          Message to the agent
                        </label>
                        <Textarea
                          id="o_msg"
                          rows={3}
                          maxLength={600}
                          className="bg-card"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Cash, no bond needed. Available to view this week."
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="brick"
                        size="xl"
                        className="font-display w-full font-bold uppercase tracking-wide"
                        disabled={busy}
                      >
                        {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                        Submit offer
                      </Button>
                      <p className="text-sm text-muted-foreground">
                        No payment or transfer happens here. An approved offer puts you in touch with the agent.
                      </p>
                    </form>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <p className="text-muted-foreground">
                        Sign in to submit and track an offer. Your role decides where you land, and you can follow the
                        status without phoning in.
                      </p>
                      <Button
                        variant="default"
                        size="lg"
                        className="font-display w-full font-bold uppercase tracking-wide"
                        onClick={() => void navigate({ to: "/auth" })}
                      >
                        Sign in to make an offer
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
